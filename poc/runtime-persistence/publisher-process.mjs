// Standalone publisher entry point used by the lease/concurrency tests to run
// two REAL OS processes against the same PostgreSQL + SeaweedFS environment.
//
// Usage: node publisher-process.mjs <idempotencyKey> <runtimeVersionTag> [delayMs]
//
// Prints a single JSON line on stdout: { ok, identity, state, runtimeId } or
// { ok: false, code, error }. Reads credentials exclusively from
// integration-environment/.env.integration; connects to 127.0.0.1 only.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { canonicalizePackage } from "./runtime-identity-v1.mjs";
import { createS3Client } from "./s3-client.mjs";
import { createPgS3RuntimeStore } from "./integration-adapter-poc.mjs";

const pocDir = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(pocDir, "integration-environment", ".env.integration"), "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const [idempotencyKey, runtimeVersion, delayArg] = process.argv.slice(2);
if (!idempotencyKey || !runtimeVersion) {
  console.error("usage: node publisher-process.mjs <idempotencyKey> <runtimeVersionTag> [delayMs]");
  process.exit(2);
}

// Identical tag -> identical V1 fixture bytes -> identical runtime identity
// across processes, which is what the cross-process convergence tests rely on.
const packageData = canonicalizePackage({
  files: {
    "index.html": `<!doctype html><html><body><div id="app">${runtimeVersion}</div><script src="./assets/app.js"></script></body></html>`,
    "assets/app.js": `console.log("${runtimeVersion}");`,
    "assets/icon.svg": `<svg xmlns="http://www.w3.org/2000/svg"><circle cx="5" cy="5" r="4"/></svg>`,
  },
  entryPoint: "index.html",
  capabilities: [],
});

const sql = postgres({
  host: "127.0.0.1",
  port: Number(env.POC_POSTGRES_PORT),
  database: env.POC_POSTGRES_DB,
  username: env.POC_POSTGRES_USER,
  password: env.POC_POSTGRES_PASSWORD,
});
const s3 = createS3Client({
  endpoint: `http://127.0.0.1:${env.POC_S3_API_PORT}`,
  accessKey: env.POC_S3_ROOT_USER,
  secretKey: env.POC_S3_ROOT_PASSWORD,
});
const store = createPgS3RuntimeStore({ sql, s3, bucket: env.POC_S3_BUCKET });

try {
  const runtime = await store.publish(packageData, idempotencyKey, { delayMs: Number(delayArg ?? 1) });
  console.log(JSON.stringify({ ok: true, identity: packageData.identity, state: runtime.state, runtimeId: runtime.id }));
} catch (error) {
  console.log(JSON.stringify({ ok: false, code: error.code ?? null, error: error.message }));
  process.exitCode = 1;
} finally {
  await sql.end();
}
