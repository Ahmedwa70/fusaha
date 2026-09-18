// Idempotent seed for the data the app depends on but that isn't created by
// migrations (migrations own schema, not rows). Safe to re-run: each
// seeder in ./seeder upserts or uses ON CONFLICT DO NOTHING so nothing
// already present is duplicated or clobbered.
//
// Run with: pnpm db:seed
import "dotenv/config";
import postgres from "postgres";
import { seedRoles } from "./seeder/roles.mjs";
import { seedPermissions } from "./seeder/permissions.mjs";
import { seedRolePermissions } from "./seeder/role-permissions.mjs";
import { seedSchemaDefinitions } from "./seeder/schema-definitions.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sql = postgres(connectionString, { prepare: false });

try {
  await seedRoles(sql);
  await seedPermissions(sql);
  await seedRolePermissions(sql);
  await seedSchemaDefinitions(sql);
} finally {
  await sql.end();
}
