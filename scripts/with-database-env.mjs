#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stagingEnvPath = path.join(projectRoot, ".env.staging.local");
const productionProjectRef = "msaxzamhzfwhbjjsdcae";

export function validateStagingEnvironment(environment) {
  const required = [
    "DATABASE_ENV",
    "STAGING_PROJECT_REF",
    "STAGING_DATABASE_URL",
    "STAGING_DB_HOST",
    "STAGING_DB_USER",
  ];

  for (const key of required) {
    if (!environment[key]?.trim()) {
      throw new Error(`Missing required staging variable: ${key}`);
    }
  }

  if (environment.DATABASE_ENV !== "staging") {
    throw new Error("DATABASE_ENV must be exactly staging.");
  }

  if (environment.STAGING_PROJECT_REF !== "nodzspvuidbdlwsiejyp") {
    throw new Error("STAGING_PROJECT_REF does not match the approved staging project.");
  }

  if (environment.STAGING_DATABASE_URL.includes(productionProjectRef)) {
    throw new Error("STAGING_DATABASE_URL references the production project.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(environment.STAGING_DATABASE_URL);
  } catch {
    throw new Error("STAGING_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (!['postgres:', 'postgresql:'].includes(parsedUrl.protocol) || !parsedUrl.hostname || !parsedUrl.username) {
    throw new Error("STAGING_DATABASE_URL must include a PostgreSQL hostname and username.");
  }

  if (parsedUrl.hostname !== environment.STAGING_DB_HOST || parsedUrl.username !== environment.STAGING_DB_USER) {
    throw new Error("Staging connection hostname/username does not match the expected staging identity.");
  }

  if (environment.DATABASE_URL && environment.DATABASE_URL !== environment.STAGING_DATABASE_URL) {
    throw new Error("An inherited DATABASE_URL does not match STAGING_DATABASE_URL.");
  }

  return {
    ...environment,
    DATABASE_URL: environment.STAGING_DATABASE_URL,
    DATABASE_ENV: "staging",
  };
}

function loadStagingEnvironment() {
  if (!existsSync(stagingEnvPath)) {
    throw new Error(`Missing ${path.basename(stagingEnvPath)}. Staging commands require an explicit private environment file.`);
  }

  const parsed = dotenv.parse(readFileSync(stagingEnvPath));
  return validateStagingEnvironment(parsed);
}

function run(command, args, environment) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    env: { ...process.env, ...environment, DATABASE_URL: environment.STAGING_DATABASE_URL },
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Self-test failed: ${message}`);
}

function baseEnvironment(overrides = {}) {
  return {
    DATABASE_ENV: "staging",
    STAGING_PROJECT_REF: "nodzspvuidbdlwsiejyp",
    STAGING_DATABASE_URL: "postgresql://postgres.staging-user@db.staging.example:5432/postgres",
    STAGING_DB_HOST: "db.staging.example",
    STAGING_DB_USER: "postgres.staging-user",
    DATABASE_URL: "postgresql://postgres.staging-user@db.staging.example:5432/postgres",
    ...overrides,
  };
}

export function assertExplicitStagingSelection(environmentName) {
  if (environmentName !== "staging") {
    throw new Error("Explicit environment required. Use the staging launcher with an explicit staging selection.");
  }
}

export function runSelfTests() {
  assert(validateStagingEnvironment(baseEnvironment()).DATABASE_URL === baseEnvironment().STAGING_DATABASE_URL, "valid staging configuration");
  for (const [name, overrides] of [
    ["missing staging database URL", { STAGING_DATABASE_URL: "" }],
    ["missing project reference", { STAGING_PROJECT_REF: "" }],
    ["incorrect environment selection", { DATABASE_ENV: "development" }],
    ["production URL supplied to staging", { STAGING_DATABASE_URL: "postgresql://postgres.prod@db.msaxzamhzfwhbjjsdcae.example:5432/postgres" }],
    ["missing expected connection identity", { STAGING_DB_HOST: "" }],
    ["malformed connection URL", { STAGING_DATABASE_URL: "not-a-database-url" }],
    ["inherited production DATABASE_URL", { DATABASE_URL: "postgresql://postgres.prod@db.production.example:5432/postgres" }],
    ["unknown environment", { DATABASE_ENV: "qa" }],
  ]) {
    try {
      validateStagingEnvironment(baseEnvironment(overrides));
      throw new Error(`expected rejection: ${name}`);
    } catch (error) {
      assert(error instanceof Error && !error.message.startsWith("expected rejection"), name);
    }
  }

  try {
    assertExplicitStagingSelection(undefined);
    throw new Error("expected rejection: direct execution without explicit environment selection");
  } catch (error) {
    assert(error instanceof Error && !error.message.startsWith("expected rejection"), "direct execution without explicit environment selection");
  }

  process.stdout.write("staging launcher self-test: 10 scenarios passed; no database connection attempted.\n");
}

const [, , environmentName, action] = process.argv;
if (environmentName === "--self-test") {
  runSelfTests();
} else {
  assertExplicitStagingSelection(environmentName);

  const environment = loadStagingEnvironment();
  if (action === "check") {
    process.stdout.write("staging configuration validated; no database connection attempted.\n");
  } else if (action === "migrate") {
    run("pnpm", ["exec", "drizzle-kit", "migrate", "--config", "drizzle.staging.config.ts"], environment);
  } else if (action === "seed") {
    run(process.execPath, ["database/seed.mjs"], environment);
  } else {
    throw new Error("Unknown staging action. Use check, migrate, or seed.");
  }
}
