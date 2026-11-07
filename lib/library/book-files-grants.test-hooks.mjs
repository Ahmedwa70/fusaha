// Resolve hooks for the grant-scoping test: give book-files.ts a recording
// db and a minimal schema so the DELETE's WHERE clause can be inspected.
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/lib/db") {
    return { url: new URL("./test-stubs/delete-recorder.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/database/schema") {
    return { url: new URL("./test-stubs/library-files-schema.mjs", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
