import { register } from "node:module";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, test } from "node:test";

register(new URL("./runtime-contract.test-hooks.mjs", import.meta.url).href);

const { getRuntimeIdentity } = await import("./hash" + ".ts");
const { InMemoryRuntimePackageStore, RuntimePackageError, RuntimePackageRegistry } = await import("./registry" + ".ts");
import type { RuntimePackage } from "./types";

type RuntimeIdentity = `sha256-${string}`;

const singleFile: RuntimePackage = {
  manifest: {
    contractVersion: "1.0",
    runtimeId: "html-player",
    runtimeVersion: "1.0.0",
    packageKind: "single-file",
    entryPoint: "index.html",
    capabilities: ["lesson-data"],
    assets: [],
  },
  files: { "index.html": "<main id=app></main>" },
};

const script = "export const initializeLesson = () => undefined;";
const scriptIntegrity = `sha256-${createHash("sha256").update(script).digest("hex")}` as const;

const multiFile: RuntimePackage = {
  manifest: {
    contractVersion: "1.0",
    runtimeId: "canvas-activity",
    runtimeVersion: "2.0.0",
    packageKind: "multi-file",
    entryPoint: "index.html",
    capabilities: ["lesson-data"],
    assets: [{ path: "runtime.js", contentType: "text/javascript", integrity: scriptIntegrity, sizeBytes: Buffer.byteLength(script) }],
  },
  files: {
    "index.html": "<canvas id=app></canvas>",
    "runtime.js": script,
    "styles.css": "canvas { display: block; }",
  },
};

describe("runtime package registry", () => {
  test("registers and retrieves a valid single-file package", () => {
    const registry = new RuntimePackageRegistry();
    const registered = registry.register(singleFile);

    assert.equal(registered.identity, getRuntimeIdentity(singleFile));
    assert.deepEqual(registry.get(registered.identity), registered);
    assert.equal(registry.has(registered.identity), true);
  });

  test("reuses an identical package identity", () => {
    const registry = new RuntimePackageRegistry();
    const first = registry.register(singleFile);
    const second = registry.register({
      ...singleFile,
      manifest: { ...singleFile.manifest, capabilities: ["lesson-data"] },
      files: { "index.html": singleFile.files["index.html"] },
    });

    assert.equal(second.identity, first.identity);
  });

  test("supports multi-file packages and verifies declared assets", () => {
    const registry = new RuntimePackageRegistry();
    const registered = registry.register(multiFile);

    assert.equal(registered.package.manifest.packageKind, "multi-file");
    assert.equal(registered.package.files["runtime.js"], script);
  });

  test("rejects invalid manifests and missing assets", () => {
    const registry = new RuntimePackageRegistry();
    const invalid = {
      ...multiFile,
      manifest: { ...multiFile.manifest, entryPoint: "missing.html" },
    };

    assert.throws(
      () => registry.register(invalid),
      (error: unknown) => {
        const candidate = error as { code?: string };
        return error instanceof RuntimePackageError && candidate.code === "invalid-package";
      }
    );
  });

  test("rejects corrupted asset contents before registration", () => {
    const registry = new RuntimePackageRegistry();
    const corrupted = {
      ...multiFile,
      files: { ...multiFile.files, "runtime.js": "tampered" },
    };

    assert.throws(
      () => registry.register(corrupted),
      (error: unknown) => {
        const candidate = error as { message?: string };
        return error instanceof RuntimePackageError && candidate.message?.includes("Asset integrity") === true;
      }
    );
  });

  test("detects corruption during retrieval", () => {
    const storage = new MutableTestStore();
    const registry = new RuntimePackageRegistry(storage);
    const registered = registry.register(singleFile);
    storage.replace(registered.identity, { ...singleFile, files: { "index.html": "tampered" } });

    assert.throws(
      () => registry.get(registered.identity),
      (error: unknown) => {
        const candidate = error as { code?: string };
        return error instanceof RuntimePackageError && candidate.code === "runtime-corrupted";
      }
    );
  });

  test("keeps retrieved packages isolated from stored contents", () => {
    const registry = new RuntimePackageRegistry();
    const registered = registry.register(singleFile);
    const retrieved = registry.get(registered.identity);
    (retrieved.package.files as Record<string, string>)["index.html"] = "mutated";

    assert.equal(registry.get(registered.identity).package.files["index.html"], singleFile.files["index.html"]);
  });

  test("rejects mutation of an already registered identity", () => {
    const store = new InMemoryRuntimePackageStore();
    const identity = getRuntimeIdentity(singleFile);
    store.put(identity, singleFile);

    assert.throws(
      () => store.put(identity, multiFile),
      (error: unknown) => {
        const candidate = error as { code?: string };
        return error instanceof RuntimePackageError && candidate.code === "runtime-identity-conflict";
      }
    );
  });

  test("reports missing identities clearly", () => {
    const registry = new RuntimePackageRegistry();

    assert.throws(
      () => registry.get("sha256-does-not-exist"),
      (error: unknown) => {
        const candidate = error as { code?: string };
        return error instanceof RuntimePackageError && candidate.code === "runtime-not-found";
      }
    );
  });

  test("keeps runtime identity independent from lesson and template identifiers", () => {
    const first = registryWithMetadata().register(singleFile).identity;
    const second = registryWithMetadata().register(singleFile).identity;

    assert.equal(first, second);
  });
});

function registryWithMetadata() {
  return new RuntimePackageRegistry();
}

class MutableTestStore {
  private readonly packages = new Map<RuntimeIdentity, RuntimePackage>();

  get(identity: RuntimeIdentity): RuntimePackage | undefined {
    return this.packages.get(identity);
  }

  put(identity: RuntimeIdentity, runtime: RuntimePackage): void {
    this.packages.set(identity, runtime);
  }

  replace(identity: RuntimeIdentity, runtime: RuntimePackage): void {
    this.packages.set(identity, runtime);
  }
}

