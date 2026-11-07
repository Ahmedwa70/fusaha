// Resolve hooks for the route access-guard tests: swap the access resolver
// and the R2 client for mutable stubs, and point the Range parser at the real
// implementation so byte-range behavior is exercised for genuine.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/library/viewer") {
    return { url: new URL("./test-stubs/viewer-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/library/storage/r2-client") {
    return { url: new URL("./test-stubs/r2-client-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/library/http-range") {
    return { url: new URL("../../../../lib/library/http-range.ts", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
