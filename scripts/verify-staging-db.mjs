#!/usr/bin/env node

import { readFileSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import postgres from "postgres";
import {
  projectRoot,
  STAGING_PROJECT_REF,
  validateStagingConfiguration,
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
    environment = validateStagingConfiguration(dotenv.parse(readFileSync(envPath)));
  } catch (error) {
    fail(error instanceof Error ? error.message : "staging configuration is invalid");
    return;
  }

  if (process.argv.includes("--preflight")) {
    process.stdout.write("Staging preflight succeeded; no database connection attempted.\n");
    process.stdout.write(`Project reference: ${STAGING_PROJECT_REF}\n`);
    process.stdout.write(`Pooler host: ${environment.STAGING_DB_HOST}\n`);
    process.stdout.write("Port: 6543\n");
    process.stdout.write(`Username: ${environment.STAGING_DB_USER}\n`);
    process.stdout.write("Password: present and not displayed\n");
    return;
  }

  const sql = postgres(environment.DATABASE_URL, {
    prepare: false,
    ssl: "require",
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

    // Project identity is bound BEFORE this query by parseAndValidatePoolerUrl
    // (URL username must be postgres.<approved project ref>, approved Supabase
    // pooler host, port 6543, sslmode=require, production ref rejected) plus
    // project-scoped credential acceptance: the Supabase pooler rejects these
    // credentials for any other project with 28P01, so a successful query
    // here means we are inside the approved staging project.
    //
    // Runtime identity fields need a pooler-aware allowlist: behind the
    // Supabase transaction pooler the server reports the BACKEND role
    // ("postgres") and the BACKEND port (5432), not the pooler username
    // (postgres.<ref>) or pooler port (6543). Require the default database
    // and an allowlisted role only; never weaken the URL-level checks above.
    const acceptedRoleNames = new Set(["postgres", environment.STAGING_DB_USER]);
    if (!identity?.database_name || !acceptedRoleNames.has(identity.user_name)) {
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
    const code = safeErrorCode(error);
    if (code === "28P01") {
      fail("PostgreSQL rejected the Staging credentials (28P01); refresh the Staging database password and URL-encode special characters exactly once");
    } else {
      fail(`read-only connection/query error (${code})`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

verify().catch((error) => {
  fail(`unexpected verification error (${safeErrorCode(error)})`);
});
