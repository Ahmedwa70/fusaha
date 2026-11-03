// Phase 6 — historical lesson runtime classification & classified migration.
//
// Read-only inventory and deterministic classification of every lesson
// version against the evidence actually available in the database, per
// implementation plan §6.2 (a perfect historical snapshot may be impossible —
// that MUST be reported as a data-quality classification, never guessed
// away) and design doc §6 (backfill is classified, never inferred).
//
// Evidence model (read-only):
// - E1 player bytes available: the version's schema definition links a
//   template row whose html_player is the exact input composePlayerHtml
//   used at render time (composePlayerHtml depends on nothing else — the
//   lesson content is injected separately and stays in lesson_versions).
// - E2 immutability: templates.updated_at <= lesson_versions.created_at.
//   Any template edit bumps updated_at, so when this holds the player bytes
//   are provably identical to what the version rendered from. The rule is
//   deliberately conservative: an edit to ANY template column (name, preview
//   image, …) also forfeits evidence, even if html_player itself did not
//   change — the schema alone cannot tell them apart.
// - E3 explicit legacy decision: an operator-supplied { lessonVersionId,
//   reason } pair. Legacy is a decision, not a fact; the engine never
//   assigns it on its own.
//
// Classification (approved, not-yet-bound versions only):
// - Bound candidate:   E1 ∧ E2 — package provably reproducible → bind Bound.
// - Legacy decision:   E1 ∧ ¬E2 ∧ E3 — deliberate legacy snapshot with reason.
// - Quarantined:       E1 ∧ ¬E2 ∧ ¬E3 — the template changed after generation
//                      and the html_player change cannot be disproven from the
//                      schema alone; reviewable (audit history / explicit
//                      decision). Never silently bound.
// - Quarantined gap:   ¬E1 — no player bytes in the database (templateId null);
//                      reviewable from backups. Rendering is already broken
//                      for these rows (the play query inner-joins templates).
// - Unrecoverable:     proven-unrecoverable raw states (kept for defense in
//                      depth; healthy data reaches it only via pre-existing
//                      Unrecoverable rows, since content is NOT NULL and the
//                      template FK is RESTRICT).
// - Draft versions and already-established Bound/Legacy/Quarantined/
//   Unrecoverable rows are inventoried and reported but never reclassified
//   or rewritten by the engine.
//
// The migration applier (applyHistoricalRuntimeMigration) is the only writing
// entry point. It publishes ONE runtime per distinct template player
// (content-addressed identity dedupes across templates sharing bytes) and
// binds only Bound candidates and approved Legacy decisions. Reruns are safe:
// publication is idempotent and the binding service re-asserts an identical
// binding idempotently.

import { and, desc, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db as appDb } from "@/lib/db";
import {
  lessons,
  lessonVersions,
  schemaDefinitions,
  templates,
  runtimeVersions,
  VersionStatus,
  RuntimeBindingStatus,
  RuntimeVersionState,
} from "@/database/schema";
import type { RuntimePublisher, PublishRuntimeInput } from "./runtime-publication";
import type { LessonVersionRuntimeBindingService } from "./lesson-version-runtime-binding";
import { canonicalizePackage } from "./runtime-identity-v1";

export const HISTORICAL_BACKFILL_IDEMPOTENCY_PREFIX = "historical-backfill:tmpl:";

export type HistoricalClassification =
  | "bound-candidate"
  | "legacy-decision"
  | "quarantined-conflict"
  | "quarantined-gap"
  | "unrecoverable"
  | "unbound-insufficient-evidence"
  | "already-bound"
  | "remediated"
  | "out-of-scope-draft";

export type LegacyDecision = Readonly<{ lessonVersionId: string; reason: string }>;

export type VersionInventoryEntry = Readonly<{
  lessonId: string;
  lessonVersionId: string;
  versionNumber: number;
  approved: boolean;
  bindingStatus: RuntimeBindingStatus;
  runtimeVersionId: string | null;
  schemaDefinitionId: string;
  templateId: string | null;
  templateUpdatedAt: Date | null;
  versionCreatedAt: Date;
  playerBytesAvailable: boolean;
  immutabilityEvidence: boolean;
  legacyDecision: string | null;
  classification: HistoricalClassification;
  reason: string;
}>;

