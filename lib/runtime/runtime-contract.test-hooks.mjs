import { access } from "node:fs/promises";

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith(".") && context.parentURL?.includes("/lib/runtime/")) {
    const candidate = new URL(specifier + ".ts", context.parentURL);
    try {
      await access(candidate);
      return nextResolve(candidate.href, context);
    } catch {
      // Let Node resolve the original specifier and report its normal error.
    }
  }

  return nextResolve(specifier, context);
}
