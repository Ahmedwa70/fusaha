// Resolve hooks for the dashboard action tests: swap auth, cache, i18n,
// audit, schema and db for controllable stubs so permission rejection and
// input validation can be proven without a database.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/auth/dal") {
    return { url: new URL("./test-stubs/dal-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/constants/permissions") {
    return { url: new URL("./test-stubs/permissions-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "next/cache") {
    return { url: new URL("./test-stubs/next-cache-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "next-intl/server") {
    return { url: new URL("./test-stubs/next-intl-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/admin/audit-log") {
    return { url: new URL("./test-stubs/audit-log-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/db") {
    return { url: new URL("./test-stubs/select-recorder.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/database/schema") {
    return { url: new URL("./test-stubs/admin-schema-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/i18n/config") {
    return { url: new URL("./test-stubs/i18n-config-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/validation/library-books") {
    return { url: new URL("../validation/library-books.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/library/admin-queries") {
    return { url: new URL("../lib/library/admin-queries.ts", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
