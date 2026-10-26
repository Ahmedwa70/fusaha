export async function resolve(specifier, context, nextResolve) {
  if (specifier === "@/database/schema") {
    return { url: new URL("./db-schema-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