export type HistoricalInventory = Readonly<{
  totalVersions: number;
  entries: ReadonlyArray<VersionInventoryEntry>;
  counts: Readonly<Record<HistoricalClassification, number>>;
  /** Bound/Legacy rows whose referenced runtime is missing or not published. */
  integrityViolations: ReadonlyArray<{ lessonVersionId: string; runtimeVersionId: string }>;
}>;

type DbLike = Pick<typeof appDb, "select">;

type VersionRow = Readonly<{
  lessonId: string;
  lessonVersionId: string;
  versionNumber: number;
  status: VersionStatus;
  bindingStatus: RuntimeBindingStatus;
  runtimeVersionId: string | null;
  schemaDefinitionId: string;
  versionCreatedAt: Date;
  templateId: string | null;
  templateUpdatedAt: Date | null;
  templateHtmlPlayer: string | null;
}>;

async function loadVersionRows(db: DbLike): Promise<VersionRow[]> {
  return db
    .select({
      lessonId: lessonVersions.lessonId,
      lessonVersionId: lessonVersions.id,
      versionNumber: lessonVersions.versionNumber,
      status: lessonVersions.status,
      bindingStatus: lessonVersions.runtimeBindingStatus,
      runtimeVersionId: lessonVersions.runtimeVersionId,
      schemaDefinitionId: lessonVersions.schemaDefinitionId,
      versionCreatedAt: lessonVersions.createdAt,
      templateId: schemaDefinitions.templateId,
      templateUpdatedAt: templates.updatedAt,
      templateHtmlPlayer: templates.htmlPlayer,
    })
    .from(lessonVersions)
    .innerJoin(schemaDefinitions, eq(lessonVersions.schemaDefinitionId, schemaDefinitions.id))
    .leftJoin(templates, eq(schemaDefinitions.templateId, templates.id))
    .orderBy(desc(lessonVersions.createdAt), desc(lessonVersions.versionNumber));
}

function classifyRow(
  row: VersionRow,
  legacyDecisions: ReadonlyMap<string, string>,
): { classification: HistoricalClassification; reason: string } {
  if (row.status !== VersionStatus.Approved) {
    return { classification: "out-of-scope-draft", reason: "version is not approved; playable migration covers approved versions only" };
  }
  if (row.bindingStatus === RuntimeBindingStatus.Bound || row.bindingStatus === RuntimeBindingStatus.Legacy) {
    return { classification: "already-bound", reason: `binding already established (status=${row.bindingStatus})` };
  }
  if (row.bindingStatus === RuntimeBindingStatus.Quarantined || row.bindingStatus === RuntimeBindingStatus.Unrecoverable) {
    return { classification: "remediated", reason: `previously remediated (status=${row.bindingStatus}); never reclassified automatically` };
  }

  const playerAvailable = row.templateId !== null && row.templateHtmlPlayer !== null;
  if (!playerAvailable) {
    return {
      classification: "quarantined-gap",
      reason: "no player bytes in the database (schema definition has no linked template); rendering is already broken; reviewable from backups",
    };
  }

  const immutabilityEvidence = row.templateUpdatedAt !== null && row.templateUpdatedAt <= row.versionCreatedAt;
  const decision = legacyDecisions.get(row.lessonVersionId);

  if (immutabilityEvidence) {
    return {
      classification: "bound-candidate",
      reason: "templates.updated_at <= version.created_at: player bytes provably unchanged since generation",
    };
  }
  if (decision !== undefined) {
    // A decision exists (even a blank one): classify as legacy-decision so a
    // malformed entry fails loudly at application time instead of silently
    // downgrading to a reviewable conflict. The applier refuses blank reasons.
    return {
      classification: "legacy-decision",
      reason: decision.trim().length > 0 ? `explicit legacy decision: ${decision}` : "explicit legacy decision with a blank reason (must be rejected at apply time)",
    };
  }
  return {
    classification: "quarantined-conflict",
    reason: "template was modified after version creation; html_player change cannot be disproven from the schema alone — review template audit history or supply an explicit legacy decision",
  };
}

/**
 * Read-only inventory + classification of every lesson version. Never
 * writes. `legacyDecisions` is the operator decision list (E3); without it,
 * modified-template versions classify as reviewable conflicts, never Legacy.
 */
