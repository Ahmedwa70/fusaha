import { RuntimePackageError, RuntimePackageRegistry, type RuntimeIdentity } from "./registry";
import { RUNTIME_CONTRACT_VERSION } from "./types";

export type LessonVersionId = string;
export type LessonVersionBindingStatus = "bound" | "legacy-unbound";

export type LessonVersionRuntimeBinding = Readonly<{
  readonly lessonVersionId: LessonVersionId;
  readonly status: LessonVersionBindingStatus;
  readonly runtimeIdentity?: RuntimeIdentity;
  readonly contractVersion?: typeof RUNTIME_CONTRACT_VERSION;
  readonly reason?: string;
}>;

export interface LessonVersionRuntimeBindingStore {
  get(lessonVersionId: LessonVersionId): LessonVersionRuntimeBinding | undefined;
  put(lessonVersionId: LessonVersionId, binding: LessonVersionRuntimeBinding): void;
}

export class InMemoryLessonVersionRuntimeBindingStore implements LessonVersionRuntimeBindingStore {
  private readonly bindings = new Map<LessonVersionId, LessonVersionRuntimeBinding>();

  get(lessonVersionId: LessonVersionId): LessonVersionRuntimeBinding | undefined {
    const binding = this.bindings.get(lessonVersionId);
    return binding ? { ...binding } : undefined;
  }

  put(lessonVersionId: LessonVersionId, binding: LessonVersionRuntimeBinding): void {
    if (this.bindings.has(lessonVersionId)) {
      throw new LessonVersionBindingError(
        `Lesson version runtime binding is immutable: ${lessonVersionId}`,
        "binding-already-established"
      );
    }

    this.bindings.set(lessonVersionId, { ...binding });
  }
}

export class LessonVersionBindingError extends Error {
  readonly code: LessonVersionBindingErrorCode;

  constructor(message: string, code: LessonVersionBindingErrorCode) {
    super(message);
    this.name = "LessonVersionBindingError";
    this.code = code;
  }
}

export type LessonVersionBindingErrorCode =
  | "invalid-lesson-version-id"
  | "missing-runtime-identity"
  | "runtime-not-found"
  | "runtime-integrity-failure"
  | "contract-version-mismatch"
  | "binding-already-established"
  | "invalid-legacy-reason";

export class LessonVersionRuntimeBindingService {
  private readonly store: LessonVersionRuntimeBindingStore;
  private readonly registry: RuntimePackageRegistry;

  constructor(
    store: LessonVersionRuntimeBindingStore = new InMemoryLessonVersionRuntimeBindingStore(),
    registry: RuntimePackageRegistry = new RuntimePackageRegistry()
  ) {
    this.store = store;
    this.registry = registry;
  }

  bind(
    lessonVersionId: LessonVersionId,
    runtimeIdentity: RuntimeIdentity,
    expectedContractVersion: typeof RUNTIME_CONTRACT_VERSION = RUNTIME_CONTRACT_VERSION
  ): LessonVersionRuntimeBinding {
    this.assertLessonVersionId(lessonVersionId);
    if (!runtimeIdentity?.trim()) {
      throw new LessonVersionBindingError("A runtime identity is required.", "missing-runtime-identity");
    }

    const runtime = this.getRuntime(runtimeIdentity);
    if (runtime.package.manifest.contractVersion !== expectedContractVersion) {
      throw new LessonVersionBindingError(
        `Runtime contract version ${runtime.package.manifest.contractVersion} does not match expected ${expectedContractVersion}.`,
        "contract-version-mismatch"
      );
    }

    const existing = this.store.get(lessonVersionId);
    if (existing) {
      if (
        existing.status === "bound" &&
        existing.runtimeIdentity === runtimeIdentity &&
        existing.contractVersion === expectedContractVersion
      ) {
        return { ...existing };
      }

      throw new LessonVersionBindingError(
        `Lesson version already has an immutable runtime binding: ${lessonVersionId}`,
        "binding-already-established"
      );
    }

    const binding: LessonVersionRuntimeBinding = {
      lessonVersionId,
      status: "bound",
      runtimeIdentity,
      contractVersion: expectedContractVersion,
    };
    this.store.put(lessonVersionId, binding);
    return { ...binding };
  }

  markLegacyUnbound(lessonVersionId: LessonVersionId, reason: string): LessonVersionRuntimeBinding {
    this.assertLessonVersionId(lessonVersionId);
    if (!reason.trim()) {
      throw new LessonVersionBindingError("A legacy binding reason is required.", "invalid-legacy-reason");
    }

    const existing = this.store.get(lessonVersionId);
    if (existing) {
      throw new LessonVersionBindingError(
        `Lesson version already has a runtime binding state: ${lessonVersionId}`,
        "binding-already-established"
      );
    }

    const binding: LessonVersionRuntimeBinding = {
      lessonVersionId,
      status: "legacy-unbound",
      reason: reason.trim(),
    };
    this.store.put(lessonVersionId, binding);
    return { ...binding };
  }

  get(lessonVersionId: LessonVersionId): LessonVersionRuntimeBinding | undefined {
    this.assertLessonVersionId(lessonVersionId);
    const binding = this.store.get(lessonVersionId);
    return binding ? { ...binding } : undefined;
  }

  resolveRuntime(lessonVersionId: LessonVersionId) {
    const binding = this.get(lessonVersionId);
    if (!binding || binding.status === "legacy-unbound" || !binding.runtimeIdentity) {
      return { binding, runtime: undefined } as const;
    }

    return { binding, runtime: this.getRuntime(binding.runtimeIdentity) } as const;
  }

  private getRuntime(runtimeIdentity: RuntimeIdentity) {
    try {
      return this.registry.get(runtimeIdentity);
    } catch (error) {
      if (error instanceof RuntimePackageError && error.code === "runtime-not-found") {
        throw new LessonVersionBindingError(
          `Runtime identity does not exist: ${runtimeIdentity}`,
          "runtime-not-found"
        );
      }

      throw new LessonVersionBindingError(
        `Runtime identity failed integrity validation: ${runtimeIdentity}`,
        "runtime-integrity-failure"
      );
    }
  }

  private assertLessonVersionId(lessonVersionId: LessonVersionId): void {
    if (!lessonVersionId.trim()) {
      throw new LessonVersionBindingError("A lesson version ID is required.", "invalid-lesson-version-id");
    }
  }
}
