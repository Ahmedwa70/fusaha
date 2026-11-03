import { createHash } from "node:crypto";
import { createServer } from "node:http";

const delay = (milliseconds = 0) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function normalizePath(path) {
  if (typeof path !== "string" || !path || path.includes("\\") || path.startsWith("/") || path.split("/").includes("..")) {
    throw new Error(`invalid runtime path: ${path}`);
  }
  return path.normalize("NFC");
}

export function createPackage(files, { entryPoint = "index.html", runtimeId = "html-player", runtimeVersion = "poc-1" } = {}) {
  const normalizedFiles = Object.entries(files)
    .map(([path, content]) => [normalizePath(path), Buffer.isBuffer(content) ? Buffer.from(content) : Buffer.from(content)])
    .sort(([left], [right]) => Buffer.from(left).compare(Buffer.from(right)));
  const seen = new Set();
  const assets = normalizedFiles.map(([path, content]) => {
    if (seen.has(path)) throw new Error(`duplicate runtime path: ${path}`);
    seen.add(path);
    return { path, contentSha256: sha256(content), sizeBytes: content.length, contentType: contentTypeFor(path) };
  });
  const manifest = stableValue({
    contractVersion: "poc-v1",
    runtimeId,
    runtimeVersion,
    packageKind: "multi-file",
    entryPoint: normalizePath(entryPoint),
    assets,
  });
  const manifestBytes = Buffer.from(JSON.stringify(manifest));
  const framed = [Buffer.from("runtime-package/v1\0"), uint64(manifestBytes.length), manifestBytes];
  for (const [path, content] of normalizedFiles) {
    const pathBytes = Buffer.from(path);
    framed.push(uint64(pathBytes.length), pathBytes, uint64(content.length), content);
  }
  const identity = `sha256-v1-${sha256(Buffer.concat(framed))}`;
  return { identity, manifest, files: new Map(normalizedFiles), manifestSha256: sha256(manifestBytes) };
}

function uint64(number) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(number));
  return bytes;
}

function contentTypeFor(path) {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  return "application/octet-stream";
}

class ImmutableObjectStore {
  #objects = new Map();

