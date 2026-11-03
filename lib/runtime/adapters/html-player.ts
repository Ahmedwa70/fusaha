import { getRuntimeIdentity } from "../hash";
import { validateRuntimePackage } from "../manifest";
import { RUNTIME_CONTRACT_VERSION, type RuntimeAdapter, type RuntimePackage } from "../types";

export const htmlPlayerAdapter: RuntimeAdapter = {
  kind: "single-file",

  createPackage(input): RuntimePackage {
    const manifest = {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      runtimeId: input.runtimeId,
      runtimeVersion: input.runtimeVersion,
      packageKind: "single-file" as const,
      entryPoint: "index.html",
      capabilities: input.capabilities ?? ["lesson-data" as const],
      assets: [],
      ...(input.metadata ? { metadata: input.metadata } : {}),
    };

    return {
      manifest,
      files: { "index.html": input.htmlPlayer },
    };
  },

  validate(runtime): ReturnType<typeof validateRuntimePackage> {
    return validateRuntimePackage(runtime);
  },
};

export function getHtmlPlayerRuntimeIdentity(input: Parameters<typeof htmlPlayerAdapter.createPackage>[0]): `sha256-${string}` {
  return getRuntimeIdentity(htmlPlayerAdapter.createPackage(input));
}
