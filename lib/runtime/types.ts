export const RUNTIME_CONTRACT_VERSION = "1.0" as const;

export type RuntimePackageKind = "single-file" | "multi-file";

export type RuntimeCapability = "lesson-data" | "external-assets" | "post-message";

export type RuntimeAsset = {
  readonly path: string;
  readonly contentType: string;
  readonly integrity: `sha256-${string}`;
  readonly sizeBytes?: number;
};

export type RuntimeManifest = {
  readonly contractVersion: typeof RUNTIME_CONTRACT_VERSION;
  readonly runtimeId: string;
  readonly runtimeVersion: string;
  readonly packageKind: RuntimePackageKind;
  readonly entryPoint: string;
  readonly capabilities: readonly RuntimeCapability[];
  readonly assets: readonly RuntimeAsset[];
  readonly metadata?: Readonly<Record<string, string>>;
};

export type RuntimePackage = {
  readonly manifest: RuntimeManifest;
  readonly files: Readonly<Record<string, string>>;
};

export type RuntimeLessonData = Readonly<{
  readonly content: unknown;
  readonly lessonVersionId?: string;
}>;

export type RuntimeAdapterInput = Readonly<{
  readonly runtimeId: string;
  readonly runtimeVersion: string;
  readonly htmlPlayer: string;
  readonly capabilities?: readonly RuntimeCapability[];
  readonly metadata?: Readonly<Record<string, string>>;
}>;

export type RuntimeAdapter = {
  readonly kind: RuntimePackageKind;
  readonly createPackage: (input: RuntimeAdapterInput) => RuntimePackage;
  readonly validate: (runtime: RuntimePackage) => RuntimeValidationResult;
};

export type RuntimeValidationIssue = Readonly<{
  readonly code:
    | "empty-entry-point"
    | "missing-entry-point"
    | "invalid-contract-version"
    | "invalid-runtime-id"
    | "invalid-runtime-version"
    | "unsupported-capability"
    | "missing-asset"
    | "asset-not-in-package";
  readonly message: string;
  readonly path: string;
}>;

export type RuntimeValidationResult = Readonly<{
  readonly valid: boolean;
  readonly errors: readonly RuntimeValidationIssue[];
}>;