export async function classifyHistoricalLessonVersions(
  db: DbLike = appDb,
  options: Readonly<{ legacyDecisions?: ReadonlyArray<LegacyDecision> }> = {},
): Promise<HistoricalInventory> {
  const decisions = new Map((options.legacyDecisions ?? []).map((d) => [d.lessonVersionId, d.reason]));
  const rows = await loadVersionRows(db);
  const entries: VersionInventoryEntry[] = [];
  const counts: Record<HistoricalClassification, number> = {
    "bound-candidate": 0,
    "legacy-decision": 0,
    "quarantined-conflict": 0,
    "quarantined-gap": 0,
    "unrecoverable": 0,
    "unbound-insufficient-evidence": 0,
    "already-bound": 0,
    "remediated": 0,
    "out-of-scope-draft": 0,
  };
  const integrityViolations: { lessonVersionId: string; runtimeVersionId: string }[] = [];

  for (const row of rows) {
    const { classification, reason } = classifyRow(row, decisions);
    counts[classification] += 1;
    entries.push({
      lessonId: row.lessonId,
      lessonVersionId: row.lessonVersionId,
      versionNumber: row.versionNumber,
      approved: row.status === VersionStatus.Approved,
      bindingStatus: row.bindingStatus,
      runtimeVersionId: row.runtimeVersionId,
      schemaDefinitionId: row.schemaDefinitionId,
      templateId: row.templateId,
      templateUpdatedAt: row.templateUpdatedAt,
      versionCreatedAt: row.versionCreatedAt,
      playerBytesAvailable: row.templateId !== null && row.templateHtmlPlayer !== null,
      immutabilityEvidence: row.templateUpdatedAt !== null && row.templateUpdatedAt <= row.versionCreatedAt,
      legacyDecision: decisions.get(row.lessonVersionId) ?? null,
      classification,
      reason,
    });

    if (
      (row.bindingStatus === RuntimeBindingStatus.Bound || row.bindingStatus === RuntimeBindingStatus.Legacy) &&
      row.runtimeVersionId
    ) {
      const runtime = await db
        .select({ state: runtimeVersions.state })
        .from(runtimeVersions)
        .where(eq(runtimeVersions.id, row.runtimeVersionId))
        .limit(1);
      if (!runtime[0] || runtime[0].state !== RuntimeVersionState.Published) {
        integrityViolations.push({ lessonVersionId: row.lessonVersionId, runtimeVersionId: row.runtimeVersionId });
      }
    }
  }

  return { totalVersions: rows.length, entries, counts, integrityViolations };
}

export type MigrationPlan = Readonly<{
  dryRun: true;
  publishByTemplate: ReadonlyArray<{ templateId: string; boundCandidates: number; legacyDecisions: number }>;
  bindBound: number;
  bindLegacy: number;
  skipped: Readonly<Record<Exclude<HistoricalClassification, "bound-candidate" | "legacy-decision">, number>>;
}>;

/**
 * Dry-run plan: what a migration WOULD do, without any writes. Grouped by
 * template so the report shows how many distinct runtimes publication would
 * create (one per distinct player, deduplicated content-addressed).
 */
export async function planHistoricalRuntimeMigration(
  db: DbLike = appDb,
  options: Readonly<{ legacyDecisions?: ReadonlyArray<LegacyDecision> }> = {},
): Promise<MigrationPlan> {
  const inventory = await classifyHistoricalLessonVersions(db, options);
  const byTemplate = new Map<string, { boundCandidates: number; legacyDecisions: number }>();
  const skipped: Record<Exclude<HistoricalClassification, "bound-candidate" | "legacy-decision">, number> = {
    "quarantined-conflict": 0,
    "quarantined-gap": 0,
    "unrecoverable": 0,
    "unbound-insufficient-evidence": 0,
    "already-bound": 0,
    "remediated": 0,
    "out-of-scope-draft": 0,
  };
  let bindBound = 0;
  let bindLegacy = 0;
  for (const entry of inventory.entries) {
    if (entry.classification === "bound-candidate" || entry.classification === "legacy-decision") {
      if (!entry.templateId) continue; // classifyRow guarantees this, keep the type narrow
      const bucket = byTemplate.get(entry.templateId) ?? { boundCandidates: 0, legacyDecisions: 0 };
      if (entry.classification === "bound-candidate") {
        bucket.boundCandidates += 1;
        bindBound += 1;
      } else {
        bucket.legacyDecisions += 1;
        bindLegacy += 1;
      }
      byTemplate.set(entry.templateId, bucket);
    } else {
      skipped[entry.classification] += 1;
    }
  }
  return {
    dryRun: true,
    publishByTemplate: [...byTemplate.entries()].map(([templateId, counts]) => ({ templateId, ...counts })),
    bindBound,
    bindLegacy,
    skipped,
  };
}

