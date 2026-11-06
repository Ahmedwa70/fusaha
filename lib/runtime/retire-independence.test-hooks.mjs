// Module-resolution hooks for the retire-independence tests. Same pattern as
// lesson-version-runtime-binding.test-hooks.mjs, extended for the actions
// modules under test: framework and app-alias imports the server actions pull
// are redirected to dependency-free stubs, while the db goes through an
// injectable proxy so the actions run against the real Staging database.

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: new URL("./server-only-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/db") {
    return { url: new URL("./retire-test-db-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/auth/dal") {
    return { url: new URL("./retire-test-auth-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (
    specifier === "next/cache" ||
    specifier === "next-intl/server" ||
    specifier === "@trigger.dev/sdk" ||
    specifier === "@/constants/permissions" ||
    specifier === "@/constants/routes" ||
    specifier === "@/constants/lesson-source-limits" ||
    specifier === "@/lib/admin/settings" ||
    specifier === "@/validation/schema-definitions" ||
    specifier === "@/validation/templates" ||
    specifier === "@/lib/ai/extract-file-text"
  ) {
    return { url: new URL("./retire-test-stubs.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/logger") {
    return { url: new URL("../logger.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/admin/audit-log") {
    // Real audit writer — it goes through the injected db proxy, so retire
    // actions genuinely record audit rows on Staging.
    return { url: new URL("../admin/audit-log.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/templates/run-validation") {
    return { url: new URL("../templates/run-validation.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/templates/bundle-zip") {
    return { url: new URL("../templates/bundle-zip.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/admin/queries/schema-definition") {
    return { url: new URL("../admin/queries/schema-definition.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/admin/queries/template") {
    return { url: new URL("../admin/queries/template.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/lesson-levels") {
    return { url: new URL("../lesson-levels.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/database/schema") {
    return { url: new URL("./retire-test-schema-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (
    (specifier === "./schema-definitions" || specifier.endsWith("/schema-definitions")) &&
    context.parentURL?.includes("/database/schema/")
  ) {
    return { url: new URL("./schema-definitions-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isTsRelative =
      specifier.startsWith("./") &&
      !specifier.endsWith(".ts") &&
      context.parentURL?.endsWith(".ts");
    if (isTsRelative && error?.code === "ERR_MODULE_NOT_FOUND") {
      return { url: new URL(`${specifier}.ts`, context.parentURL).href, shortCircuit: true };
    }
    throw error;
  }
}
