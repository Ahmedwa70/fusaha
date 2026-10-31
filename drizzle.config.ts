import { defineConfig } from "drizzle-kit";
import { assertValidatedTarget } from "./scripts/database-target-guard.mjs";

const environment = assertValidatedTarget(process.env);

export default defineConfig({
  schema: "./database/schema/index.ts",
  out: "./database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: environment.DATABASE_URL,
  },
});
