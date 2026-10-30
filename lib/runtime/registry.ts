import { createHash } from "node:crypto";

import { getRuntimeIdentity } from "./hash";
import { validateRuntimePackage } from "./manifest";
import type { RuntimePackage, RuntimeValidationIssue } from "./types";

export type RuntimeIdentity = `sha256-${string}`;

export type StoredRuntimePackage = Readonly<{
  readonly identity: RuntimeIdentity;
  readonly package: RuntimePackage;
}>;

export interface RuntimePackageStore {
  get(identity: RuntimeIdentity): RuntimePackage | undefined;
  put(identity: RuntimeIdentity, runtime: RuntimePackage): void;
}

export class RuntimePackageError extends Error {
  readonly code: RuntimePackageErrorCode;

  constructor(message: string, code: RuntimePackageErrorCode) {
    super(message);
    this.name = "RuntimePackageError";
    this.code = code;
  }
}

export type RuntimePackageErrorCode =
  | "invalid-package"
  | "identity-mismatch"
  | "runtime-not-found"
  | "runtime-corrupted"
  | "runtime-identity-conflict";

export class InMemoryRuntimePackageStore implements RuntimePackageStore {
  private readonly packages = new Map<RuntimeIdentity, RuntimePackage>();

  get(identity: RuntimeIdentity): RuntimePackage | undefined {
    const runtime = this.packages.get(identity);
    return runtime ? cloneRuntimePackage(runtime) : undefined;
  }

  put(identity: RuntimeIdentity, runtime: RuntimePackage): void {
    if (this.packages.has(identity)) {
      throw new RuntimePackageError(
        `Runtime identity is immutable and already registered: ${identity}`,
        "runtime-identity-conflict"
      );
    }

    this.packages.set(identity, cloneRuntimePackage(runtime));
  }
}

export class RuntimePackageRegistry {
  private readonly store: RuntimePackageStore;

  constructor(store: RuntimePackageStore = new InMemoryRuntimePackageStore()) {
    this.store = store;
  }

  register(runtime: RuntimePackage): StoredRuntimePackage {
    const validation = validateRuntimePackageWithAssetIntegrity(runtime);
    if (!validation.valid) {
      throw new RuntimePackageError(formatValidationErrors(validation.errors), "invalid-package");
    }

    const identity = getRuntimeIdentity(runtime);
    const existing = this.store.get(identity);
    if (existing) {
      this.assertIntegrity(identity, existing);
      return { identity, package: existing };
    }

    this.store.put(identity, runtime);
    const registered = this.store.get(identity);
    if (!registered) {
      throw new RuntimePackageError(`Runtime package was not available after registration: ${identity}`, "runtime-not-found");
    }

    this.assertIntegrity(identity, registered);
    return { identity, package: registered };
  }

  get(identity: RuntimeIdentity): StoredRuntimePackage {
    const runtime = this.store.get(identity);
    if (!runtime) {
      throw new RuntimePackageError(`Runtime package was not found: ${identity}`, "runtime-not-found");
    }

    this.assertIntegrity(identity, runtime);
    return { identity, package: runtime };
  }

  has(identity: RuntimeIdentity): boolean {
    const runtime = this.store.get(identity);
    if (!runtime) return false;
    this.assertIntegrity(identity, runtime);
    return true;
  }

  private assertIntegrity(identity: RuntimeIdentity, runtime: RuntimePackage): void {
    const actualIdentity = getRuntimeIdentity(runtime);
    if (actualIdentity !== identity) {
      throw new RuntimePackageError(
        `Runtime package integrity check failed for ${identity}; calculated ${actualIdentity}.`,
        "runtime-corrupted"
      );
    }
  }
}

function validateRuntimePackageWithAssetIntegrity(runtime: RuntimePackage) {
  const result = validateRuntimePackage(runtime);
  const errors: RuntimeValidationIssue[] = [...result.errors];

  for (const [index, asset] of runtime.manifest.assets.entries()) {
    const content = runtime.files[asset.path];
    if (content === undefined) continue;

    const actualIntegrity = `sha256-${createHash("sha256").update(content).digest("hex")}`;
    if (actualIntegrity !== asset.integrity) {
      errors.push({
        code: "asset-integrity-mismatch",
        message: `Asset integrity does not match package content: ${asset.path}`,
        path: `manifest.assets[${index}].integrity`,
      });
    }

    if (asset.sizeBytes !== undefined && Buffer.byteLength(content, "utf8") !== asset.sizeBytes) {
      errors.push({
        code: "asset-size-mismatch",
        message: `Asset size does not match package content: ${asset.path}`,
        path: `manifest.assets[${index}].sizeBytes`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function formatValidationErrors(errors: readonly RuntimeValidationIssue[]): string {
  return `Runtime package validation failed: ${errors.map((error) => `${error.path}: ${error.message}`).join("; ")}`;
}

function cloneRuntimePackage(runtime: RuntimePackage): RuntimePackage {
  return {
    manifest: {
      ...runtime.manifest,
      assets: runtime.manifest.assets.map((asset) => ({ ...asset })),
      capabilities: [...runtime.manifest.capabilities],
      ...(runtime.manifest.metadata ? { metadata: { ...runtime.manifest.metadata } } : {}),
    },
    files: { ...runtime.files },
  };
}
