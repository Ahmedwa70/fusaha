// Resolve hooks for viewer-access tests: give viewer.ts a controllable auth
// dal and book-files layer while keeping the REAL access policy in the loop.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/auth/dal") {
    return { url: new URL("./test-stubs/auth-dal-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/constants/permissions") {
    return { url: new URL("./test-stubs/permissions-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "./book-files" && context.parentURL?.endsWith("/lib/library/viewer.ts")) {
    return { url: new URL("./test-stubs/book-files-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  // Same tolerance the app bundler has: extensionless relative imports.
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  if (isRelative && !/\.[a-z0-9]+$/i.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // fall through to the default error
    }
  }
  return nextResolve(specifier, context);
}