export type MigrationResult = Readonly<{
  publishedTemplateIds: ReadonlyArray<string>;
  boundVersionIds: ReadonlyArray<string>;
  legacyVersionIds: ReadonlyArray<string>;
  unchanged: number;
}>;

/**
 * Applies the classified migration (DISPOSABLE/STAGED databases only — the
 * caller is responsible for the environment gate). Writes only
 * Bound candidates (bind) and approved Legacy decisions (legacy bind with the
 * recorded reason). Everything else is reported as unchanged. Reruns are safe:
 * publication is idempotent per template player and the binding service
 * re-asserts an identical binding idempotently; a version bound to a different
 * runtime than the classified one would surface as a binding error (fail
 * closed), never a silent overwrite.
 */
export async function applyHistoricalRuntimeMigration(
  db: DbLike & Pick<typeof appDb, "transaction"> = appDb,
  deps: Readonly<{
    publisher: Pick<RuntimePublisher, "publish">;
    bindingService: Pick<
      LessonVersionRuntimeBindingService,
      "bindLessonVersionRuntime" | "markLessonVersionLegacyRuntime"
    >;
    legacyDecisions?: ReadonlyArray<LegacyDecision>;
  }>,
): Promise<MigrationResult> {
  const inventory = await classifyHistoricalLessonVersions(db, { legacyDecisions: deps.legacyDecisions });
  const htmlByTemplate = new Map<string, string>();
  const rows = await loadVersionRows(db as DbLike);
  for (const row of rows) {
    if (row.templateId && row.templateHtmlPlayer !== null && !htmlByTemplate.has(row.templateId)) {
      htmlByTemplate.set(row.templateId, row.templateHtmlPlayer);
    }
  }

  const publishedTemplateIds: string[] = [];
  const boundVersionIds: string[] = [];
  const legacyVersionIds: string[] = [];
  const decisionReason = new Map((deps.legacyDecisions ?? []).map((d) => [d.lessonVersionId, d.reason]));

  const publishForTemplate = async (templateId: string) => {
    const htmlPlayer = htmlByTemplate.get(templateId);
    if (htmlPlayer === undefined) throw new Error(`player bytes missing for template ${templateId}`);
    const packageInput: PublishRuntimeInput = {
      files: { "index.html": htmlPlayer },
      entryPoint: "index.html",
      capabilities: ["lesson-data"],
      sourceTemplateId: templateId,
    };
    // Idempotency key is stable per template: reruns reuse the same
    // publication attempt and the content-addressed identity dedupes storage.
    await deps.publisher.publish(packageInput, `${HISTORICAL_BACKFILL_IDEMPOTENCY_PREFIX}${templateId}`);
    publishedTemplateIds.push(templateId);
    return canonicalizePackage(packageInput).identity;
  };

  const published = new Map<string, string>(); // templateId → identity
  for (const entry of inventory.entries) {
    if (entry.classification !== "bound-candidate" && entry.classification !== "legacy-decision") continue;
    if (!entry.templateId) continue;
    let identity = published.get(entry.templateId);
    if (!identity) {
      identity = await publishForTemplate(entry.templateId);
      published.set(entry.templateId, identity);
    }

    if (entry.classification === "bound-candidate") {
      await deps.bindingService.bindLessonVersionRuntime({
        lessonVersionId: entry.lessonVersionId,
        runtimeIdentity: identity,
        actorUserId: null,
      });
      boundVersionIds.push(entry.lessonVersionId);
    } else {
      const reason = decisionReason.get(entry.lessonVersionId);
      if (!reason || reason.trim().length === 0) {
        throw new Error(`legacy decision for ${entry.lessonVersionId} lacks a reason; refusing to guess`);
      }
      await deps.bindingService.markLessonVersionLegacyRuntime({
        lessonVersionId: entry.lessonVersionId,
        runtimeIdentity: identity,
        reason,
        actorUserId: null,
      });
      legacyVersionIds.push(entry.lessonVersionId);
    }
  }

  return {
    publishedTemplateIds: [...published.keys()],
    boundVersionIds,
    legacyVersionIds,
    unchanged: inventory.totalVersions - boundVersionIds.length - legacyVersionIds.length,
  };
}

// Kept for callers that need the inventory query pieces (e.g. reporting tools).
export { loadVersionRows as loadHistoricalVersionRows };
