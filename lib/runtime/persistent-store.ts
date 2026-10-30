import type { RuntimePackageStore, RuntimeIdentity } from "./registry";
import type { RuntimePackage } from "./types";

/**
 * Phase 4 contract for a real durable runtime package repository.
 *
 * This interface is deliberately not wired to DATABASE_URL or an external
 * service until an isolated staging environment and schema migration are
 * approved. Implementations must make putIfAbsent a single atomic operation.
 */
export interface PersistentRuntimePackageStore extends RuntimePackageStore {
  putIfAbsent(identity: RuntimeIdentity, runtime: RuntimePackage): boolean;
}

export type RuntimePackageRetentionPolicy = Readonly<{
  /** Runtime packages are never physically deleted while referenced. */
  readonly deleteOnlyWhenUnreferenced: true;
  /** Deletion is an explicit lifecycle operation, not part of registration. */
  readonly deletionRequiresApproval: true;
  /** Failed writes never become visible as complete packages. */
  readonly incompleteWritesAreInvisible: true;
}>;

export const DEFAULT_RUNTIME_PACKAGE_RETENTION_POLICY: RuntimePackageRetentionPolicy = {
  deleteOnlyWhenUnreferenced: true,
  deletionRequiresApproval: true,
  incompleteWritesAreInvisible: true,
};

export type PersistentRuntimeStoreFailure =
  | "write-conflict"
  | "incomplete-write"
  | "integrity-failure"
  | "not-found"
  | "storage-unavailable";

/**
 * Persistence implementations should satisfy this lifecycle:
 *
 * 1. Validate package and calculate identity before opening a write.
 * 2. Write manifest and all package files to an isolated temporary record.
 * 3. Verify every file, manifest, and calculated identity.
 * 4. Atomically publish one complete record with putIfAbsent.
 * 5. Remove the temporary record on failure; never expose it through get.
 *
 * A production implementation should use a database transaction or an
 * equivalent compare-and-swap primitive. It must not overwrite an existing
 * identity and should safely return the already-published package for an
 * identical concurrent registration.
 */
export const PERSISTENT_RUNTIME_STORE_CONTRACT = "runtime-package-store/v1" as const;
