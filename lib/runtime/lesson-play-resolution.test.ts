// Unit tests for the central Phase 4 play resolver. All storage and binding
// boundaries are injected fakes — the decision logic (flag behavior, blocked
// states, fallback observability, rollback) is what is under test here. The
// real-database proof lives in lesson-play-cutover.test.ts.

import assert from "node:assert/strict";
import { register } from "node:module";
import { describe, test } from "node:test";

register(new URL("./lesson-version-runtime-binding.test-hooks.mjs", import.meta.url).href);

const { assemblePlayableLesson } = await import("./lesson-play-resolution.ts" as string);
const { LessonVersionRuntimeBindingError } = await import("./lesson-version-runtime-binding.ts" as string);
const { RuntimeEntryContentError } = await import("./runtime-entry-content.ts" as string);

type FakeResolution =
  | { mode: "bound" | "legacy"; lessonVersionId: string; runtimeVersionId: string; runtimeIdentity: string; entryPoint: string; manifest: unknown }
  | { mode: "template-fallback"; lessonVersionId: string };

function bindingError(code: string): Error {
  return new LessonVersionRuntimeBindingError(code, code);
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    name: "lesson",
    content: { words: ["a"] },
    lessonVersionId: "lv-1",
    fetchTemplateHtmlPlayer: async () => "<template-html>",
    ...overrides,
  };
}

