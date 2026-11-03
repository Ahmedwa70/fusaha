import {
  RUNTIME_CONTRACT_VERSION,
  type RuntimeManifest,
  type RuntimePackage,
  type RuntimeValidationIssue,
  type RuntimeValidationResult,
} from "./types";

const SUPPORTED_CAPABILITIES = new Set(["lesson-data", "external-assets", "post-message"]);

export function canonicalizeManifest(manifest: RuntimeManifest): string {
  return JSON.stringify({
    assets: [...manifest.assets]
      .map((asset) => ({
        contentType: asset.contentType,
        integrity: asset.integrity,
        path: asset.path,
        ...(asset.sizeBytes === undefined ? {} : { sizeBytes: asset.sizeBytes }),
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
    capabilities: [...manifest.capabilities].sort(),
    contractVersion: manifest.contractVersion,
    entryPoint: manifest.entryPoint,
    metadata: manifest.metadata ? sortRecord(manifest.metadata) : undefined,
    packageKind: manifest.packageKind,
    runtimeId: manifest.runtimeId,
    runtimeVersion: manifest.runtimeVersion,
  });
}

export function validateRuntimePackage(runtime: RuntimePackage): RuntimeValidationResult {
  const { manifest, files } = runtime;
  const errors: RuntimeValidationIssue[] = [];

  if (manifest.contractVersion !== RUNTIME_CONTRACT_VERSION) {
    errors.push({
      code: "invalid-contract-version",
      message: `Unsupported runtime contract version: ${manifest.contractVersion}`,
      path: "manifest.contractVersion",
    });
  }

  if (!manifest.runtimeId.trim()) {
    errors.push({ code: "invalid-runtime-id", message: "Runtime ID must not be empty.", path: "manifest.runtimeId" });
  }

  if (!manifest.runtimeVersion.trim()) {
    errors.push({
      code: "invalid-runtime-version",
      message: "Runtime version must not be empty.",
      path: "manifest.runtimeVersion",
    });
  }

  if (!manifest.entryPoint.trim()) {
    errors.push({ code: "empty-entry-point", message: "Entry point must not be empty.", path: "manifest.entryPoint" });
  } else if (!(manifest.entryPoint in files)) {
    errors.push({
      code: "missing-entry-point",
      message: `Entry point is not present in the package: ${manifest.entryPoint}`,
      path: "manifest.entryPoint",
    });
  }

  for (const [index, capability] of manifest.capabilities.entries()) {
    if (!SUPPORTED_CAPABILITIES.has(capability)) {
      errors.push({
        code: "unsupported-capability",
        message: `Unsupported runtime capability: ${capability}`,
        path: `manifest.capabilities[${index}]`,
      });
    }
  }

  for (const [index, asset] of manifest.assets.entries()) {
    if (!(asset.path in files)) {
      errors.push({
        code: "asset-not-in-package",
        message: `Manifest asset is not present in the package: ${asset.path}`,
        path: `manifest.assets[${index}].path`,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function sortRecord(record: Readonly<Record<string, string>>): Readonly<Record<string, string>> {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}
