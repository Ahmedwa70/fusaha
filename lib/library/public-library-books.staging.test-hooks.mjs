export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/database/schema") {
    return { url: new URL("../../database/schema/library-books.ts", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/db") {
    return { url: new URL("./test-stubs/staging-db.mjs", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
