// Test double for "@/lib/db" in the play-query regression tests. Unlike the
// binding tests (which inject their own drizzle instance), the play queries
// in lib/dashboard/queries/lesson.ts have no injection point — they use the
// default appDb, plus the default binding service and entry-content reader
// built on it. So this stub builds a REAL drizzle instance over the
// disposable test database; RUNTIME_BINDING_TEST_DATABASE_URL must point at a
// disposable, migrated database (never staging/production).
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "../../runtime/runtime-binding-schema-stub.mjs";

const url = process.env.RUNTIME_BINDING_TEST_DATABASE_URL ?? process.env.RUNTIME_PUBLICATION_TEST_DATABASE_URL ?? "";
const client = url ? postgres(url, { max: 4 }) : null;
export const db = client ? drizzle(client, { schema }) : null;

/** Close the pooled client so the test runner process can exit. */
export async function closeTestDb() {
  if (client) await client.end();
}
