#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import postgres from "postgres";
import {
  projectRoot,
  STAGING_PROJECT_REF,
  parseAndValidatePoolerUrl,
  validateTargetEnvironment,
} from "./database-target-guard.mjs";

const envPath = path.join(projectRoot, ".env.staging.local");

function fail(message) {
  process.stderr.write(`Staging verification failed: ${message}\n`);
  process.exitCode = 1;
}

function safeErrorCode(error) {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    return error.code;
  }
  if (error && typeof error === "object" && "name" in error && typeof error.name === "string") {
    return error.name;
  }
  return "connection-error";
}

async function verify() {
  let environment;
  try {
    environment = dotenv.parse(readFileSync(envPath));
    environment = validateTargetEnvironment(environment, "staging");

    if (!environment.STAGING_DB_HOST || !environment.STAGING_DB_USER) {
      throw new Error("STAGING_DB_HOST and STAGING_DB_USER are required");
    }

    const parsedUrl = parseAndValidatePoolerUrl(environment.DATABASE_URL, STAGING_PROJECT_REF);
    if (parsedUrl.hostname !== environment.STAGING_DB_HOST) {
      throw new Error("STAGING_DB_HOST does not match the validated Staging URL");
    }
    if (decodeURIComponent(parsedUrl.username) !== environment.STAGING_DB_USER) {
      throw new Error("STAGING_DB_USER does not match the validated Staging URL");
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : "staging configuration is invalid");
    return;
  }

  const sql = postgres(environment.DATABASE_URL, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
  });

  try {
    const [identity] = await sql.unsafe(`
      select
        current_database() as database_name,
        current_user as user_name,
        inet_server_addr()::text as server_address,
        inet_server_port() as server_port,
        current_setting('server_version') as server_version
    `);

    if (!identity?.database_name || identity.user_name !== environment.STAGING_DB_USER || identity.server_port !== 6543) {
      fail("connected identity did not match the approved Staging target");
      return;
    }

    process.stdout.write("Staging verification succeeded.\n");
    process.stdout.write(`Project reference: ${STAGING_PROJECT_REF}\n`);
    process.stdout.write(`Database: ${identity.database_name}\n`);
    process.stdout.write(`User: ${identity.user_name}\n`);
    process.stdout.write(`Server: ${identity.server_address ?? "unavailable"}:${identity.server_port}\n`);
    process.stdout.write(`PostgreSQL: ${identity.server_version}\n`);
    process.stdout.write("Read-only identity query completed; no migration or seed was executed.\n");
  } catch (error) {
    fail(`read-only connection/query error (${safeErrorCode(error)})`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

verify().catch((error) => {
  fail(`unexpected verification error (${safeErrorCode(error)})`);
});
