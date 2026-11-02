// Phase 8 operational readiness: a single READ-ONLY report of everything an
// operator needs to watch before and after cutover. Never writes. Covers the
// Phase 8 review list:
//   - abandoned publication attempts (non-final state + expired lease → the
//     publisher's recover() path can seize them),
//   - lease/expiry awareness (stale-lease rows are listed with their expiry),
//   - Failed attempt / Failed runtime / Quarantined / Unrecoverable states
//     (the monitoring surface),
//   - storage integrity (optional caller-supplied verifier — typically
//     publisher.verifyPublishedAssets — run per published runtime),
//   - feature flag state (rollback posture).
import { db as appDb } from "@/lib/db";
import {
  lessonVersions,
  runtimePublicationAttempts,
  runtimeVersions,
  RuntimeBindingStatus,
  RuntimePublicationAttemptState,
  RuntimeVersionState,
} from "@/database/schema";
import { isRuntimeResolverCutoverEnabled } from "./runtime-resolver-flag";

const NON_FINAL_ATTEMPT_STATES = [
  RuntimePublicationAttemptState.Created,
  RuntimePublicationAttemptState.Leased,
  RuntimePublicationAttemptState.Uploading,
  RuntimePublicationAttemptState.Verifying,
  RuntimePublicationAttemptState.Finalizing,
] as const;

export type StaleAttempt = Readonly<{
  attemptId: string;
  idempotencyKey: string;
  runtimeIdentity: string;
  state: RuntimePublicationAttemptState;
  leaseExpiresAt: Date | null;
  retryCount: number;
}>;

export type RuntimeOpsReport = Readonly<{
  generatedAt: string;
  flagEnabled: boolean;
  attempts: Readonly<{
    byState: Record<string, number>;
    stale: ReadonlyArray<StaleAttempt>;
    failed: ReadonlyArray<{ attemptId: string; idempotencyKey: string; lastErrorCode: string | null; retryCount: number }>;
  }>;
  runtimes: Readonly<{
    byState: Record<string, number>;
    failedIdentities: ReadonlyArray<string>;
  }>;
  versions: Readonly<Record<"bound" | "legacy" | "quarantined" | "unrecoverable" | "unbound", number>>;
  storageIntegrity: Readonly<{ checked: number; mismatches: ReadonlyArray<string> }> | Readonly<{ skipped: true }>;
}>;

export async function buildRuntimeOpsReport(
  options: Readonly<{
    db?: Pick<typeof appDb, "select">;
    now?: Date;
    isEnabled?: () => boolean;
    /** Optional integrity probe, e.g. (identity) => publisher.verifyPublishedAssets(identity). */
    verifyStorage?: (identity: string) => Promise<{ allOk: boolean }>;
  }> = {},
): Promise<RuntimeOpsReport> {
  const database = options.db ?? appDb;
  const now = options.now ?? new Date();
  const flagEnabled = options.isEnabled ?? isRuntimeResolverCutoverEnabled;

  const attemptRows = await database
    .select({
      id: runtimePublicationAttempts.id,
      idempotencyKey: runtimePublicationAttempts.idempotencyKey,
      runtimeIdentity: runtimePublicationAttempts.runtimeIdentity,
      state: runtimePublicationAttempts.state,
      leaseExpiresAt: runtimePublicationAttempts.leaseExpiresAt,
      retryCount: runtimePublicationAttempts.retryCount,
      lastErrorCode: runtimePublicationAttempts.lastErrorCode,
    })
    .from(runtimePublicationAttempts);

  const byState: Record<string, number> = {};
  const stale: StaleAttempt[] = [];
  const failed: Array<{ attemptId: string; idempotencyKey: string; lastErrorCode: string | null; retryCount: number }> = [];
  for (const row of attemptRows) {
    const key = RuntimePublicationAttemptState[row.state] ?? String(row.state);
    byState[key] = (byState[key] ?? 0) + 1;
    if ((NON_FINAL_ATTEMPT_STATES as readonly number[]).includes(row.state)) {
      // Non-final with an expired (or absent) lease is recoverable garbage a
      // retried publish (or explicit recovery) would seize and finish.
      if (row.leaseExpiresAt === null || row.leaseExpiresAt.getTime() < now.getTime()) {
        stale.push({
          attemptId: row.id,
          idempotencyKey: row.idempotencyKey,
          runtimeIdentity: row.runtimeIdentity,
          state: row.state,
          leaseExpiresAt: row.leaseExpiresAt,
          retryCount: row.retryCount,
        });
      }
    }
    if (row.state === RuntimePublicationAttemptState.Failed) {
      failed.push({ attemptId: row.id, idempotencyKey: row.idempotencyKey, lastErrorCode: row.lastErrorCode, retryCount: row.retryCount });
    }
  }

  const runtimeRows = await database
    .select({ identity: runtimeVersions.identity, state: runtimeVersions.state })
    .from(runtimeVersions);
  const runtimeByState: Record<string, number> = {};
  const failedIdentities: string[] = [];
  const publishedIdentities: string[] = [];
  for (const row of runtimeRows) {
    const key = RuntimeVersionState[row.state] ?? String(row.state);
    runtimeByState[key] = (runtimeByState[key] ?? 0) + 1;
    if (row.state === RuntimeVersionState.Failed) failedIdentities.push(row.identity);
    if (row.state === RuntimeVersionState.Published) publishedIdentities.push(row.identity);
  }

  const versionRows = await database
    .select({ bindingStatus: lessonVersions.runtimeBindingStatus })
    .from(lessonVersions);
  const versions: Record<"bound" | "legacy" | "quarantined" | "unrecoverable" | "unbound", number> = {
    bound: 0,
    legacy: 0,
    quarantined: 0,
    unrecoverable: 0,
    unbound: 0,
  };
  for (const row of versionRows) {
    if (row.bindingStatus === RuntimeBindingStatus.Bound) versions.bound += 1;
    else if (row.bindingStatus === RuntimeBindingStatus.Legacy) versions.legacy += 1;
    else if (row.bindingStatus === RuntimeBindingStatus.Quarantined) versions.quarantined += 1;
    else if (row.bindingStatus === RuntimeBindingStatus.Unrecoverable) versions.unrecoverable += 1;
    else versions.unbound += 1;
  }

  let storageIntegrity: RuntimeOpsReport["storageIntegrity"];
  if (options.verifyStorage) {
    const mismatches: string[] = [];
    let checked = 0;
    for (const identity of publishedIdentities) {
      checked += 1;
      const result = await options.verifyStorage(identity);
      if (!result.allOk) mismatches.push(identity);
    }
    storageIntegrity = { checked, mismatches };
  } else {
    storageIntegrity = { skipped: true };
  }

  return {
    generatedAt: now.toISOString(),
    flagEnabled: flagEnabled(),
    attempts: { byState, stale, failed },
    runtimes: { byState: runtimeByState, failedIdentities },
    versions,
    storageIntegrity,
  };
}
