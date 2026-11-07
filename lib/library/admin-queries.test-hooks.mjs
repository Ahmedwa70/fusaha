// Resolve hooks for the admin-queries unit tests: real condition builders on
// a real-Drizzle schema stub; db is never queried (pure functions only).
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/database/schema") {
    return { url: new URL("./test-stubs/library-catalog-schema.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/db") {
    return { url: new URL("./test-stubs/db-recorder.mjs", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
