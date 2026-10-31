#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import dotenv from "dotenv";
import {
  projectRoot,
  validateTargetEnvironment,
  assertValidatedTarget,
  rejectGenericDatabaseCommand,
} from "./database-target-guard.mjs";

const stagingEnvPath = path.join(projectRoot, ".env.staging.local");

function loadEnvironment(target) {
  if (target === "staging") {
    if (!existsSync(stagingEnvPath)) {
      throw new Error("Missing .env.staging.local; staging operations require an explicit private environment file.");
    }
    return dotenv.parse(readFileSync(stagingEnvPath));
  }

  return {
    ...process.env,
    DATABASE_ENV: "production",
    PRODUCTION_DATABASE_URL: process.env.PRODUCTION_DATABASE_URL ?? process.env.DATABASE_URL,
  };
}

function run(target, action, environment) {
  const config = target === "staging" ? "drizzle.staging.config.ts" : "drizzle.config.ts";
  const childEnvironment = {
    ...process.env,
    ...environment,
    DATABASE_URL: environment.DATABASE_URL,
    DATABASE_ENV: target,
    DATABASE_TARGET_VALIDATED: "1",
  };
  const args = action === "migrate"
    ? ["exec", "drizzle-kit", "migrate", "--config", config]
    : ["database/seed.mjs"];
  const command = action === "migrate" ? "pnpm" : process.execPath;
  const commandArgs = action === "migrate" ? args : args;
  const result = spawnSync(command, commandArgs, {
    cwd: projectRoot,
    env: childEnvironment,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
}

function assert(condition, message) {
  if (!condition) throw new Error(`Self-test failed: ${message}`);
}

function dummyUrl(projectRef = "nodzspvuidbdlwsiejyp", overrides = {}) {
  const username = overrides.username ?? `postgres.${projectRef}`;
  const host = overrides.host ?? "aws-0-ap-northeast-1.pooler.supabase.com";
  const port = overrides.port ?? "6543";
  return `postgresql://${username}:dummy-password@${host}:${port}/postgres`;
}

function baseEnvironment(overrides = {}) {
  const url = dummyUrl();
  return {
    DATABASE_ENV: "staging",
    STAGING_PROJECT_REF: "nodzspvuidbdlwsiejyp",
    STAGING_DATABASE_URL: url,
    DATABASE_URL: url,
    ...overrides,
  };
}

export function runSelfTests() {
  const valid = validateTargetEnvironment(baseEnvironment(), "staging");
  assert(valid.DATABASE_TARGET_VALIDATED === "1", "correct staging target");

  const cases = [
    ["Production URL supplied to Staging", { STAGING_DATABASE_URL: dummyUrl("msaxzamhzfwhbjjsdcae") }],
    ["Production project reference disguised by markers", { STAGING_PROJECT_REF: "msaxzamhzfwhbjjsdcae" }],
    ["Incorrect Staging username", { STAGING_DATABASE_URL: dummyUrl(undefined, { username: "postgres.wrong-project" }) }],
    ["Incorrect pooler hostname", { STAGING_DATABASE_URL: dummyUrl(undefined, { host: "db.example.com" }) }],
    ["Incorrect port", { STAGING_DATABASE_URL: dummyUrl(undefined, { port: "5432" }) }],
    ["Missing credentials", { STAGING_DATABASE_URL: "postgresql://postgres.nodzspvuidbdlwsiejyp@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres" }],
    ["Malformed URL", { STAGING_DATABASE_URL: "not-a-url" }],
    ["Inherited Production DATABASE_URL", { DATABASE_URL: dummyUrl("msaxzamhzfwhbjjsdcae") }],
    ["Unknown environment", { DATABASE_ENV: "qa" }],
    ["Missing validation markers", { DATABASE_TARGET_VALIDATED: "", DATABASE_ENV: "staging" }],
  ];

  for (const [name, overrides] of cases) {
    try {
      if (name === "Missing validation markers") {
        assertValidatedTarget(baseEnvironment(overrides));
      } else {
        validateTargetEnvironment(baseEnvironment(overrides), "staging");
      }
      throw new Error(`expected rejection: ${name}`);
    } catch (error) {
      assert(error instanceof Error && !error.message.startsWith("expected rejection"), name);
    }
  }

  try {
    rejectGenericDatabaseCommand();
    throw new Error("expected rejection: generic migration command");
  } catch (error) {
    assert(error instanceof Error && !error.message.startsWith("expected rejection") && !error.message.includes("dummy-password"), "generic migration command");
  }

  const directSeed = spawnSync(process.execPath, ["database/seed.mjs"], {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: dummyUrl() },
    encoding: "utf8",
  });
  assert(directSeed.status !== 0, "direct seed invocation");
  assert(!`${directSeed.stdout}${directSeed.stderr}`.includes("dummy-password"), "direct seed secret leakage");

  const directDrizzle = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate", "--config", "drizzle.staging.config.ts"], {
    cwd: projectRoot,
    env: { ...process.env, DATABASE_URL: dummyUrl() },
    encoding: "utf8",
  });
  assert(directDrizzle.status !== 0, "direct Drizzle configuration invocation");
  assert(!`${directDrizzle.stdout}${directDrizzle.stderr}`.includes("dummy-password"), "direct Drizzle secret leakage");

  process.stdout.write("database target guard self-test: 16 scenarios passed; no database connection attempted.\n");
}

const [, , target, action] = process.argv;
if (target === "--self-test") {
  runSelfTests();
} else if (!target || target === "--reject-generic") {
  rejectGenericDatabaseCommand();
} else if (target !== "staging" && target !== "production") {
  throw new Error("Explicit environment required: use staging or production.");
} else if (!["check", "migrate", "seed"].includes(action)) {
  throw new Error("Explicit action required: use check, migrate, or seed.");
} else {
  const environment = validateTargetEnvironment(loadEnvironment(target), target);
  if (action === "check") {
    process.stdout.write(`${target} configuration validated; no database connection attempted.\n`);
  } else {
    run(target, action, environment);
  }
}
