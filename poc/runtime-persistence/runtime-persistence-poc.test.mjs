import assert from "node:assert/strict";
import test from "node:test";
import { createPackage, createRuntimeServer, IsolatedRuntimeStore } from "./runtime-persistence-poc.mjs";

function fixturePackage() {
  return createPackage({
    "index.html": `<!doctype html><html><head><link rel="stylesheet" href="./assets/app.css"></head><body><div id="app">مرحبا</div><script src="./assets/app.js"></script></body></html>`,
    "assets/app.css": "#app { color: teal; }",
    "assets/app.js": "document.querySelector('#app').dataset.loaded = 'true';",
    "assets/icon.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"><circle cx=\"5\" cy=\"5\" r=\"4\"/></svg>",
  });
}

test("1. identical package inputs produce the same content-addressed identity", { concurrency: false }, () => {
  const first = fixturePackage();
  const second = fixturePackage();
  assert.equal(first.identity, second.identity);
  assert.equal(first.manifestSha256, second.manifestSha256);
  assert.deepEqual(first.manifest, second.manifest);
});

test("2. concurrent registrations publish one Runtime identity", { concurrency: false }, async () => {
  const store = new IsolatedRuntimeStore();
  const packageData = fixturePackage();
  const [first, second] = await Promise.all([
    store.publish(packageData, "request-a", { delayMs: 2 }),
    store.publish(packageData, "request-b", { delayMs: 2 }),
  ]);
  assert.equal(first.id, second.id);
  assert.equal(store.getPublished(packageData.identity)?.id, first.id);
  assert.equal(store.getAttempt("request-a")?.state, "published");
  assert.equal(store.getAttempt("request-b")?.state, "created");
});

test("3. publication stays invisible until every asset is uploaded and verified", { concurrency: false }, async () => {
  const store = new IsolatedRuntimeStore();
  const packageData = fixturePackage();
  const publishing = store.publish(packageData, "publication-safety", { delayMs: 5 });
  await new Promise((resolve) => setTimeout(resolve, 1));
  assert.equal(store.getPublished(packageData.identity), null);
  assert.notEqual(store.getAttempt("publication-safety")?.state, "published");
  const runtime = await publishing;
  assert.equal(runtime.state, "published");
  assert.equal(runtime.assets.length, 4);
});

test("4. a crashed attempt can be recovered without an inconsistent publication", { concurrency: false }, async () => {
  const store = new IsolatedRuntimeStore();
  const packageData = fixturePackage();
  await assert.rejects(
    store.publish(packageData, "crash-after-verify", { crashAfter: "verify" }),
    (error) => error.attemptId === "attempt-1",
  );
  const attempt = store.getAttempt("crash-after-verify");
  assert.equal(attempt.state, "expired");
  assert.equal(store.getPublished(packageData.identity), null);
  const recovered = await store.recover(attempt.id, packageData);
  assert.equal(recovered.state, "published");
  assert.equal(store.getPublished(packageData.identity)?.id, recovered.id);
  assert.ok(attempt.fencingToken >= 2);
});

test("5. published objects are write-once", { concurrency: false }, async () => {
  const store = new IsolatedRuntimeStore();
  const packageData = fixturePackage();
  await store.publish(packageData, "write-once");
  assert.throws(
    () => store.tryMutatePublishedAsset(packageData.identity, "assets/app.js", "alert('replaced')"),
    /write-once/,
  );
  const original = store.readAsset(packageData.identity, "assets/app.js").bytes.toString();
  assert.equal(original, "document.querySelector('#app').dataset.loaded = 'true';");
});

test("6. multi-file delivery serves the entry point and linked assets", { concurrency: false }, async (t) => {
  const store = new IsolatedRuntimeStore();
  const packageData = fixturePackage();
  await store.publish(packageData, "multi-file-delivery");
  const { server, baseUrl } = await createRuntimeServer(store, packageData.identity);
  t.after(() => server.close());

  const htmlResponse = await fetch(`${baseUrl}index.html`);
  const html = await htmlResponse.text();
  assert.equal(htmlResponse.status, 200);
  assert.match(html, /assets\/app\.css/);
  assert.match(html, /assets\/app\.js/);

  const [cssResponse, jsResponse, svgResponse] = await Promise.all([
    fetch(`${baseUrl}assets/app.css`),
    fetch(`${baseUrl}assets/app.js`),
    fetch(`${baseUrl}assets/icon.svg`),
  ]);
  assert.equal(cssResponse.status, 200);
  assert.equal(jsResponse.status, 200);
  assert.equal(svgResponse.status, 200);
  assert.match(cssResponse.headers.get("content-type"), /text\/css/);
  assert.match(jsResponse.headers.get("content-type"), /text\/javascript/);
  assert.match(svgResponse.headers.get("content-type"), /image\/svg\+xml/);
  assert.equal(await cssResponse.text(), "#app { color: teal; }");
  assert.match(await jsResponse.text(), /dataset\.loaded/);
  assert.match(await svgResponse.text(), /<circle/);

  const traversalResponse = await fetch(`${baseUrl}../secret.txt`);
  assert.equal(traversalResponse.status, 404);
});
