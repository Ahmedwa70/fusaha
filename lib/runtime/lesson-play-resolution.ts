import { logger } from "@/lib/logger";
import { RuntimeBindingStatus } from "@/database/schema";
import {
  createLessonVersionRuntimeBindingService,
  LessonVersionRuntimeBindingError,
  type ResolvedLessonVersionRuntime,
} from "./lesson-version-runtime-binding";
import { isRuntimeResolverCutoverEnabled } from "./runtime-resolver-flag";
import {
  getDefaultRuntimeEntryContentReader,
  RuntimeEntryContentError,
} from "./runtime-entry-content";

// Central playable-lesson resolution. BOTH render paths — the authenticated
// dashboard play route and the anonymous public share route — assemble their
// player HTML here and nowhere else; the play queries in
// lib/dashboard/queries/lesson.ts stay responsible only for authorization
// scoping (owner / share token) and row fetching.
//
// Decision table (binding-driven — a Bound version's play independence can
// never depend on a deployment flag, because retireTemplate unlinks and
// deletes its template at an arbitrary later moment):
//   Unbound  + flag OFF                → legacy template HTML (Phase 4 rollback,
//                                        byte-identical to the pre-cutover path;
//                                        the resolver is never consulted)
//   Unbound  + flag ON                 → explicit template fallback (logged,
//                                        observable) — same bytes, instrumented
//   Bound/Legacy (flag ON or OFF)      → entry-point bytes from runtime storage,
//                                        verified by SHA-256; the mutable template
//                                        row is never read for this version, so a
//                                        retired/unlinked/deleted template cannot
//                                        break play (production retire incident)
//   Quarantined/Unrecoverable (any)    → FAIL CLOSED: no HTML, no silent fallback
//   any runtime/storage contract error → fail closed (null → 404 at the route)
//
// The cutover flag now governs exactly one thing: whether Unbound legacy rows
// take the instrumented path and whether blocked states fail closed when the
// flag is off. Rollback for the pre-Phase-4 population is unchanged; Bound
// rows have no pre-Phase-4 equivalent to roll back to.

export type PlayablePlayerSource = "runtime" | "template";

export type ResolvedPlayableLesson = Readonly<{
  name: string;
  content: unknown;
  htmlPlayer: string;
  source: PlayablePlayerSource;
}>;

export type AssemblePlayableLessonInput = Readonly<{
  name: string;
  content: unknown;
  lessonVersionId: string;
  /** Binding state of the version row, fetched by the play query alongside the
   *  version itself. Under a disabled cutover flag ONLY Unbound rows may take
   *  the legacy template path: Bound/Legacy rows must resolve through their
   *  runtime even with the flag off, because the template may already have
   *  been retired (schema_definitions.template_id unlinked, template row
   *  deleted) after binding — serving them from the template is both unsafe
   *  and, post-retire, a guaranteed 404. */
  runtimeBinding: Readonly<{
    status: RuntimeBindingStatus;
    runtimeVersionId: string | null;
  }>;
  /** Legacy template HTML lookup — the ONLY source used for Unbound versions.
   *  Returns null when no template is linked (preserves the pre-cutover
   *  inner-join → 404 semantics). Never consulted for Bound/Legacy rows. */
  fetchTemplateHtmlPlayer: () => Promise<string | null>;
}>;

export type AssemblePlayableLessonDeps = Readonly<{
  isEnabled?: () => boolean;
  resolveRuntime?: (lessonVersionId: string) => Promise<ResolvedLessonVersionRuntime>;
  readRuntimeEntry?: (runtimeVersionId: string) => Promise<{ html: string }>;
}>;

const bindingService = createLessonVersionRuntimeBindingService();

function toResolved(
  input: AssemblePlayableLessonInput,
  htmlPlayer: string,
  source: PlayablePlayerSource
): ResolvedPlayableLesson {
  return { name: input.name, content: input.content, htmlPlayer, source };
}

export async function assemblePlayableLesson(
  input: AssemblePlayableLessonInput,
  deps: AssemblePlayableLessonDeps = {}
): Promise<ResolvedPlayableLesson | null> {
  const isEnabled = deps.isEnabled ?? isRuntimeResolverCutoverEnabled;

  // ---- Legacy rollback path: flag off + Unbound only. ----
  // Byte-identical to the pre-cutover behavior and the resolver is never
  // consulted. Bound/Legacy/Quarantined/Unrecoverable rows fall through to
  // the binding-driven path below even with the flag off.
  if (!isEnabled() && input.runtimeBinding.status === RuntimeBindingStatus.Unbound) {
    const htmlPlayer = await input.fetchTemplateHtmlPlayer();
    return htmlPlayer === null ? null : toResolved(input, htmlPlayer, "template");
  }

  // ---- Binding-driven path: flag on, or any non-Unbound binding state. ----
  const resolveRuntime = deps.resolveRuntime ?? ((id: string) => bindingService.resolveLessonVersionRuntime(id));
  const readRuntimeEntry =
    deps.readRuntimeEntry ??
    (async (runtimeVersionId: string) => {
      const content = await getDefaultRuntimeEntryContentReader().read(runtimeVersionId);
      return { html: content.html };
    });

  let resolved: ResolvedLessonVersionRuntime;
  try {
    resolved = await resolveRuntime(input.lessonVersionId);
  } catch (error) {
    if (error instanceof LessonVersionRuntimeBindingError) {
      if (error.code === "lesson-version-quarantined" || error.code === "lesson-version-unrecoverable") {
        // Contract: these states must never render — not even from the template.
        logger.warn(
          { lessonVersionId: input.lessonVersionId, code: error.code },
          "lesson-runtime: rendering blocked by binding state (fail closed)"
        );
        return null;
      }
      // Missing version / deleted lesson / runtime integrity violation: fail closed.
      logger.error(
        { lessonVersionId: input.lessonVersionId, code: error.code },
        "lesson-runtime: resolution failed (fail closed)"
      );
      return null;
    }
    throw error;
  }

  if (resolved.mode === "bound" || resolved.mode === "legacy") {
    try {
      const entry = await readRuntimeEntry(resolved.runtimeVersionId);
      return toResolved(input, entry.html, "runtime");
    } catch (error) {
      if (error instanceof RuntimeEntryContentError) {
        logger.error(
          { lessonVersionId: input.lessonVersionId, runtimeVersionId: resolved.runtimeVersionId, code: error.code },
          "lesson-runtime: runtime entry unavailable (fail closed)"
        );
        return null;
      }
      throw error;
    }
  }

  // template-fallback — explicit, observable legacy mode for Unbound rows.
  logger.info(
    { lessonVersionId: input.lessonVersionId },
    "lesson-runtime: unbound historical version using explicit template fallback"
  );
  const htmlPlayer = await input.fetchTemplateHtmlPlayer();
  return htmlPlayer === null ? null : toResolved(input, htmlPlayer, "template");
}
