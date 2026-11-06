// Regression guard for the retire wiring (the PR #13 post-merge incident):
// the admin delete buttons must call the architectural retire actions
// (retireTemplate / retireSchemaDefinition), never the legacy
// deleteTemplate / deleteSchemaDefinition. Pure static checks over the real
// UI sources — no database, no framework runtime.

import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const SCHEMA_TABLE = "app/admin/schema/_components/schema-definitions-table.tsx";
const TEMPLATE_HOOK = "app/admin/templates/_hooks/use-template-table.ts";
const UI_ROOTS = ["app", "components"];

function readUi(pathFromRepoRoot) {
  return readFileSync(fileURLToPath(new URL(`../../${pathFromRepoRoot}`, import.meta.url)), "utf8");
}

function* walk(dirFromRepoRoot) {
  const abs = fileURLToPath(new URL(`../../${dirFromRepoRoot}`, import.meta.url));
  for (const entry of readdirSync(abs)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const rel = `${dirFromRepoRoot}/${entry}`;
    const stats = statSync(fileURLToPath(new URL(`../../${rel}`, import.meta.url)));
    if (stats.isDirectory()) yield* walk(rel);
    else if (/\.(ts|tsx|mts|cts)$/.test(entry)) yield rel;
  }
}

describe("admin delete UI is wired to the retire actions", () => {
  test("schema definitions table retires instead of legacy-deleting", () => {
    const source = readUi(SCHEMA_TABLE);
    assert.match(source, /import\s*\{\s*retireSchemaDefinition\s*\}\s*from\s*"@\/actions\/schema-definitions"/);
    assert.match(source, /await\s+retireSchemaDefinition\(/);
    assert.ok(!/deleteSchemaDefinition/.test(source), "schema table must not reference deleteSchemaDefinition");
  });

  test("template table hook retires instead of legacy-deleting", () => {
    const source = readUi(TEMPLATE_HOOK);
    assert.match(source, /import\s*\{\s*retireTemplate\s*\}\s*from\s*"@\/actions\/templates"/);
    assert.match(source, /await\s+retireTemplate\(/);
    assert.ok(!/deleteTemplate/.test(source), "template hook must not reference deleteTemplate");
  });

  test("no UI file anywhere imports the legacy delete actions", () => {
    const offenders = [];
    for (const root of UI_ROOTS) {
      for (const file of walk(root)) {
        const source = readUi(file);
        if (/import\s*\{[^}]*\bdeleteTemplate\b[^}]*\}\s*from\s*"@\/actions\/templates"/.test(source) ||
            /import\s*\{[^}]*\bdeleteSchemaDefinition\b[^}]*\}\s*from\s*"@\/actions\/schema-definitions"/.test(source)) {
          offenders.push(file);
        }
      }
    }
    assert.deepEqual(offenders, [], `legacy delete action imports found in: ${offenders.join(", ")}`);
  });
});
