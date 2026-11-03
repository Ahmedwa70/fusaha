// Module-resolution hooks for the DB-backed binding tests (same pattern as
// lib/db/index.test-hooks.mjs). Plain Node cannot resolve the "@/..." tsconfig
// aliases, and two schema modules pull alias-only imports that the full barrel
// would drag in. We redirect the barrel to a small re-export of the real,
// alias-free schema modules, stand in a minimal schema_definitions table (the
// real one imports "@/i18n/config"), and stub "@/lib/db" — the service under
// test receives a real injected drizzle instance, so the default appDb is never
// touched here.

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: new URL("./server-only-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/db") {
    return { url: new URL("./runtime-binding-db-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/logger") {
    // The real logger (pino works under plain Node; its "server-only" import
    // is redirected to the no-op stub above).
    return { url: new URL("../logger.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/database/schema") {
    return { url: new URL("./runtime-binding-schema-stub.mjs", import.meta.url).href, shortCircuit: true };
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
    // The repo's TS modules use bundler-style extensionless relative imports
    // ("./enums", "./lesson-version-runtime-binding"). Plain Node ESM requires
    // the explicit ".ts" — retry with the extension appended when the bare
    // resolution fails inside a TypeScript module.
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
