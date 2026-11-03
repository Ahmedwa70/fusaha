import { fileURLToPath } from "node:url";
import path from "node:path";

export const STAGING_PROJECT_REF = "nodzspvuidbdlwsiejyp";
export const PRODUCTION_PROJECT_REF = "msaxzamhzfwhbjjsdcae";
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function reject(message) {
  throw new Error(`Database target rejected: ${message}`);
}

export function parseAndValidatePoolerUrl(value, expectedProjectRef) {
  if (!value?.trim()) reject("database URL is missing");

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    reject("database URL is malformed");
  }

  const expectedUser = `postgres.${expectedProjectRef}`;
  const validHost = /^aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com$/i.test(parsed.hostname);
  const validProtocol = parsed.protocol === "postgres:" || parsed.protocol === "postgresql:";

  if (!validProtocol || !validHost || parsed.port !== "6543") {
    reject("only the Supabase Transaction Pooler format on port 6543 is accepted");
  }
  let decodedUsername;
  let decodedPassword;
  try {
    decodedUsername = decodeURIComponent(parsed.username);
    decodedPassword = decodeURIComponent(parsed.password);
  } catch {
    reject("connection credentials contain invalid percent encoding");
  }

  if (decodedUsername !== expectedUser) {
    reject("connection username does not match the approved project reference");
  }
  if (!parsed.password || !decodedPassword) reject("connection password is missing");
  if (parsed.password.includes("%25") && /%[0-9a-f]{2}/i.test(decodedPassword)) {
    reject("connection password appears double-encoded; encode it exactly once");
  }
  if (parsed.searchParams.get("sslmode") !== "require") {
    reject("connection URL must require SSL with sslmode=require");
  }
  if (value.includes(PRODUCTION_PROJECT_REF) && expectedProjectRef !== PRODUCTION_PROJECT_REF) {
    reject("Production project reference is not allowed for this target");
  }

  return parsed;
}

export function validateTargetEnvironment(environment, target) {
  if (target !== "staging" && target !== "production") reject("unknown environment");
  if (environment.DATABASE_ENV !== target) reject(`DATABASE_ENV must be exactly ${target}`);

  const projectRef = target === "staging" ? STAGING_PROJECT_REF : PRODUCTION_PROJECT_REF;
  const urlKey = target === "staging" ? "STAGING_DATABASE_URL" : "PRODUCTION_DATABASE_URL";
  const targetUrl = target === "production"
    ? environment.PRODUCTION_DATABASE_URL ?? environment.DATABASE_URL
    : environment[urlKey];

  if (environment[`${target.toUpperCase()}_PROJECT_REF`] && environment[`${target.toUpperCase()}_PROJECT_REF`] !== projectRef) {
    reject(`${target} project reference is not approved`);
  }
  parseAndValidatePoolerUrl(targetUrl, projectRef);

  if (environment.DATABASE_URL && environment.DATABASE_URL !== targetUrl) {
    reject("inherited DATABASE_URL does not match the explicitly selected target URL");
  }

  return {
    ...environment,
    DATABASE_ENV: target,
    DATABASE_URL: targetUrl,
    DATABASE_TARGET_VALIDATED: "1",
    [`${target.toUpperCase()}_PROJECT_REF`]: projectRef,
  };
}

export function validateStagingConfiguration(environment) {
  const validated = validateTargetEnvironment(environment, "staging");
  if (!environment.STAGING_DB_HOST || !environment.STAGING_DB_USER) {
    reject("STAGING_DB_HOST and STAGING_DB_USER are required");
  }

  const parsed = parseAndValidatePoolerUrl(validated.DATABASE_URL, STAGING_PROJECT_REF);
  if (parsed.hostname !== environment.STAGING_DB_HOST) {
    reject("Staging pooler host does not match the approved URL");
  }
  if (decodeURIComponent(parsed.username) !== environment.STAGING_DB_USER) {
    reject("Staging pooler username does not match the approved URL");
  }

  return validated;
}

export function assertValidatedTarget(environment) {
  if (environment.DATABASE_TARGET_VALIDATED !== "1") {
    reject("direct database mutation requires an explicitly validated target");
  }
  return validateTargetEnvironment(environment, environment.DATABASE_ENV);
}

export function rejectGenericDatabaseCommand() {
  reject("generic database commands are disabled; select staging or production explicitly");
}
