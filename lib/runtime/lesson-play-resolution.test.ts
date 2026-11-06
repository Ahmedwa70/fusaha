// Unit tests for the central play resolver. All storage and binding
// boundaries are injected fakes — the decision logic (binding-driven
// resolution, blocked states, fallback observability, rollback) is what is
// under test here. The real-database proof lives in
// lesson-play-cutover.test.ts (resolver + real binding service) and
// lib/dashboard/queries/lesson-play-queries.test.ts (real play queries).

import assert from "node:assert/strict";
import { register } from "node:module";
import { describe, test } from "node:test";

register(new URL("./lesson-version-runtime-binding.test-hooks.mjs", import.meta.url).href);

const { RuntimeBindingStatus } = await import("@/database/schema");
const { assemblePlayableLesson } = await import("./lesson-play-resolution.ts" as string);
const { LessonVersionRuntimeBindingError } = await import("./lesson-version-runtime-binding.ts" as string);
const { RuntimeEntryContentError } = await import("./runtime-entry-content.ts" as string);

type FakeResolution =
  | { mode: "bound" | "legacy"; lessonVersionId: string; runtimeVersionId: string; runtimeIdentity: string; entryPoint: string; manifest: unknown }
  | { mode: "template-fallback"; lessonVersionId: string };

function bindingError(code: string): Error {
  return new LessonVersionRuntimeBindingError(code, code);
}

const UNBOUND = { status: RuntimeBindingStatus.Unbound, runtimeVersionId: null };
const BOUND = { status: RuntimeBindingStatus.Bound, runtimeVersionId: "rv-1" };

function input(overrides: Record<string, unknown> = {}) {
  return {
    name: "lesson",
    content: { words: ["a"] },
    lessonVersionId: "lv-1",
    runtimeBinding: BOUND,
    fetchTemplateHtmlPlayer: async () => "<template-html>",
    ...overrides,
  };
}

