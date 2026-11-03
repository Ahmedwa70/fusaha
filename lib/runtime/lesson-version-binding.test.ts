import { register } from "node:module";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

register(new URL("./runtime-contract.test-hooks.mjs", import.meta.url).href);

const { getRuntimeIdentity } = await import("./hash" + ".ts");
const { RuntimePackageRegistry } = await import("./registry" + ".ts");
const { LessonVersionBindingError, LessonVersionRuntimeBindingService } = await import("./lesson-version-binding" + ".ts");
import type { RuntimePackage } from "./types";

const runtimeV1: RuntimePackage = {
  manifest: {
    contractVersion: "1.0",
    runtimeId: "html-player",
    runtimeVersion: "1.0.0",
    packageKind: "single-file",
    entryPoint: "index.html",
    capabilities: ["lesson-data"],
    assets: [],
  },
  files: { "index.html": "<main data-runtime=v1></main>" },
};

const runtimeV2: RuntimePackage = {
  ...runtimeV1,
  manifest: { ...runtimeV1.manifest, runtimeVersion: "2.0.0" },
  files: { "index.html": "<main data-runtime=v2></main>" },
};

function setup() {
  const registry = new RuntimePackageRegistry();
  const runtimeOne = registry.register(runtimeV1);
  const runtimeTwo = registry.register(runtimeV2);
  return {
    registry,
    service: new LessonVersionRuntimeBindingService(undefined, registry),
    runtimeOne,
    runtimeTwo,
  };
}

describe("lesson-version runtime binding", () => {
  test("binds a lesson version to an exact runtime identity and contract", () => {
    const { service, runtimeOne } = setup();
    const binding = service.bind("lesson-version-1", runtimeOne.identity);

    assert.deepEqual(binding, {
      lessonVersionId: "lesson-version-1",
      status: "bound",
      runtimeIdentity: runtimeOne.identity,
      contractVersion: "1.0",
    });
    assert.equal(service.resolveRuntime("lesson-version-1").runtime?.identity, runtimeOne.identity);
  });

  test("rejects a missing runtime identity", () => {
    const { service } = setup();

    assert.throws(
      () => service.bind("lesson-version-1", "" as `sha256-${string}`),
      (error: unknown) => hasBindingCode(error, "missing-runtime-identity")
    );
  });

  test("rejects a nonexistent runtime reference", () => {
    const { service } = setup();

    assert.throws(
      () => service.bind("lesson-version-1", "sha256-does-not-exist"),
      (error: unknown) => hasBindingCode(error, "runtime-not-found")
    );
  });

  test("rejects a contract-version mismatch", () => {
    const { service, runtimeOne } = setup();

    assert.throws(
      () => service.bind("lesson-version-1", runtimeOne.identity, "2.0" as never),
      (error: unknown) => hasBindingCode(error, "contract-version-mismatch")
    );
  });

  test("keeps historical lesson versions isolated by binding each version independently", () => {
    const { service, runtimeOne, runtimeTwo } = setup();

    service.bind("lesson-version-1", runtimeOne.identity);
    service.bind("lesson-version-2", runtimeTwo.identity);

    assert.equal(service.resolveRuntime("lesson-version-1").runtime?.identity, runtimeOne.identity);
    assert.equal(service.resolveRuntime("lesson-version-2").runtime?.identity, runtimeTwo.identity);
    assert.notEqual(runtimeOne.identity, runtimeTwo.identity);
  });

  test("allows idempotent reassertion but prevents reassignment", () => {
    const { service, runtimeOne, runtimeTwo } = setup();
    const first = service.bind("lesson-version-1", runtimeOne.identity);
    const repeated = service.bind("lesson-version-1", runtimeOne.identity);

    assert.deepEqual(repeated, first);
    assert.throws(
      () => service.bind("lesson-version-1", runtimeTwo.identity),
      (error: unknown) => hasBindingCode(error, "binding-already-established")
    );
  });

  test("represents existing lessons explicitly as legacy and unbound", () => {
    const { service } = setup();
    const binding = service.markLegacyUnbound("historical-version", "Original runtime was not snapshotted.");

    assert.deepEqual(binding, {
      lessonVersionId: "historical-version",
      status: "legacy-unbound",
      reason: "Original runtime was not snapshotted.",
    });
    assert.equal(service.resolveRuntime("historical-version").runtime, undefined);
  });

  test("does not allow a legacy state to be silently replaced", () => {
    const { service, runtimeOne } = setup();
    service.markLegacyUnbound("historical-version", "Needs verified historical evidence.");

    assert.throws(
      () => service.bind("historical-version", runtimeOne.identity),
      (error: unknown) => hasBindingCode(error, "binding-already-established")
    );
  });

  test("surfaces runtime integrity failures", () => {
    const runtimeIdentity = getRuntimeIdentity(runtimeV1);
    const corruptedStore = {
      get: (identity: `sha256-${string}`) => identity === runtimeIdentity ? { ...runtimeV1, files: { "index.html": "tampered" } } : undefined,
      put: () => undefined,
    };
    const service = new LessonVersionRuntimeBindingService(undefined, new RuntimePackageRegistry(corruptedStore));

    assert.throws(
      () => service.bind("lesson-version-1", runtimeIdentity),
      (error: unknown) => hasBindingCode(error, "runtime-integrity-failure")
    );
  });

  test("keeps lesson, template, schema, and runtime identities separate", () => {
    const { service, runtimeOne } = setup();
    const binding = service.bind("lesson-version-1", runtimeOne.identity);

    assert.equal(binding.lessonVersionId, "lesson-version-1");
    assert.equal(binding.runtimeIdentity, runtimeOne.identity);
    assert.equal("templateId" in binding, false);
    assert.equal("schemaDefinitionId" in binding, false);
  });
});

function hasBindingCode(error: unknown, code: string): boolean {
  const candidate = error as { code?: string };
  return error instanceof LessonVersionBindingError && candidate.code === code;
}
