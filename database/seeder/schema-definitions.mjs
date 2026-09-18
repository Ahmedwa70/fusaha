import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// Resolved relative to this file's own location (not process.cwd()) so
// `pnpm db:seed` works regardless of the invoking directory.
const LESSON_SCHEMA_V2_CONTENT = readFileSync(
  fileURLToPath(new URL("../seed-data/lesson-schema-v2.md", import.meta.url)),
  "utf-8"
);

// Bootstraps the first level only — further levels are created on demand
// from the admin UI by adding a schema under a new level label, so there's
// nothing to seed for them yet.
const FIRST_LEVEL_KEY = "level-1";
const FIRST_LEVEL = { ar: "المستوى الأول", en: "Level 1", zh: "一级" };

export async function seedSchemaDefinitions(sql) {
  const insertedSchemaDefinitions = await sql`
    INSERT INTO schema_definitions (level_key, level, version, content, active)
    VALUES (${FIRST_LEVEL_KEY}, ${JSON.stringify(FIRST_LEVEL)}, '2.0', ${LESSON_SCHEMA_V2_CONTENT}, true)
    ON CONFLICT (level_key, version) DO NOTHING
    RETURNING level_key, version
  `;
  console.log(
    insertedSchemaDefinitions.length
      ? `Inserted schema definition: level ${insertedSchemaDefinitions[0].level_key} v${insertedSchemaDefinitions[0].version}`
      : `Schema definition for ${FIRST_LEVEL_KEY} v2.0 already present — nothing to do.`
  );
}
