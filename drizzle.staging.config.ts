import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const stagingProjectRef = "nodzspvuidbdlwsiejyp";
const productionProjectRef = "msaxzamhzfwhbjjsdcae";

if (process.env.DATABASE_ENV !== "staging") {
  throw new Error("drizzle.staging.config.ts requires DATABASE_ENV=staging.");
}

if (process.env.STAGING_PROJECT_REF !== stagingProjectRef) {
  throw new Error("drizzle.staging.config.ts received an unexpected staging project reference.");
}

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes(productionProjectRef)) {
  throw new Error("drizzle.staging.config.ts requires a non-production DATABASE_URL.");
}

export default defineConfig({
  schema: "./database/schema/index.ts",
  out: "./database/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
