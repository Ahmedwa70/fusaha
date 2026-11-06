// Module-resolution hooks for the play-frame route HTTP tests. Plain Node
// ESM cannot resolve "next/server" (package-exports map is bundler-oriented),
// and the route's data boundaries (auth DAL, play queries) are replaced with
// in-file fakes so the route's own HTTP contract is what is under test here:
// status codes, headers, and the composed body. The real wiring of those
// boundaries is covered by lesson-play-queries.test.ts and
// lesson-play-cutover.test.ts against a real database.

/** @param {string} specifier @param {any} context @param {(s: string, c: any) => any} nextResolve */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/server") {
    return { url: new URL("./next-server-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "server-only") {
    return { url: new URL("./server-only-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/auth/dal") {
    return { url: new URL("./route-test-auth-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier === "@/lib/dashboard/queries/lesson") {
    return { url: new URL("./route-test-queries-stub.mjs", import.meta.url).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    // Repo-root alias (compose-player-html is pure and runs as-is).
    return { url: new URL("../../../../../../" + specifier.slice(2) + ".ts", import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
