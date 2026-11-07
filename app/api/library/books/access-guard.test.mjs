// HTTP-level regression tests for the library stream/download access guard.
// Proves the routes enforce the access decision on EVERY request — including
// direct URLs and Range requests — before any byte is fetched from storage.
import assert from "node:assert/strict";
import { register } from "node:module";
import { beforeEach, describe, test } from "node:test";

register(new URL("./access-guard.test-hooks.mjs", import.meta.url).href);

const { viewerState } = await import("./test-stubs/viewer-stub.mjs");
const { r2State } = await import("./test-stubs/r2-client-stub.mjs");
const { GET: streamGET } = await import("./[slug]/stream/route.ts");
const { GET: downloadGET } = await import("./[slug]/download/route.ts");

const params = { params: Promise.resolve({ slug: "test-book" }) };

const makeBundle = () => ({
  book: {
    id: "b1",
    slug: "test-book",
    accessStatus: "free_reading",
    publicationStatus: "published",
    reviewStatus: "verified",
  },
  bookFile: { bookId: "b1", fileId: "f1" },
  file: { storageKey: "library/pdfs/ab/abcdef.pdf", originalFilename: "book.pdf" },
});

const makeAccess = ({ read, download }) => ({
  viewer: { userId: "u1", canManageLibrary: false },
  bundle: makeBundle(),
  read,
  download,
});

beforeEach(() => {
  viewerState.access = null;
  viewerState.calls.length = 0;
  r2State.object = null;
  r2State.rangeObject = null;
  r2State.calls.length = 0;
});

describe("stream route", () => {
  test("denied decision returns 403 and never touches storage — even with a Range header", async () => {
    viewerState.access = makeAccess({
      read: { allowed: false, reason: "not_published" },
      download: { allowed: false, reason: "not_published" },
    });
    const request = new Request("https://app.test/api/library/books/test-book/stream", {
      headers: { range: "bytes=0-99" },
    });
    const response = await streamGET(request, params);
    assert.equal(response.status, 403);
    assert.deepEqual(r2State.calls, []);
  });

  test("allowed read streams the full object with safe headers", async () => {
    viewerState.access = makeAccess({
      read: { allowed: true },
      download: { allowed: false, reason: "no_grant" },
    });
    r2State.object = { body: "PDFBYTES", contentLength: 8 };
    const response = await streamGET(new Request("https://app.test/api/library/books/test-book/stream"), params);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "application/pdf");
    assert.equal(response.headers.get("content-disposition"), "inline; filename*=UTF-8''book.pdf");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("accept-ranges"), "bytes");
    assert.equal(await response.text(), "PDFBYTES");
  });

  test("valid Range request gets 206 with Content-Range after authorization", async () => {
    viewerState.access = makeAccess({
      read: { allowed: true },
      download: { allowed: false, reason: "no_grant" },
    });
    r2State.rangeObject = { status: 206, body: "PDFB", start: 0, end: 3, total: 8 };
    const request = new Request("https://app.test/api/library/books/test-book/stream", {
      headers: { range: "bytes=0-3" },
    });
    const response = await streamGET(request, params);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), "bytes 0-3/8");
    assert.equal(response.headers.get("content-length"), "4");
    assert.equal(await response.text(), "PDFB");
    assert.deepEqual(r2State.calls, [{ kind: "range", key: "library/pdfs/ab/abcdef.pdf", rangeHeader: "bytes=0-3" }]);
  });

  test("out-of-bounds Range gets 416 without leaking content", async () => {
    viewerState.access = makeAccess({
      read: { allowed: true },
      download: { allowed: false, reason: "no_grant" },
    });
    r2State.rangeObject = { status: 416, total: 8 };
    const request = new Request("https://app.test/api/library/books/test-book/stream", {
      headers: { range: "bytes=100-200" },
    });
    const response = await streamGET(request, params);
    assert.equal(response.status, 416);
    assert.equal(response.headers.get("content-range"), "bytes */8");
  });
});

describe("download route", () => {
  test("read-only access cannot download — 403 before storage", async () => {
    viewerState.access = makeAccess({
      read: { allowed: true },
      download: { allowed: false, reason: "no_grant" },
    });
    const response = await downloadGET(new Request("https://app.test/api/library/books/test-book/download"), params);
    assert.equal(response.status, 403);
    assert.deepEqual(r2State.calls, []);
  });

  test("granted download serves the attachment", async () => {
    viewerState.access = makeAccess({
      read: { allowed: true },
      download: { allowed: true },
    });
    r2State.object = { body: "PDFBYTES", contentLength: 8 };
    const response = await downloadGET(new Request("https://app.test/api/library/books/test-book/download"), params);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-disposition"), "attachment; filename*=UTF-8''book.pdf");
  });

  test("Range request on download requires authorization too", async () => {
    viewerState.access = makeAccess({
      read: { allowed: true },
      download: { allowed: false, reason: "no_grant" },
    });
    const request = new Request("https://app.test/api/library/books/test-book/download", {
      headers: { range: "bytes=0-3" },
    });
    const response = await downloadGET(request, params);
    assert.equal(response.status, 403);
    assert.deepEqual(r2State.calls, []);
  });

  test("authorized Range download gets 206", async () => {
    viewerState.access = makeAccess({
      read: { allowed: true },
      download: { allowed: true },
    });
    r2State.rangeObject = { status: 206, body: "PDFB", start: 0, end: 3, total: 8 };
    const request = new Request("https://app.test/api/library/books/test-book/download", {
      headers: { range: "bytes=0-3" },
    });
    const response = await downloadGET(request, params);
    assert.equal(response.status, 206);
    assert.equal(response.headers.get("content-range"), "bytes 0-3/8");
  });
});
