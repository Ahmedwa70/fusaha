import { register } from "node:module";
import assert from "node:assert/strict";
import { describe, test } from "node:test";

register(new URL("./runtime-contract.test-hooks.mjs", import.meta.url).href);

const { getRuntimeIdentity } = await import("./hash" + ".ts");
const { RuntimePackageRegistry } = await import("./registry" + ".ts");
const { DEFAULT_RUNTIME_PACKAGE_RETENTION_POLICY, PERSISTENT_RUNTIME_STORE_CONTRACT } = await import("./persistent-store" + ".ts");
import type { PersistentRuntimePackageStore } from "./persistent-store";
import type { RuntimePackage } from "./types";

type RuntimeIdentity = `sha256-${string}`;

const runtime: RuntimePackage = {
  manifest: {
    contractVersion: "1.0",
    runtimeId: "multi-file-test",
    runtimeVersion: "1.0.0",
    packageKind: "multi-file",
    entryPoint: "index.html",
    capabilities: ["lesson-data"],
    assets: [],
  },
  files: {
    "index.html": "<main id=app></main>",
    "runtime.js": "export const initializeLesson = () => undefined;",
    "styles.css": "main { display: block; }",
  },
};

describe("persistent runtime store contract", () => {
  test("uses an explicit contract and safe retention policy", () => {
    assert.equal(PERSISTENT_RUNTIME_STORE_CONTRACT, "runtime-package-store/v1");
    assert.deepEqual(DEFAULT_RUNTIME_PACKAGE_RETENTION_POLICY, {
      deleteOnlyWhenUnreferenced: true,
      deletionRequiresApproval: true,
      incompleteWritesAreInvisible: true,
    });
  });

  test("persists complete packages across registry reinitialization in the isolated store", () => {
    const store = new IsolatedPersistentTestStore();
    const firstRegistry = new RuntimePackageRegistry(store);
    const registered = firstRegistry.register(runtime);
    const secondRegistry = new RuntimePackageRegistry(store);

    assert.deepEqual(secondRegistry.get(registered.identity).package, runtime);
  });

  test("deduplicates identical packages", () => {
    const store = new IsolatedPersistentTestStore();
    const first = new RuntimePackageRegistry(store).register(runtime);
    const second = new RuntimePackageRegistry(store).register({
      ...runtime,
      manifest: { ...runtime.manifest, capabilities: ["lesson-data"] },
    });

    assert.equal(first.identity, second.identity);
    assert.equal(store.putIfAbsentCalls, 1);
  });

  test("makes concurrent identical registration a single winner", () => {
    const store = new IsolatedPersistentTestStore();
    const firstRegistry = new RuntimePackageRegistry(store);
    const secondRegistry = new RuntimePackageRegistry(store);

    const first = firstRegistry.register(runtime);
    const second = secondRegistry.register(runtime);

    assert.equal(first.identity, second.identity);
    assert.equal(store.publishedCount, 1);
  });

  test("keeps incomplete writes invisible and recoverable", () => {
    const store = new IsolatedPersistentTestStore();
    const identity = getRuntimeIdentity(runtime);
    store.failNextWrite = true;

    assert.throws(() => store.putIfAbsent(identity, runtime), /simulated interrupted write/);
    assert.equal(store.get(identity), undefined);

    assert.equal(store.putIfAbsent(identity, runtime), true);
    assert.deepEqual(store.get(identity), runtime);
  });

  test("rejects corrupted stored packages through the registry integrity check", () => {
    const store = new IsolatedPersistentTestStore();
    const registry = new RuntimePackageRegistry(store);
    const identity = registry.register(runtime).identity;
    store.corrupt(identity);

    assert.throws(() => registry.get(identity), /integrity check failed/);
  });
});

class IsolatedPersistentTestStore implements PersistentRuntimePackageStore {
  private readonly records = new Map<RuntimeIdentity, RuntimePackage>();
  failNextWrite = false;
  putIfAbsentCalls = 0;

  get(identity: RuntimeIdentity): RuntimePackage | undefined {
    const packageRecord = this.records.get(identity);
    return packageRecord ? clone(packageRecord) : undefined;
  }

  put(identity: RuntimeIdentity, runtime: RuntimePackage): void {
    if (!this.putIfAbsent(identity, runtime)) {
      throw new Error(`identity already exists: ${identity}`);
    }
  }

  putIfAbsent(identity: RuntimeIdentity, runtime: RuntimePackage): boolean {
    this.putIfAbsentCalls += 1;
    if (this.records.has(identity)) return false;
    if (this.failNextWrite) {
      this.failNextWrite = false;
      throw new Error("simulated interrupted write");
    }

    const staged = clone(runtime);
    this.records.set(identity, staged);
    return true;
  }

  get publishedCount(): number {
    return this.records.size;
  }

  corrupt(identity: RuntimeIdentity): void {
    const packageRecord = this.records.get(identity);
    if (!packageRecord) return;
    this.records.set(identity, {
      ...packageRecord,
      files: { ...packageRecord.files, "runtime.js": "corrupted" },
    });
  }
}

function clone(packageRecord: RuntimePackage): RuntimePackage {
  return {
    manifest: {
      ...packageRecord.manifest,
      capabilities: [...packageRecord.manifest.capabilities],
      assets: packageRecord.manifest.assets.map((asset) => ({ ...asset })),
      ...(packageRecord.manifest.metadata ? { metadata: { ...packageRecord.manifest.metadata } } : {}),
    },
    files: { ...packageRecord.files },
  };
}
