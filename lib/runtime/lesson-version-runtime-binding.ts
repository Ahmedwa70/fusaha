import { and, eq, or, isNull, count, ne } from "drizzle-orm";
import { db as appDb } from "@/lib/db";
import {
  auditLogs,
  lessonVersions,
  lessons,
  runtimeVersions,
  RuntimeBindingStatus,
  RuntimeVersionState,
  VersionStatus,
} from "@/database/schema";

// Database-backed Lesson Version ↔ Runtime Version binding (Phase 3 of
// TEMPLATE_RUNTIME_IMPLEMENTATION_PLAN). This is the production counterpart of
// the in-memory boundary in ./lesson-version-binding.ts: it operates on the
// immutable runtime registry schema (migration 0023, design doc
// RUNTIME_VERSION_SCHEMA_DESIGN §3.6) instead of the pre-freeze v0 in-memory
// identity. Bindings reference a PUBLISHED runtime by its frozen V1 content
// identity (`sha256-v1-<64 hex>`), never by a mutable template/schema row.
//
// State machine (numeric values in database/schema/enums.ts, mapping in the
// design doc §3.7):
//   Unbound(0)  --bind-->              Bound(1)     requires runtime_version_id
//   Unbound(0)  --markLegacy-->        Legacy(2)    requires runtime_version_id
//   {Unbound,Bound,Legacy} --quarantine-->       Quarantined(3)  runtime ref cleared
//   {Unbound,Bound,Legacy} --unrecoverable-->  Unrecoverable(4) runtime ref cleared
// Re-asserting an IDENTICAL binding is idempotent. Rebinding to a different
// runtime is always rejected (binding is immutable once established) — the only
// way off an established runtime reference is an explicit remediation state.
// Quarantined/Unrecoverable are fail-closed: the resolver throws instead of
// silently falling back to the mutable template join.

export type LessonVersionRuntimeBindingErrorCode =
  | "invalid-lesson-version-id"
  | "invalid-runtime-identity"
  | "invalid-reason"
  | "lesson-version-not-found"
  | "lesson-version-not-approved"
  | "lesson-version-deleted"
  | "runtime-not-found"
  | "runtime-not-published"
  | "binding-already-established"
  | "binding-state-forbidden"
  | "lesson-version-quarantined"
  | "lesson-version-unrecoverable"
  | "runtime-integrity-violation";

export class LessonVersionRuntimeBindingError extends Error {
  readonly code: LessonVersionRuntimeBindingErrorCode;

  constructor(message: string, code: LessonVersionRuntimeBindingErrorCode) {
    super(message);
    this.name = "LessonVersionRuntimeBindingError";
    this.code = code;
  }
}

export const RUNTIME_IDENTITY_PATTERN = /^sha256-v1-[0-9a-f]{64}$/;

export type RuntimeBindingRecord = Readonly<{
  lessonVersionId: string;
  bindingStatus: RuntimeBindingStatus;
  runtimeVersionId: string | null;
  runtimeIdentity: string | null;
}>;

// What the resolver returns. `template-fallback` is the EXPLICIT legacy mode:
// observable and deliberate, never a silent fallback (implementation plan
// Phase 3 deliverable "resolver with explicit legacy mode"). Quarantined and
// Unrecoverable versions throw — they must fail closed.
export type ResolvedLessonVersionRuntime =
  | {
      readonly mode: "bound";
      readonly lessonVersionId: string;
      readonly runtimeVersionId: string;
      readonly runtimeIdentity: string;
      readonly entryPoint: string;
      readonly manifest: unknown;
    }
  | {
      readonly mode: "legacy";
      readonly lessonVersionId: string;
      readonly runtimeVersionId: string;
      readonly runtimeIdentity: string;
      readonly entryPoint: string;
      readonly manifest: unknown;
    }
  | { readonly mode: "template-fallback"; readonly lessonVersionId: string };

export type RuntimeBindingReconciliation = Readonly<{
  totalVersions: number;
  byStatus: Record<number, number>;
  /** Bound/Legacy rows pointing at a missing or non-published runtime (fail closed). */
  integrityViolations: ReadonlyArray<{
    lessonVersionId: string;
    runtimeVersionId: string;
    bindingStatus: number;
  }>;
  /** Approved versions still on the explicit template fallback. */
  unboundApprovedCount: number;
}>;

