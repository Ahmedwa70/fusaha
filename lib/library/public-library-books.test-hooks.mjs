export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/database/schema") {
    return { url: new URL("./test-stubs/library-books-schema.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/db") {
    return { url: new URL("./test-stubs/db-recorder.mjs", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
