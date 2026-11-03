import { logger } from "@/lib/logger";
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

// Central playable-lesson resolution for Phase 4 (controlled cutover). BOTH
// render paths — the authenticated dashboard play route and the anonymous
// public share route — assemble their player HTML here and nowhere else; the
// play queries in lib/dashboard/queries/lesson.ts stay responsible only for
// authorization scoping (owner / share token) and row fetching.
//
// Decision table:
//   flag OFF                          → legacy template HTML (Phase 4 behavior,
//                                       byte-identical to the pre-cutover path)
//   flag ON + Bound/Legacy runtime    → entry-point bytes from runtime storage,
//                                       verified by SHA-256; the mutable template
//                                       row is never read for this version
//   flag ON + Unbound (historical)    → legacy template HTML through the EXPLICIT
//                                       template-fallback mode (logged, observable)
//   flag ON + Quarantined/Unrecoverable → FAIL CLOSED: no HTML, no silent fallback
//   any runtime/storage contract error  → fail closed (null → 404 at the route)

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
  /** Legacy template HTML lookup — the ONLY source used when the flag is off
   *  or the version is Unbound. Returns null when no template is linked
   *  (preserves the pre-cutover inner-join → 404 semantics). */
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

  // ---- Legacy path (flag off): identical to pre-cutover behavior. ----
  if (!isEnabled()) {
    const htmlPlayer = await input.fetchTemplateHtmlPlayer();
    return htmlPlayer === null ? null : toResolved(input, htmlPlayer, "template");
  }

  // ---- Cutover path (flag on). ----
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