describe("assemblePlayableLesson — decision table", () => {
  test("flag off: uses the legacy template fetch, never touches the resolver or reader", async () => {
    let resolverCalls = 0;
    let readerCalls = 0;
    const result = await assemblePlayableLesson(input(), {
      isEnabled: () => false,
      resolveRuntime: async () => {
        resolverCalls += 1;
        throw new Error("resolver must not be called when the flag is off");
      },
      readRuntimeEntry: async () => {
        readerCalls += 1;
        throw new Error("reader must not be called when the flag is off");
      },
    });
    assert.deepEqual(result, { name: "lesson", content: { words: ["a"] }, htmlPlayer: "<template-html>", source: "template" });
    assert.equal(resolverCalls, 0);
    assert.equal(readerCalls, 0);
  });

  test("flag off with no linked template: null (preserves pre-cutover 404 semantics)", async () => {
    const result = await assemblePlayableLesson(input({ fetchTemplateHtmlPlayer: async () => null }), {
      isEnabled: () => false,
    });
    assert.equal(result, null);
  });

  test("flag on + Bound: serves runtime entry bytes and never fetches the template", async () => {
    let templateCalls = 0;
    const result = await assemblePlayableLesson(
      input({
        fetchTemplateHtmlPlayer: async () => {
          templateCalls += 1;
          return "<mutable-template>";
        },
      }),
      {
        isEnabled: () => true,
        resolveRuntime: async () => ({ mode: "bound", lessonVersionId: "lv-1", runtimeVersionId: "rv-1", runtimeIdentity: "sha256-v1-x", entryPoint: "index.html", manifest: {} }),
        readRuntimeEntry: async (runtimeVersionId: string) => {
          assert.equal(runtimeVersionId, "rv-1");
          return { html: "<immutable-runtime-html>" };
        },
      }
    );
    assert.deepEqual(result, { name: "lesson", content: { words: ["a"] }, htmlPlayer: "<immutable-runtime-html>", source: "runtime" });
    assert.equal(templateCalls, 0);
  });

  test("flag on + Legacy: same runtime path", async () => {
    const result = await assemblePlayableLesson(input(), {
      isEnabled: () => true,
      resolveRuntime: async () => ({ mode: "legacy", lessonVersionId: "lv-1", runtimeVersionId: "rv-9", runtimeIdentity: "sha256-v1-y", entryPoint: "index.html", manifest: {} }),
      readRuntimeEntry: async () => ({ html: "<legacy-snapshot-html>" }),
    });
    assert.equal(result?.source, "runtime");
    assert.equal(result?.htmlPlayer, "<legacy-snapshot-html>");
  });

  test("flag on + Unbound: explicit template fallback (observable, not silent)", async () => {
    const result = await assemblePlayableLesson(input(), {
      isEnabled: () => true,
      resolveRuntime: async () => ({ mode: "template-fallback", lessonVersionId: "lv-1" }),
      readRuntimeEntry: async () => {
        throw new Error("reader must not be called for unbound versions");
      },
    });
    assert.deepEqual(result, { name: "lesson", content: { words: ["a"] }, htmlPlayer: "<template-html>", source: "template" });
  });

  test("flag on + Quarantined: fail closed — null and no template fallback", async () => {
    let templateCalls = 0;
    const result = await assemblePlayableLesson(
      input({ fetchTemplateHtmlPlayer: async () => { templateCalls += 1; return "<template>"; } }),
      {
        isEnabled: () => true,
        resolveRuntime: async () => { throw bindingError("lesson-version-quarantined"); },
      }
    );
    assert.equal(result, null);
    assert.equal(templateCalls, 0);
  });

  test("flag on + Unrecoverable: fail closed — null and no template fallback", async () => {
    let templateCalls = 0;
    const result = await assemblePlayableLesson(
      input({ fetchTemplateHtmlPlayer: async () => { templateCalls += 1; return "<template>"; } }),
      {
        isEnabled: () => true,
        resolveRuntime: async () => { throw bindingError("lesson-version-unrecoverable"); },
      }
    );
    assert.equal(result, null);
    assert.equal(templateCalls, 0);
  });

  test("flag on + resolution errors (missing/deleted/integrity): fail closed with null", async () => {
    for (const code of ["lesson-version-not-found", "lesson-version-deleted", "runtime-integrity-violation"]) {
      const result = await assemblePlayableLesson(input(), {
        isEnabled: () => true,
        resolveRuntime: async () => { throw bindingError(code); },
      });
      assert.equal(result, null, `expected null for ${code}`);
    }
  });

  test("flag on + runtime content contract error: fail closed with null", async () => {
    const result = await assemblePlayableLesson(input(), {
      isEnabled: () => true,
      resolveRuntime: async () => ({ mode: "bound", lessonVersionId: "lv-1", runtimeVersionId: "rv-1", runtimeIdentity: "i", entryPoint: "index.html", manifest: {} }),
      readRuntimeEntry: async () => {
        throw new RuntimeEntryContentError("unconfigured", "runtime-content-reader-unconfigured");
      },
    });
    assert.equal(result, null);
  });

  test("flag on + unexpected reader error: propagates (not swallowed)", async () => {
    await assert.rejects(
      () =>
        assemblePlayableLesson(input(), {
          isEnabled: () => true,
          resolveRuntime: async () => ({ mode: "bound", lessonVersionId: "lv-1", runtimeVersionId: "rv-1", runtimeIdentity: "i", entryPoint: "index.html", manifest: {} }),
          readRuntimeEntry: async () => {
            throw new TypeError("programming error");
          },
        }),
      TypeError
    );
  });

  test("rollback: same bound version flips back to template when the flag is disabled", async () => {
    const enabled = { current: true };
    const resolveRuntime = async () => ({ mode: "bound" as const, lessonVersionId: "lv-1", runtimeVersionId: "rv-1", runtimeIdentity: "i", entryPoint: "index.html", manifest: {} });
    const readRuntimeEntry = async () => ({ html: "<runtime-html>" });

    const on = await assemblePlayableLesson(input(), { isEnabled: () => enabled.current, resolveRuntime, readRuntimeEntry });
    assert.equal(on?.source, "runtime");

    enabled.current = false; // rollback — no migration, no data change
    const off = await assemblePlayableLesson(input(), { isEnabled: () => enabled.current, resolveRuntime, readRuntimeEntry });
    assert.equal(off?.source, "template");
    assert.equal(off?.htmlPlayer, "<template-html>");
  });

  test("no cross-talk: each call resolves only its own lesson version", async () => {
    const seen: string[] = [];
    await assemblePlayableLesson(input({ lessonVersionId: "lv-A" }), {
      isEnabled: () => true,
      resolveRuntime: async (id: string) => {
        seen.push(id);
        return { mode: "template-fallback", lessonVersionId: id };
      },
    });
    await assemblePlayableLesson(input({ lessonVersionId: "lv-B", fetchTemplateHtmlPlayer: async () => "<other>" }), {
      isEnabled: () => true,
      resolveRuntime: async (id: string) => {
        seen.push(id);
        return { mode: "template-fallback", lessonVersionId: id };
      },
    });
    assert.deepEqual(seen, ["lv-A", "lv-B"]);
  });
});
