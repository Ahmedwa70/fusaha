// Module-resolution hooks for the play-query regression tests (same pattern
// as lib/runtime/lesson-version-runtime-binding.test-hooks.mjs). Plain Node
// cannot resolve "@/..." tsconfig aliases; we redirect "@/lib/db" to a stub
// that builds a REAL drizzle instance over the disposable test database (the
// play queries have no injection point — they use the default appDb — so the
// stub is how the module under test reaches the disposable DB), stand in the
// same alias-free schema barrel the binding tests use, and stub the UI-only
// imports the module drags in (next-intl, level labels).
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: new URL("../../runtime/server-only-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/db") {
    return { url: new URL("./lesson-play-queries-db-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "next-intl/server") {
    return { url: new URL("./lesson-play-queries-intl-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/schema-definitions") {
    return { url: new URL("./lesson-play-queries-level-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/runtime/lesson-play-resolution") {
    return { url: new URL("../../runtime/lesson-play-resolution.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/logger") {
    return { url: new URL("../../runtime/../logger.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/templates/run-validation") {
    // The strict validator imported by the approval orchestrator; node
    // builtins only, so the real module runs as-is under plain Node.
    return { url: new URL("../../templates/run-validation.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/database/schema") {
    return { url: new URL("../../runtime/runtime-binding-schema-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (
    (specifier === "./schema-definitions" || specifier.endsWith("/schema-definitions")) &&
    context.parentURL?.includes("/database/schema/")
  ) {
    return { url: new URL("../../runtime/schema-definitions-stub.mjs", import.meta.url).href, shortCircuit: true };
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
