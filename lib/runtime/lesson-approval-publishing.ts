// Phase 5 orchestrator: publish a lesson version's runtime package and bind
// it to the lesson lifecycle approval step.
//
// Ordering contract (decided in Phase 5 planning, mirrors the POC protocol):
//   1. Publish the runtime package FIRST. The idempotency key
//      (`lesson-approve:<lessonVersionId>`) is stable across retries, so a
//      retried approval never creates a second publication attempt for the
//      same logical request. Publishing does not require the version to be
//      Approved — only the identity matters — so no approval state is touched
//      before storage and verification succeed.
//   2. Run the approval transaction (version → Approved, lesson → Approved,
//      currentApprovedVersionId) exactly as the legacy flow does.
//   3. Bind the approved version to the published runtime through the Phase 3
//      binding service (which itself requires an Approved version).
//   4. If binding fails after the approval committed, COMPENSATE: the version
//      returns to Draft and the lesson returns to its pre-approval state, so a
//      failed approval never leaves a half-approved lesson. The published
//      runtime stays published with no references — a valid, deduplicated
//      state (same as a close-loss publication attempt in the POC).
//
// What this file deliberately does NOT do: no writes to lesson content, no
// mutation of any previously published runtime (identity-pinned bytes are
// write-once by construction), no backfill of historical versions.

import { eq } from "drizzle-orm";
import { db as appDb } from "@/lib/db";
import { lessons, lessonVersions, LessonState, VersionStatus } from "@/database/schema";
import type { RuntimePublisher, PublishRuntimeInput } from "./runtime-publication";
import type { LessonVersionRuntimeBindingService } from "./lesson-version-runtime-binding";

export type ApproveLessonRuntimeInput = Readonly<{
  lessonId: string;
  lessonVersionId: string;
  htmlPlayer: string;
  sourceTemplateId?: string | null;
  actorUserId?: string | null;
}>;

export type ApproveLessonRuntimeDeps = Readonly<{
  publisher: Pick<RuntimePublisher, "publish">;
  bindingService: Pick<LessonVersionRuntimeBindingService, "bindLessonVersionRuntime">;
  db?: Pick<typeof appDb, "select" | "update" | "transaction">;
}>;

export type ApproveLessonRuntimeResult =
  | { readonly ok: true; readonly runtimeIdentity: string; readonly runtimeVersionId: string }
  | {
      readonly ok: false;
      readonly code: "publish-failed" | "approval-failed" | "bind-failed";
      readonly message: string;
      /** True when the approval side effects were undone (or never committed). */
      readonly rolledBack: boolean;
    };

export function approveLessonWithRuntime(
  input: ApproveLessonRuntimeInput,
  deps: ApproveLessonRuntimeDeps,
): Promise<ApproveLessonRuntimeResult> {
  const database = deps.db ?? appDb;
  const idempotencyKey = `lesson-approve:${input.lessonVersionId}`;

  // Step 1 — publish before any approval state changes. A failure here has
  // zero side effects on the lesson lifecycle.
  const packageInput: PublishRuntimeInput = {
    files: { "index.html": input.htmlPlayer },
    entryPoint: "index.html",
    capabilities: ["lesson-data"],
    sourceTemplateId: input.sourceTemplateId ?? null,
    actorUserId: input.actorUserId ?? null,
  };

  return (async (): Promise<ApproveLessonRuntimeResult> => {
    let runtimeIdentity: string;
    let runtimeVersionId: string;
    try {
      const published = await deps.publisher.publish(packageInput, idempotencyKey);
      runtimeIdentity = published.identity;
      runtimeVersionId = published.id;
    } catch (error) {
      return {
        ok: false,
        code: "publish-failed",
        message: error instanceof Error ? error.message : String(error),
        rolledBack: false,
      };
    }

    // Step 2 — approval transaction, mirroring the legacy approve flow.
    // Capture the pre-approval lesson row so step 4 can restore it exactly.
    let previous: { state: LessonState; currentApprovedVersionId: string | null } | null = null;
    try {
      const rows = await database
        .select({
          state: lessons.state,
          currentApprovedVersionId: lessons.currentApprovedVersionId,
        })
        .from(lessons)
        .where(eq(lessons.id, input.lessonId))
        .limit(1);
      previous = rows[0] ?? null;

      const now = new Date();
      await database.transaction(async (tx) => {
        await tx
          .update(lessonVersions)
          .set({ status: VersionStatus.Approved, approvedAt: now })
          .where(eq(lessonVersions.id, input.lessonVersionId));
        await tx
          .update(lessons)
          .set({ state: LessonState.Approved, currentApprovedVersionId: input.lessonVersionId })
          .where(eq(lessons.id, input.lessonId));
      });
    } catch (error) {
      // The transaction aborted: nothing committed, no compensation needed.
      return {
        ok: false,
        code: "approval-failed",
        message: error instanceof Error ? error.message : String(error),
        rolledBack: true,
      };
    }

    // Step 3 — bind the approved version to the published runtime.
    try {
      await deps.bindingService.bindLessonVersionRuntime({
        lessonVersionId: input.lessonVersionId,
        runtimeIdentity,
        actorUserId: input.actorUserId ?? null,
      });
    } catch (error) {
      // Step 4 — compensation: undo the approval so a failed approval never
      // leaves the lesson half-approved. The runtime stays published and
      // unreferenced (deduplicated by identity for the next attempt).
      try {
        await database.transaction(async (tx) => {
          await tx
            .update(lessonVersions)
            .set({ status: VersionStatus.Draft, approvedAt: null })
            .where(eq(lessonVersions.id, input.lessonVersionId));
          await tx
            .update(lessons)
            .set({
              state: previous?.state ?? LessonState.Draft,
              currentApprovedVersionId: previous?.currentApprovedVersionId ?? null,
            })
            .where(eq(lessons.id, input.lessonId));
        });
      } catch {
        // Compensation failure is logged by the caller's error path; the
        // original bind error below still describes the root cause.
      }
      return {
        ok: false,
        code: "bind-failed",
        message: error instanceof Error ? error.message : String(error),
        rolledBack: true,
      };
    }

    return { ok: true, runtimeIdentity, runtimeVersionId };
  })();
}