describe("assemblePlayableLesson — binding-driven decision table", () => {
  test("flag off + Unbound: legacy template fetch only, resolver never consulted", async () => {
    let resolverCalls = 0;
    let readerCalls = 0;
    const result = await assemblePlayableLesson(input({ runtimeBinding: UNBOUND }), {
      isEnabled: () => false,
      resolveRuntime: async () => {
        resolverCalls += 1;
        throw new Error("resolver must not be called for unbound rows when the flag is off");
      },
      readRuntimeEntry: async () => {
        readerCalls += 1;
        throw new Error("reader must not be called for unbound rows when the flag is off");
      },
    });
    assert.deepEqual(result, { name: "lesson", content: { words: ["a"] }, htmlPlayer: "<template-html>", source: "template" });
    assert.equal(resolverCalls, 0);
    assert.equal(readerCalls, 0);
  });

  test("flag off + Unbound with no linked template: null (pre-cutover 404 semantics)", async () => {
    const result = await assemblePlayableLesson(
      input({ runtimeBinding: UNBOUND, fetchTemplateHtmlPlayer: async () => null }),
      { isEnabled: () => false }
    );
    assert.equal(result, null);
  });

  test("flag off + Bound: serves runtime bytes, template fetch never consulted", async () => {
    let templateCalls = 0;
    const result = await assemblePlayableLesson(
      input({
        fetchTemplateHtmlPlayer: async () => {
          templateCalls += 1;
          return "<mutable-template>";
        },
      }),
      {
        isEnabled: () => false,
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

  test("PRODUCTION INCIDENT REGRESSION — flag off + Bound + template retired (fetcher null): runtime still served", async () => {
    // retireTemplate unlinks schema_definitions.template_id and deletes the
    // template row. With the flag off, the pre-fix code served ALL rows from
    // the template and 404'd here. A Bound row must resolve through its
    // runtime no matter what the template fetcher returns.
    const result = await assemblePlayableLesson(
      input({ fetchTemplateHtmlPlayer: async () => null }),
      {
        isEnabled: () => false,
        resolveRuntime: async () => ({ mode: "bound", lessonVersionId: "lv-1", runtimeVersionId: "rv-1", runtimeIdentity: "sha256-v1-x", entryPoint: "index.html", manifest: {} }),
        readRuntimeEntry: async () => ({ html: "<immutable-runtime-html>" }),
      }
    );
    assert.deepEqual(result, { name: "lesson", content: { words: ["a"] }, htmlPlayer: "<immutable-runtime-html>", source: "runtime" });
  });

  test("flag off + Legacy: runtime snapshot, same as flag on", async () => {
    const result = await assemblePlayableLesson(input({ runtimeBinding: { status: RuntimeBindingStatus.Legacy, runtimeVersionId: "rv-9" } }), {
      isEnabled: () => false,
      resolveRuntime: async () => ({ mode: "legacy", lessonVersionId: "lv-1", runtimeVersionId: "rv-9", runtimeIdentity: "sha256-v1-y", entryPoint: "index.html", manifest: {} }),
      readRuntimeEntry: async () => ({ html: "<legacy-snapshot-html>" }),
    });
    assert.equal(result?.source, "runtime");
    assert.equal(result?.htmlPlayer, "<legacy-snapshot-html>");
  });

  test("flag off + Quarantined: fail closed — no HTML even though a template exists", async () => {
    let templateCalls = 0;
    const result = await assemblePlayableLesson(
      input({
        runtimeBinding: { status: RuntimeBindingStatus.Quarantined, runtimeVersionId: null },
        fetchTemplateHtmlPlayer: async () => {
          templateCalls += 1;
          return "<template>";
        },
      }),
      {
        isEnabled: () => false,
        resolveRuntime: async () => { throw bindingError("lesson-version-quarantined"); },
      }
    );
    assert.equal(result, null);
    assert.equal(templateCalls, 0);
  });

  test("flag off + Unrecoverable: fail closed", async () => {
    const result = await assemblePlayableLesson(
      input({ runtimeBinding: { status: RuntimeBindingStatus.Unrecoverable, runtimeVersionId: null } }),
      {
        isEnabled: () => false,
        resolveRuntime: async () => { throw bindingError("lesson-version-unrecoverable"); },
      }
    );
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
    const result = await assemblePlayableLesson(input({ runtimeBinding: UNBOUND }), {
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
      input({
        runtimeBinding: { status: RuntimeBindingStatus.Quarantined, runtimeVersionId: null },
        fetchTemplateHtmlPlayer: async () => { templateCalls += 1; return "<template>"; },
      }),
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
      input({
        runtimeBinding: { status: RuntimeBindingStatus.Unrecoverable, runtimeVersionId: null },
        fetchTemplateHtmlPlayer: async () => { templateCalls += 1; return "<template>"; },
      }),
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

  test("rollback contract: flag off keeps Unbound rows legacy AND keeps Bound rows on runtime", async () => {
    const resolveRuntime = async () => ({ mode: "bound" as const, lessonVersionId: "lv-1", runtimeVersionId: "rv-1", runtimeIdentity: "i", entryPoint: "index.html", manifest: {} });
    const readRuntimeEntry = async () => ({ html: "<runtime-html>" });

    // Unbound legacy row: flag off = byte-identical pre-cutover behavior.
    const legacyOff = await assemblePlayableLesson(input({ runtimeBinding: UNBOUND }), {
      isEnabled: () => false,
      resolveRuntime: async () => { throw new Error("resolver must not be consulted for unbound rows with the flag off"); },
      readRuntimeEntry,
    });
    assert.equal(legacyOff?.source, "template");
    assert.equal(legacyOff?.htmlPlayer, "<template-html>");

    // Bound row: the flag no longer re-attaches it to the mutable template —
    // its template may already be retired, so rollback must never 404 it.
    const boundOff = await assemblePlayableLesson(input(), { isEnabled: () => false, resolveRuntime, readRuntimeEntry });
    assert.equal(boundOff?.source, "runtime");
    assert.equal(boundOff?.htmlPlayer, "<runtime-html>");
  });

  test("no cross-talk: each call resolves only its own lesson version", async () => {
    const seen: string[] = [];
    await assemblePlayableLesson(input({ lessonVersionId: "lv-A", runtimeBinding: UNBOUND }), {
      isEnabled: () => true,
      resolveRuntime: async (id: string) => {
        seen.push(id);
        return { mode: "template-fallback", lessonVersionId: id };
      },
    });
    await assemblePlayableLesson(input({ lessonVersionId: "lv-B", runtimeBinding: UNBOUND, fetchTemplateHtmlPlayer: async () => "<other>" }), {
      isEnabled: () => true,
      resolveRuntime: async (id: string) => {
        seen.push(id);
        return { mode: "template-fallback", lessonVersionId: id };
      },
    });
    assert.deepEqual(seen, ["lv-A", "lv-B"]);
  });
});
