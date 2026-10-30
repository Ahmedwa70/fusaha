import { register } from "node:module";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

register(new URL("./runtime-contract.test-hooks.mjs", import.meta.url).href);

import type { RuntimePackage, RuntimeValidationIssue } from "./types";

const { RUNTIME_CONTRACT_VERSION } = await import("./types" + ".ts");
const { getRuntimeIdentity } = await import("./hash" + ".ts");
const { canonicalizeManifest, validateRuntimePackage } = await import("./manifest" + ".ts");
const { htmlPlayerAdapter } = await import("./adapters/html-player" + ".ts");

const htmlInput = {
  runtimeId: "html-player",
  runtimeVersion: "1.0.0",
  htmlPlayer: "<!doctype html><html><body><main id=app></main></body></html>",
};

describe("html player runtime adapter", () => {
  test("creates a valid single-file runtime package", () => {
    const runtime = htmlPlayerAdapter.createPackage(htmlInput);

    assert.equal(runtime.manifest.packageKind, "single-file");
    assert.equal(runtime.manifest.entryPoint, "index.html");
    assert.deepEqual(runtime.manifest.capabilities, ["lesson-data"]);
    assert.equal(runtime.files["index.html"], htmlInput.htmlPlayer);
    assert.deepEqual(htmlPlayerAdapter.validate(runtime), { valid: true, errors: [] });
  });

  test("does not execute or rewrite HTML while adapting it", () => {
    const htmlPlayer = "<script>window.sideEffect = true</script>";
    const runtime = htmlPlayerAdapter.createPackage({ ...htmlInput, htmlPlayer });

    assert.equal(runtime.files["index.html"], htmlPlayer);
    assert.equal("sideEffect" in globalThis, false);
  });
});

describe("runtime package validation", () => {
  test("rejects an empty or missing entry point", () => {
    const emptyEntryPoint = htmlPlayerAdapter.createPackage(htmlInput);
    const invalid = {
      ...emptyEntryPoint,
      manifest: { ...emptyEntryPoint.manifest, entryPoint: "" },
    } satisfies RuntimePackage;

    const result = validateRuntimePackage(invalid);
    assert.equal(result.valid, false);
    assert.equal(result.errors[0]?.code, "empty-entry-point");
  });

  test("rejects an entry point that is not in the package", () => {
    const runtime = htmlPlayerAdapter.createPackage(htmlInput);
    const result = validateRuntimePackage({
      ...runtime,
      manifest: { ...runtime.manifest, entryPoint: "missing.html" },
    });

    assert.equal(result.valid, false);
    assert.equal(result.errors[0]?.code, "missing-entry-point");
  });

  test("rejects unsupported contract versions and capabilities", () => {
    const runtime = htmlPlayerAdapter.createPackage(htmlInput);
    const result = validateRuntimePackage({
      ...runtime,
      manifest: {
        ...runtime.manifest,
        contractVersion: "9.0" as never,
        capabilities: ["unknown-capability" as never],
      },
    });

    assert.equal(result.valid, false);
    assert.deepEqual(
      result.errors.map((error: RuntimeValidationIssue) => error.code),
      ["invalid-contract-version", "unsupported-capability"]
    );
  });

  test("rejects a manifest asset missing from the package", () => {
    const runtime = htmlPlayerAdapter.createPackage(htmlInput);
    const result = validateRuntimePackage({
      ...runtime,
      manifest: {
        ...runtime.manifest,
        assets: [{ path: "assets/app.js", contentType: "text/javascript", integrity: "sha256-abc" }],
      },
    });

    assert.equal(result.valid, false);
    assert.equal(result.errors[0]?.code, "asset-not-in-package");
  });

  test("supports multi-file package metadata", () => {
    const runtime: RuntimePackage = {
      manifest: {
        contractVersion: RUNTIME_CONTRACT_VERSION,
        runtimeId: "canvas-activity",
        runtimeVersion: "2.0.0",
        packageKind: "multi-file",
        entryPoint: "index.html",
        capabilities: ["lesson-data"],
        assets: [],
      },
      files: {
        "index.html": "<canvas id=app></canvas>",
        "runtime.js": "export function initializeLesson() {}",
        "styles.css": "canvas { display: block; }",
      },
    };

    assert.deepEqual(validateRuntimePackage(runtime), { valid: true, errors: [] });
  });
});

describe("runtime identity", () => {
  test("is deterministic and independent of metadata key order", () => {
    const first = htmlPlayerAdapter.createPackage({
      ...htmlInput,
      metadata: { zed: "last", alpha: "first" },
    });
    const second = htmlPlayerAdapter.createPackage({
      ...htmlInput,
      metadata: { alpha: "first", zed: "last" },
    });

    assert.equal(getRuntimeIdentity(first), getRuntimeIdentity(second));
  });

  test("changes when executable content or version changes", () => {
    const first = htmlPlayerAdapter.createPackage(htmlInput);
    const changedHtml = htmlPlayerAdapter.createPackage({ ...htmlInput, htmlPlayer: `${htmlInput.htmlPlayer}\n<!-- changed -->` });
    const changedVersion = htmlPlayerAdapter.createPackage({ ...htmlInput, runtimeVersion: "1.0.1" });

    assert.notEqual(getRuntimeIdentity(first), getRuntimeIdentity(changedHtml));
    assert.notEqual(getRuntimeIdentity(first), getRuntimeIdentity(changedVersion));
  });

  test("canonicalizes unordered manifest collections", () => {
    const first = htmlPlayerAdapter.createPackage({ ...htmlInput, capabilities: ["post-message", "lesson-data"] });
    const second = htmlPlayerAdapter.createPackage({ ...htmlInput, capabilities: ["lesson-data", "post-message"] });

    assert.equal(canonicalizeManifest(first.manifest), canonicalizeManifest(second.manifest));
  });
});
