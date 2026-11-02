// Offline unit tests for scripts/database-target-guard.mjs.
// No database is contacted: every case builds environment objects only.

import test from "node:test";
import assert from "node:assert/strict";
import {
  STAGING_PROJECT_REF,
  PRODUCTION_PROJECT_REF,
  parseAndValidatePoolerUrl,
  validateTargetEnvironment,
  validateStagingConfiguration,
  assertValidatedTarget,
  rejectGenericDatabaseCommand,
} from "./database-target-guard.mjs";

const STAGING_POOLER_HOST = "aws-1-ap-northeast-1.pooler.supabase.com";
const STAGING_USER = `postgres.${STAGING_PROJECT_REF}`;
const STAGING_URL =
  `postgresql://${STAGING_USER}:Passw0rd%21@${STAGING_POOLER_HOST}:6543/postgres?sslmode=require`;

function stagingEnv(overrides = {}) {
  return {
    DATABASE_ENV: "staging",
    STAGING_PROJECT_REF,
    STAGING_DATABASE_URL: STAGING_URL,
    STAGING_DB_HOST: STAGING_POOLER_HOST,
    STAGING_DB_USER: STAGING_USER,
    ...overrides,
  };
}

function productionEnv(overrides = {}) {
  const prodUrl =
    `postgresql://postgres.${PRODUCTION_PROJECT_REF}:Secret%231@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres?sslmode=require`;
  return {
    DATABASE_ENV: "production",
    PRODUCTION_DATABASE_URL: prodUrl,
    ...overrides,
  };
}

// ---- parseAndValidatePoolerUrl ----

test("accepts the approved staging pooler URL", () => {
  const parsed = parseAndValidatePoolerUrl(STAGING_URL, STAGING_PROJECT_REF);
  assert.equal(parsed.port, "6543");
  assert.equal(parsed.username, encodeURIComponent(STAGING_USER));
});

test("rejects the production project reference for the staging target", () => {
  const prodUrl = STAGING_URL.replace(STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF);
  assert.throws(() => parseAndValidatePoolerUrl(prodUrl, STAGING_PROJECT_REF), /rejected/);
});

test("rejects a username that does not match the expected project reference", () => {
  const wrong = STAGING_URL.replace(STAGING_USER, "postgres.someotherref");
  assert.throws(() => parseAndValidatePoolerUrl(wrong, STAGING_PROJECT_REF), /does not match/);
});

test("rejects direct (non-pooler) Supabase hosts", () => {
  const direct = STAGING_URL.replace(STAGING_POOLER_HOST, `db.${STAGING_PROJECT_REF}.supabase.co`);
  assert.throws(() => parseAndValidatePoolerUrl(direct, STAGING_PROJECT_REF), /Pooler format/);
});

test("rejects non-6543 ports", () => {
  const wrongPort = STAGING_URL.replace(":6543/", ":5432/");
  assert.throws(() => parseAndValidatePoolerUrl(wrongPort, STAGING_PROJECT_REF), /6543/);
});

test("rejects URLs without sslmode=require", () => {
  const noSsl = STAGING_URL.replace("?sslmode=require", "");
  assert.throws(() => parseAndValidatePoolerUrl(noSsl, STAGING_PROJECT_REF), /SSL/);
});

test("rejects double percent-encoded passwords", () => {
  const double = STAGING_URL.replace("Passw0rd%21", "Passw0rd%2521");
  assert.throws(() => parseAndValidatePoolerUrl(double, STAGING_PROJECT_REF), /double-encoded/);
});

// ---- validateTargetEnvironment / staging configuration ----

test("accepts a fully valid staging configuration", () => {
  const validated = validateStagingConfiguration(stagingEnv());
  assert.equal(validated.DATABASE_ENV, "staging");
  assert.equal(validated.DATABASE_URL, STAGING_URL);
});

test("rejects staging environment whose URL points at the production project", () => {
  const env = stagingEnv({
    STAGING_DATABASE_URL: STAGING_URL.replace(STAGING_PROJECT_REF, PRODUCTION_PROJECT_REF),
  });
  // Fails closed at the username/project-ref match before any connection.
  assert.throws(() => validateStagingConfiguration(env), /does not match/);
});

test("rejects when DATABASE_ENV is not exactly staging", () => {
  assert.throws(() => validateStagingConfiguration(stagingEnv({ DATABASE_ENV: "production" })), /must be exactly/);
  assert.throws(() => validateStagingConfiguration(stagingEnv({ DATABASE_ENV: "" })), /must be exactly/);
});

test("rejects a staging pooler host that does not match the env record", () => {
  assert.throws(
    () => validateStagingConfiguration(stagingEnv({ STAGING_DB_HOST: "aws-9-eu-west-1.pooler.supabase.com" })),
    /does not match/,
  );
});

test("rejects a staging DB user that does not match the URL username", () => {
  assert.throws(
    () => validateStagingConfiguration(stagingEnv({ STAGING_DB_USER: "postgres.wrongref" })),
    /does not match/,
  );
});

test("rejects missing staging host/user metadata", () => {
  const { STAGING_DB_HOST, ...noHost } = stagingEnv();
  assert.throws(() => validateStagingConfiguration(noHost), /required/);
  const { STAGING_DB_USER, ...noUser } = stagingEnv();
  assert.throws(() => validateStagingConfiguration(noUser), /required/);
});

test("rejects a conflicting explicitly-selected project reference", () => {
  assert.throws(
    () => validateStagingConfiguration(stagingEnv({ STAGING_PROJECT_REF: "someotherref" })),
    /not approved/,
  );
});

// ---- production target (guarded path stays intact) ----

test("production target validates only with the approved production reference", () => {
  const validated = validateTargetEnvironment(productionEnv(), "production");
  assert.equal(validated.DATABASE_ENV, "production");
  // A production-marked environment pointed at the staging target fails closed
  // at the environment marker before any URL or connection is considered.
  assert.throws(() => validateTargetEnvironment(productionEnv(), "staging"), /must be exactly staging/);
});

// ---- assertValidatedTarget / rejectGenericDatabaseCommand ----

test("assertValidatedTarget requires the explicit validation marker", () => {
  assert.throws(() => assertValidatedTarget({}), /explicitly validated/);
  const validated = validateStagingConfiguration(stagingEnv());
  assert.doesNotThrow(() =>
    assertValidatedTarget({ ...validated, DATABASE_TARGET_VALIDATED: "1" }),
  );
});

test("generic database commands are rejected", () => {
  assert.throws(() => rejectGenericDatabaseCommand(), /disabled/);
});
