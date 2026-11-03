import postgres from "postgres";
import { assertValidatedTarget } from "../scripts/database-target-guard.mjs";
import { seedRoles } from "./seeder/roles.mjs";
import { seedPermissions } from "./seeder/permissions.mjs";
import { seedRolePermissions } from "./seeder/role-permissions.mjs";
import { seedSchemaDefinitions } from "./seeder/schema-definitions.mjs";

const environment = assertValidatedTarget(process.env);
const connectionString = environment.DATABASE_URL;
const sql = postgres(connectionString, { prepare: false });

try {
  await seedRoles(sql);
  await seedPermissions(sql);
  await seedRolePermissions(sql);
  await seedSchemaDefinitions(sql);
} finally {
  await sql.end();
}
