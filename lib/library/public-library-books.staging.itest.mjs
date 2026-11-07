// Staging integration test: proves the public catalog binding end-to-end —
// only published + verified records surface, drafts and unverified records
// stay in the admin area. Creates three synthetic rows under a unique
// `staging-itest-<run>` slug prefix, asserts, then removes exactly those
// rows. Pre-existing staging data is never touched.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { register } from "node:module";
import { after, describe, test } from "node:test";
import dotenv from "dotenv";
import postgres from "postgres";

register(new URL("./public-library-books.staging.test-hooks.mjs", import.meta.url).href);

const { validateStagingConfiguration, projectRoot } = await import("../../scripts/database-target-guard.mjs");
const env = dotenv.parse(readFileSync(path.join(projectRoot, ".env.staging.local")));
const validated = validateStagingConfiguration(env);
process.env.DATABASE_URL = validated.DATABASE_URL;

const { listPublishedLibraryBooks, getPublishedLibraryBookBySlug } = await import("./public-books.ts");

const runId = `staging-itest-${Date.now()}`;
const sql = postgres(validated.DATABASE_URL, { max: 1, prepare: false });

const fixture = (suffix, overrides) => ({
  slug: `${runId}-${suffix}`,
  original_title: `ITEST ${runId} ${suffix}`,
  authors: "Staging ITest",
  category: "اختبار",
  audience: "اختبار",
  level: "مبتدئ",
  display_title: { ar: `كتاب اختبار ${suffix}`, en: `Test book ${suffix}` },
  description: { ar: "وصف اختبار", en: "Test description" },
  source_name: "Staging ITest",
  source_url: "https://example.com/source",
  destination_type: "other",
  ...overrides,
});

const fixtures = [
  fixture("draft", { publication_status: "draft", review_status: "needs_review" }),
  fixture("unverified", { publication_status: "published", review_status: "needs_review" }),
  fixture("live", { publication_status: "published", review_status: "verified" }),
];

after(async () => {
  try {
    await sql`DELETE FROM library_books WHERE slug LIKE ${"staging-itest-%"}`;
    const { closeStagingDb } = await import("./test-stubs/staging-db.mjs");
    await closeStagingDb();
  } finally {
    await sql.end();
  }
});

describe("public library catalog on staging (synthetic fixtures)", () => {
  test("only published + verified fixtures appear in the public catalog", async () => {
    const inserted = [];
    for (const row of fixtures) {
      const [record] = await sql`
        INSERT INTO library_books ${sql(row)}
        RETURNING id`;
      inserted.push(record.id);
    }
    assert.equal(inserted.length, 3);

    const list = await listPublishedLibraryBooks();
    const slugs = list.map((book) => book.slug);
    assert.ok(slugs.includes(`${runId}-live`), "published + verified fixture must appear");
    assert.ok(!slugs.includes(`${runId}-draft`), "draft fixture must NOT appear");
    assert.ok(!slugs.includes(`${runId}-unverified`), "published-but-unverified fixture must NOT appear");

    const live = await getPublishedLibraryBookBySlug(`${runId}-live`);
    assert.ok(live, "published + verified fixture resolves by slug");
    assert.equal(live.sourceName, "Staging ITest");
    assert.deepEqual(live.displayTitle.en, `Test book live`);

    assert.equal(await getPublishedLibraryBookBySlug(`${runId}-draft`), null, "draft must not resolve by slug");
    assert.equal(await getPublishedLibraryBookBySlug(`${runId}-unverified`), null, "unverified must not resolve by slug");

    // Cleanup happens in after(); assert the rows still exist here so a
    // failed cleanup cannot silently pass.
    const remaining = await sql`SELECT count(*)::int AS n FROM library_books WHERE slug LIKE ${runId + "-%"}`;
    assert.equal(remaining[0].n, 3);
  });
});
