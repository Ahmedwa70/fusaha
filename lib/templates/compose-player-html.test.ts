import { register } from "node:module";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

register(new URL("./compose-player-html.test-hooks.mjs", import.meta.url).href);

// The Node test runner resolves these TypeScript files through the test-only hook above.
const loadTestModule = (specifier: string) => import(specifier);
const { composePlayerHtml } = await loadTestModule("./compose-player-html.ts");
const {
  approvedLessonWithMultipleVersions,
  approvedLessonWithOneVersion,
  getCurrentApprovedFixtureContent,
  goldenLessonContent,
  goldenPlayerHtml,
} = await loadTestModule("./compose-player-html.fixtures.ts");

function readLessonData(html: string): unknown {
  const match = html.match(/window\.LESSON_DATA = ([\s\S]*);<\/script>/);
  assert.ok(match?.[1], "composed HTML should include lesson data");
  return JSON.parse(match[1]);
}

describe("golden lesson rendering baseline", () => {
  test("composes the dashboard lesson player without changing content", () => {
    const output = composePlayerHtml(goldenPlayerHtml, approvedLessonWithOneVersion.versions[0].content);

    assert.match(output, /<main id="app"><\/main>/);
    assert.match(output, /overflow-x: hidden/);
    assert.deepEqual(readLessonData(output), goldenLessonContent);
  });

  test("composes the public share player through the same current boundary", () => {
    const output = composePlayerHtml(goldenPlayerHtml, approvedLessonWithOneVersion.versions[0].content);

    assert.match(output, /<html lang="ar" dir="rtl">/);
    assert.deepEqual(readLessonData(output), goldenLessonContent);
  });

  test("preserves Arabic RTL text, Unicode, and special HTML characters as data", () => {
    const output = composePlayerHtml(goldenPlayerHtml, goldenLessonContent);
    const serializedData = output.match(/window\.LESSON_DATA = ([\s\S]*);<\/script>/)?.[1] ?? "";

    assert.match(serializedData, /\\u003c/);
    assert.doesNotMatch(serializedData, /<\/script><script>/);
    assert.deepEqual(readLessonData(output), goldenLessonContent);
  });

  test("selects the fixture's approved current version before composition", () => {
    const currentContent = getCurrentApprovedFixtureContent(approvedLessonWithMultipleVersions);
    const output = composePlayerHtml(goldenPlayerHtml, currentContent);

    assert.equal((readLessonData(output) as { title: string }).title, "الإصدار الحالي");
    assert.notEqual((readLessonData(output) as { title: string }).title, "الإصدار القديم");
  });

  test("is deterministic for repeated dashboard rendering", () => {
    const first = composePlayerHtml(goldenPlayerHtml, goldenLessonContent);
    const second = composePlayerHtml(goldenPlayerHtml, goldenLessonContent);

    assert.equal(first, second);
  });

  test("is deterministic for repeated public-share rendering", () => {
    const renderPublicShare = () => composePlayerHtml(goldenPlayerHtml, goldenLessonContent);

    assert.equal(renderPublicShare(), renderPublicShare());
  });

  test("supports players without a head element without changing lesson data", () => {
    const output = composePlayerHtml("<div id=app></div>", goldenLessonContent);

    assert.match(output, /^<style>/);
    assert.deepEqual(readLessonData(output), goldenLessonContent);
  });
});

// The dashboard/public route handlers and their Drizzle queries require a live
// database. These tests intentionally cover their shared isolated rendering
// boundary only; route authorization, query joins, and current-version SQL
// selection remain integration-test work for a database-backed test phase.
