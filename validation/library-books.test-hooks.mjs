// Resolve hooks for the library-books validation tests.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/i18n/config") {
    return { url: new URL("./test-stubs/i18n-config-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