  create(key, bytes, { published = false } = {}) {
    if (this.#objects.has(key)) throw new Error(`object already exists: ${key}`);
    this.#objects.set(key, { bytes: Buffer.from(bytes), published });
    return key;
  }

  promote(stagingKey, finalKey) {
    const staged = this.#objects.get(stagingKey);
    if (!staged) throw new Error(`missing staged object: ${stagingKey}`);
    if (!this.#objects.has(finalKey)) this.#objects.set(finalKey, { bytes: Buffer.from(staged.bytes), published: true });
    else if (!this.#objects.get(finalKey).bytes.equals(staged.bytes)) throw new Error(`final object conflict: ${finalKey}`);
    return finalKey;
  }

  read(key) {
    const object = this.#objects.get(key);
    if (!object) throw new Error(`object not found: ${key}`);
    return Buffer.from(object.bytes);
  }

  mutate(key, bytes) {
    const object = this.#objects.get(key);
    if (!object) throw new Error(`object not found: ${key}`);
    if (object.published) throw new Error(`published object is write-once: ${key}`);
    object.bytes = Buffer.from(bytes);
  }

  delete(key) {
    const object = this.#objects.get(key);
    if (object?.published) throw new Error(`published object cannot be deleted: ${key}`);
    this.#objects.delete(key);
  }
}

export class IsolatedRuntimeStore {
  #objects = new ImmutableObjectStore();
  #attempts = new Map();
  #runtimes = new Map();
  #publishedByIdentity = new Map();
  #inflightByIdentity = new Map();
  #nextAttempt = 1;

  async publish(packageData, idempotencyKey, { crashAfter = null, delayMs = 1 } = {}) {
    let attempt = this.#attempts.get(idempotencyKey);
    if (attempt && attempt.requestFingerprint !== packageData.identity) throw new Error("idempotency key reused for different package");
    if (attempt?.completion) return attempt.completion;
    if (!attempt) {
      attempt = {
        id: `attempt-${this.#nextAttempt++}`,
        idempotencyKey,
        requestFingerprint: packageData.identity,
        state: "created",
        fencingToken: 0,
        nextFile: 0,
      };
      this.#attempts.set(idempotencyKey, attempt);
    }
    const existing = this.#publishedByIdentity.get(packageData.identity);
    if (existing) return existing;
    const inflight = this.#inflightByIdentity.get(packageData.identity);
    if (inflight) return inflight;
    if (attempt.state === "expired") return this.recover(attempt.id, packageData, { delayMs });
    attempt.completion = this.#startExecution(attempt, packageData, { crashAfter, delayMs });
    return attempt.completion;
  }

  #startExecution(attempt, packageData, options) {
    const completion = this.#execute(attempt, packageData, options);
    this.#inflightByIdentity.set(packageData.identity, completion);
    completion.then(
      () => { if (this.#inflightByIdentity.get(packageData.identity) === completion) this.#inflightByIdentity.delete(packageData.identity); },
      () => { if (this.#inflightByIdentity.get(packageData.identity) === completion) this.#inflightByIdentity.delete(packageData.identity); },
    );
    return completion;
  }

  async #execute(attempt, packageData, { crashAfter, delayMs }) {
    attempt.state = "leased";
    attempt.fencingToken += 1;
    const token = attempt.fencingToken;
    try {
      attempt.state = "uploading";
      for (const [path, bytes] of packageData.files) {
        await delay(delayMs);
        const stagingKey = `runtime-staging/${attempt.id}/${token}/${path}`;
        if (!this.#hasObject(stagingKey)) this.#objects.create(stagingKey, bytes);
        attempt.nextFile += 1;
      }
      if (crashAfter === "upload") throw new Error("simulated crash after staging upload");
      attempt.state = "verifying";
      for (const [path, bytes] of packageData.files) {
        const stagingKey = `runtime-staging/${attempt.id}/${token}/${path}`;
        if (!this.#objects.read(stagingKey).equals(bytes)) throw new Error(`staged hash mismatch: ${path}`);
      }
      if (crashAfter === "verify") throw new Error("simulated crash after verification");
      attempt.state = "finalizing";
      const assets = [];
      for (const asset of packageData.manifest.assets) {
        const stagingKey = `runtime-staging/${attempt.id}/${token}/${asset.path}`;
        const finalKey = `runtime/${packageData.identity}/${asset.contentSha256}`;
        this.#objects.promote(stagingKey, finalKey);
        assets.push({ ...asset, objectKey: finalKey });
      }
      if (crashAfter === "finalize") throw new Error("simulated crash before publication transaction");
      const runtime = {
        id: `runtime-${packageData.identity.slice(-16)}`,
        identity: packageData.identity,
        state: "published",
        manifest: packageData.manifest,
        assets,
        manifestSha256: packageData.manifestSha256,
      };
      this.#runtimes.set(runtime.id, runtime);
      this.#publishedByIdentity.set(packageData.identity, runtime);
      attempt.state = "published";
      attempt.runtimeId = runtime.id;
      return runtime;
    } catch (error) {
      attempt.state = "expired";
      attempt.error = error.message;
      attempt.completion = null;
      throw Object.assign(new Error(error.message), { attemptId: attempt.id });
    }
  }

  async recover(attemptId, packageData, { delayMs = 1 } = {}) {
    const attempt = [...this.#attempts.values()].find((candidate) => candidate.id === attemptId);
    if (!attempt) throw new Error(`attempt not found: ${attemptId}`);
    if (attempt.requestFingerprint !== packageData.identity) throw new Error("recovery fingerprint mismatch");
    if (attempt.state === "published") return this.#runtimes.get(attempt.runtimeId);
    attempt.completion = this.#startExecution(attempt, packageData, { crashAfter: null, delayMs });
    return attempt.completion;
  }

  getAttempt(idempotencyKey) {
    return this.#attempts.get(idempotencyKey);
  }

  getPublished(identity) {
    return this.#publishedByIdentity.get(identity) ?? null;
  }

  tryMutatePublishedAsset(identity, path, bytes) {
    const runtime = this.#publishedByIdentity.get(identity);
    const asset = runtime?.assets.find((candidate) => candidate.path === path);
    if (!asset) throw new Error("published asset not found");
    this.#objects.mutate(asset.objectKey, bytes);
  }

  readAsset(identity, path) {
    const runtime = this.#publishedByIdentity.get(identity);
    if (!runtime || runtime.state !== "published") throw new Error("runtime is not published");
    const normalizedPath = normalizePath(path);
    const asset = runtime.assets.find((candidate) => candidate.path === normalizedPath);
    if (!asset) throw new Error("asset not found");
    return { bytes: this.#objects.read(asset.objectKey), contentType: asset.contentType };
  }

  #hasObject(key) {
    try {
      this.#objects.read(key);
      return true;
    } catch {
      return false;
    }
  }
}

export async function createRuntimeServer(store, identity) {
  const server = createServer((request, response) => {
    const prefix = `/runtime/v1/${identity}/`;
    if (!request.url?.startsWith(prefix)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const assetPath = decodeURIComponent(request.url.slice(prefix.length));
      const asset = store.readAsset(identity, assetPath);
      response.writeHead(200, {
        "Content-Type": asset.contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
      }).end(asset.bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return { server, baseUrl: `http://127.0.0.1:${port}/runtime/v1/${identity}/` };
}