export type LessonVersionRuntimeBindingService = ReturnType<typeof createLessonVersionRuntimeBindingService>;

export type BindRuntimeInput = Readonly<{
  lessonVersionId: string;
  runtimeIdentity: string;
  actorUserId?: string | null;
}>;

export type RemediateBindingInput = Readonly<{
  lessonVersionId: string;
  reason: string;
  actorUserId?: string | null;
}>;

export function createLessonVersionRuntimeBindingService(db: typeof appDb = appDb) {
  type DbOrTx = Pick<typeof appDb, "select" | "update" | "insert" | "transaction">;

  async function getLessonVersionRow(dbOrTx: DbOrTx, lessonVersionId: string) {
    const rows = await dbOrTx
      .select({
        id: lessonVersions.id,
        status: lessonVersions.status,
        runtimeVersionId: lessonVersions.runtimeVersionId,
        runtimeBindingStatus: lessonVersions.runtimeBindingStatus,
        lessonDeletedAt: lessons.deletedAt,
      })
      .from(lessonVersions)
      .innerJoin(lessons, eq(lessonVersions.lessonId, lessons.id))
      .where(eq(lessonVersions.id, lessonVersionId))
      .limit(1);
    return rows[0];
  }

  function assertLessonVersionId(lessonVersionId: string): void {
    if (!lessonVersionId?.trim()) {
      throw new LessonVersionRuntimeBindingError("A lesson version ID is required.", "invalid-lesson-version-id");
    }
  }

  function assertRuntimeIdentity(runtimeIdentity: string): void {
    if (!RUNTIME_IDENTITY_PATTERN.test(runtimeIdentity ?? "")) {
      throw new LessonVersionRuntimeBindingError(
        `Runtime identity must match ${RUNTIME_IDENTITY_PATTERN.source}.`,
        "invalid-runtime-identity"
      );
    }
  }

  function assertReason(reason: string): void {
    if (!reason?.trim()) {
      throw new LessonVersionRuntimeBindingError("A reason is required for this binding state.", "invalid-reason");
    }
  }

  async function resolveRuntimeVersion(dbOrTx: DbOrTx, runtimeIdentity: string) {
    const rows = await dbOrTx
      .select({
        id: runtimeVersions.id,
        identity: runtimeVersions.identity,
        state: runtimeVersions.state,
      })
      .from(runtimeVersions)
      .where(eq(runtimeVersions.identity, runtimeIdentity))
      .limit(1);
    const runtime = rows[0];
    if (!runtime) {
      throw new LessonVersionRuntimeBindingError(
        `Runtime identity does not exist: ${runtimeIdentity}`,
        "runtime-not-found"
      );
    }
    if (runtime.state !== RuntimeVersionState.Published) {
      throw new LessonVersionRuntimeBindingError(
        `Runtime ${runtimeIdentity} is not published (state ${runtime.state}).`,
        "runtime-not-published"
      );
    }
    return runtime;
  }

  async function assertBindableLessonVersion(dbOrTx: DbOrTx, lessonVersionId: string) {
    const row = await getLessonVersionRow(dbOrTx, lessonVersionId);
    if (!row) {
      throw new LessonVersionRuntimeBindingError(
        `Lesson version not found: ${lessonVersionId}`,
        "lesson-version-not-found"
      );
    }
    if (row.lessonDeletedAt !== null) {
      throw new LessonVersionRuntimeBindingError(
        `Lesson version belongs to a deleted lesson: ${lessonVersionId}`,
        "lesson-version-deleted"
      );
    }
    if (row.status !== VersionStatus.Approved) {
      throw new LessonVersionRuntimeBindingError(
        `Only approved lesson versions can be runtime-bound: ${lessonVersionId}`,
        "lesson-version-not-approved"
      );
    }
    return row;
  }

  async function writeAudit(
    dbOrTx: DbOrTx,
    entry: Readonly<{
      action: string;
      resourceId: string;
      actorUserId?: string | null;
      oldValues?: unknown;
      newValues?: unknown;
    }>
  ): Promise<void> {
    await dbOrTx.insert(auditLogs).values({
      action: entry.action,
      resourceType: "lesson_version",
      resourceId: entry.resourceId,
      userId: entry.actorUserId ?? null,
      oldValues: entry.oldValues === undefined ? null : (entry.oldValues as Record<string, unknown>),
      newValues: entry.newValues === undefined ? null : (entry.newValues as Record<string, unknown>),
    });
  }

  function toRecord(
    row: Readonly<{ id: string; runtimeBindingStatus: number; runtimeVersionId: string | null }>,
    runtimeIdentity: string | null
  ): RuntimeBindingRecord {
    return {
      lessonVersionId: row.id,
      bindingStatus: row.runtimeBindingStatus as RuntimeBindingStatus,
      runtimeVersionId: row.runtimeVersionId,
      runtimeIdentity,
    };
  }

  // Bind (Bound) or classified legacy bind (Legacy). The conditional UPDATE is
  // the race guard: it matches only Unbound rows, or an idempotent re-assert
  // of the same runtime on an already-Bound/Legacy row — so concurrent bind
  // calls for DIFFERENT runtimes cannot both win, and a hijack attempt finds
  // the row already established. A zero-row update leaves nothing changed.
  async function establishBinding(
    input: BindRuntimeInput & { readonly targetStatus: RuntimeBindingStatus.Bound | RuntimeBindingStatus.Legacy },
    auditAction: string
  ): Promise<RuntimeBindingRecord> {
    assertLessonVersionId(input.lessonVersionId);
    assertRuntimeIdentity(input.runtimeIdentity);

    return db.transaction(async (tx) => {
      await assertBindableLessonVersion(tx, input.lessonVersionId);
      const runtime = await resolveRuntimeVersion(tx, input.runtimeIdentity);

      const updated = await tx
        .update(lessonVersions)
        .set({ runtimeVersionId: runtime.id, runtimeBindingStatus: input.targetStatus })
        .where(
          and(
            eq(lessonVersions.id, input.lessonVersionId),
            or(
              eq(lessonVersions.runtimeBindingStatus, RuntimeBindingStatus.Unbound),
              and(
                eq(lessonVersions.runtimeBindingStatus, input.targetStatus),
                eq(lessonVersions.runtimeVersionId, runtime.id)
              )
            )
          )
        )
        .returning({
          id: lessonVersions.id,
          runtimeBindingStatus: lessonVersions.runtimeBindingStatus,
          runtimeVersionId: lessonVersions.runtimeVersionId,
        });

      if (updated.length === 0) {
        const current = await getLessonVersionRow(tx, input.lessonVersionId);
        if (current && (current.runtimeBindingStatus === RuntimeBindingStatus.Bound || current.runtimeBindingStatus === RuntimeBindingStatus.Legacy)) {
          throw new LessonVersionRuntimeBindingError(
            `Lesson version already has an immutable runtime binding: ${input.lessonVersionId}`,
            "binding-already-established"
          );
        }
        if (current && (current.runtimeBindingStatus === RuntimeBindingStatus.Quarantined || current.runtimeBindingStatus === RuntimeBindingStatus.Unrecoverable)) {
          throw new LessonVersionRuntimeBindingError(
            `Lesson version is in a terminal remediation state and cannot be bound: ${input.lessonVersionId}`,
            "binding-state-forbidden"
          );
        }
        throw new LessonVersionRuntimeBindingError(
          `Could not establish runtime binding for lesson version: ${input.lessonVersionId}`,
          "binding-state-forbidden"
        );
      }

      await writeAudit(tx, {
        action: auditAction,
        resourceId: input.lessonVersionId,
        actorUserId: input.actorUserId,
        newValues: {
          runtimeVersionId: runtime.id,
          runtimeIdentity: runtime.identity,
          bindingStatus: input.targetStatus,
        },
      });

      return toRecord(updated[0], runtime.identity);
    });
  }

  // Quarantine / Unrecoverable: explicit remediation states. They clear the
  // runtime reference (allowed by lesson_versions_binding_chk for status
  // 0/3/4) so a quarantined version can never resolve to a runtime. Idempotent
  // when the row already holds the same remediation state.
  async function remediateBinding(
    input: RemediateBindingInput & {
      readonly targetStatus: RuntimeBindingStatus.Quarantined | RuntimeBindingStatus.Unrecoverable;
    },
    auditAction: string
  ): Promise<RuntimeBindingRecord> {
    assertLessonVersionId(input.lessonVersionId);
    assertReason(input.reason);

    return db.transaction(async (tx) => {
      const row = await getLessonVersionRow(tx, input.lessonVersionId);
      if (!row) {
        throw new LessonVersionRuntimeBindingError(
          `Lesson version not found: ${input.lessonVersionId}`,
          "lesson-version-not-found"
        );
      }

      const updated = await tx
        .update(lessonVersions)
        .set({ runtimeVersionId: null, runtimeBindingStatus: input.targetStatus })
        .where(
          and(
            eq(lessonVersions.id, input.lessonVersionId),
            or(
              eq(lessonVersions.runtimeBindingStatus, RuntimeBindingStatus.Unbound),
              eq(lessonVersions.runtimeBindingStatus, RuntimeBindingStatus.Bound),
              eq(lessonVersions.runtimeBindingStatus, RuntimeBindingStatus.Legacy),
              eq(lessonVersions.runtimeBindingStatus, input.targetStatus)
            )
          )
        )
        .returning({
          id: lessonVersions.id,
          runtimeBindingStatus: lessonVersions.runtimeBindingStatus,
          runtimeVersionId: lessonVersions.runtimeVersionId,
        });

      if (updated.length === 0) {
        throw new LessonVersionRuntimeBindingError(
          `Lesson version is already in a remediation state and cannot transition to ${input.targetStatus}: ${input.lessonVersionId}`,
          "binding-state-forbidden"
        );
      }

      await writeAudit(tx, {
        action: auditAction,
        resourceId: input.lessonVersionId,
        actorUserId: input.actorUserId,
        oldValues: { runtimeVersionId: row.runtimeVersionId, bindingStatus: row.runtimeBindingStatus },
        newValues: { bindingStatus: input.targetStatus, reason: input.reason.trim() },
      });

      return toRecord(updated[0], null);
    });
  }

  return {
    bindLessonVersionRuntime(input: BindRuntimeInput): Promise<RuntimeBindingRecord> {
      return establishBinding({ ...input, targetStatus: RuntimeBindingStatus.Bound }, "lesson-version-runtime-bound");
    },

    markLessonVersionLegacyRuntime(
      input: BindRuntimeInput & { readonly reason: string }
    ): Promise<RuntimeBindingRecord> {
      assertReason(input.reason);
      return establishBinding(
        { lessonVersionId: input.lessonVersionId, runtimeIdentity: input.runtimeIdentity, actorUserId: input.actorUserId, targetStatus: RuntimeBindingStatus.Legacy },
        "lesson-version-runtime-legacy"
      );
    },

    quarantineLessonVersion(input: RemediateBindingInput): Promise<RuntimeBindingRecord> {
      return remediateBinding({ ...input, targetStatus: RuntimeBindingStatus.Quarantined }, "lesson-version-runtime-quarantined");
    },

    markLessonVersionUnrecoverable(input: RemediateBindingInput): Promise<RuntimeBindingRecord> {
      return remediateBinding({ ...input, targetStatus: RuntimeBindingStatus.Unrecoverable }, "lesson-version-runtime-unrecoverable");
    },

    async resolveLessonVersionRuntime(lessonVersionId: string): Promise<ResolvedLessonVersionRuntime> {
      assertLessonVersionId(lessonVersionId);
      const row = await getLessonVersionRow(db, lessonVersionId);
      if (!row) {
        throw new LessonVersionRuntimeBindingError(
          `Lesson version not found: ${lessonVersionId}`,
          "lesson-version-not-found"
        );
      }
      if (row.lessonDeletedAt !== null) {
        throw new LessonVersionRuntimeBindingError(
          `Lesson version belongs to a deleted lesson: ${lessonVersionId}`,
          "lesson-version-deleted"
        );
      }

      switch (row.runtimeBindingStatus) {
        case RuntimeBindingStatus.Bound:
        case RuntimeBindingStatus.Legacy: {
          // FK guarantees the row exists; state=Published is the integrity
          // invariant — anything else fails closed instead of resolving.
          const runtimeRows = await db
            .select({
              id: runtimeVersions.id,
              identity: runtimeVersions.identity,
              state: runtimeVersions.state,
              entryPoint: runtimeVersions.entryPoint,
              manifest: runtimeVersions.manifest,
            })
            .from(runtimeVersions)
            .where(eq(runtimeVersions.id, row.runtimeVersionId ?? ""))
            .limit(1);
          const runtime = runtimeRows[0];
          if (!runtime || runtime.state !== RuntimeVersionState.Published) {
            throw new LessonVersionRuntimeBindingError(
              `Bound runtime failed integrity validation for lesson version: ${lessonVersionId}`,
              "runtime-integrity-violation"
            );
          }
          return {
            mode: row.runtimeBindingStatus === RuntimeBindingStatus.Bound ? "bound" : "legacy",
            lessonVersionId: row.id,
            runtimeVersionId: runtime.id,
            runtimeIdentity: runtime.identity,
            entryPoint: runtime.entryPoint,
            manifest: runtime.manifest,
          };
        }
        case RuntimeBindingStatus.Unbound:
          return { mode: "template-fallback", lessonVersionId: row.id };
        case RuntimeBindingStatus.Quarantined:
          throw new LessonVersionRuntimeBindingError(
            `Lesson version is quarantined and must not render: ${lessonVersionId}`,
            "lesson-version-quarantined"
          );
        case RuntimeBindingStatus.Unrecoverable:
          throw new LessonVersionRuntimeBindingError(
            `Lesson version is unrecoverable and must not render: ${lessonVersionId}`,
            "lesson-version-unrecoverable"
          );
        default:
          throw new LessonVersionRuntimeBindingError(
            `Unknown binding status ${row.runtimeBindingStatus} for lesson version: ${lessonVersionId}`,
            "binding-state-forbidden"
          );
      }
    },

    // Mapping report (implementation plan Phase 3 deliverable): per-status
    // counts plus the integrity violations a backfill must never leave behind.
    async getBindingReconciliation(): Promise<RuntimeBindingReconciliation> {
      const statusCounts = await db
        .select({ status: lessonVersions.runtimeBindingStatus, n: count() })
        .from(lessonVersions)
        .groupBy(lessonVersions.runtimeBindingStatus);

      const byStatus: Record<number, number> = {};
      let totalVersions = 0;
      for (const row of statusCounts) {
        byStatus[row.status] = Number(row.n);
        totalVersions += Number(row.n);
      }

      const violations = await db
        .select({
          lessonVersionId: lessonVersions.id,
          runtimeVersionId: lessonVersions.runtimeVersionId,
          bindingStatus: lessonVersions.runtimeBindingStatus,
        })
        .from(lessonVersions)
        .leftJoin(runtimeVersions, eq(lessonVersions.runtimeVersionId, runtimeVersions.id))
        .where(
          and(
            or(
              eq(lessonVersions.runtimeBindingStatus, RuntimeBindingStatus.Bound),
              eq(lessonVersions.runtimeBindingStatus, RuntimeBindingStatus.Legacy)
            ),
            or(isNull(runtimeVersions.id), ne(runtimeVersions.state, RuntimeVersionState.Published))
          )
        );

      const unboundApproved = await db
        .select({ n: count() })
        .from(lessonVersions)
        .where(
          and(
            eq(lessonVersions.runtimeBindingStatus, RuntimeBindingStatus.Unbound),
            eq(lessonVersions.status, VersionStatus.Approved)
          )
        );

      return {
        totalVersions,
        byStatus,
        integrityViolations: violations.map((v) => ({
          lessonVersionId: v.lessonVersionId,
          runtimeVersionId: v.runtimeVersionId ?? "",
          bindingStatus: v.bindingStatus,
        })),
        unboundApprovedCount: Number(unboundApproved[0]?.n ?? 0),
      };
    },
  };
}
