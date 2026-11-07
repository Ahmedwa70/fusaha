// Dev-tool resolver: lets plain `node --experimental-transform-types` load
// the app's relative imports that omit the .ts extension (the Next.js
// bundler tolerates those, raw Node does not). Used only by local scripts.
export async function resolve(specifier, context, nextResolve) {
  const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
  const hasExtension = /\.[a-z0-9]+$/i.test(specifier);
  if (isRelative && !hasExtension) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // fall through to the default error
    }
  }
  return nextResolve(specifier, context);
}
