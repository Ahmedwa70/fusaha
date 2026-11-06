// HTTP-level tests for the lesson play frame route
// (app/dashboard/lessons/[id]/run/frame/route.ts). These call the REAL route
// handler and assert on the actual Response object it returns — status,
// headers, and composed body. Auth and the play query are faked at the module
// boundary (route-test-*-stub.mjs); their real-database behavior, including
// the production incident scenario (Bound lesson whose template was retired),
// is proven by lesson-play-queries.test.ts and lesson-play-cutover.test.ts.

import assert from "node:assert/strict";
import { register } from "node:module";
import { beforeEach, describe, test } from "node:test";

register(new URL("./route.test-hooks.mjs", import.meta.url).href);

const { GET } = await import("./route.ts" as string);
const auth = await import("./route-test-auth-stub.mjs" as string);
const queries = await import("./route-test-queries-stub.mjs" as string);

const params = (id: string) => ({ params: Promise.resolve({ id }) });
const request = () => new Request("http://test.local/dashboard/lessons/lesson-1/run/frame");

describe("GET /dashboard/lessons/[id]/run/frame — HTTP contract", () => {
  beforeEach(() => {
    auth.state.user = { id: "teacher-1", roleName: "teacher" };
    queries.state.lesson = null;
    queries.state.lastCall = null;
  });

  test("unauthenticated → 401 with an empty body (fail closed, no login HTML in the iframe)", async () => {
    auth.state.user = null;
    const res = await GET(request(), params("lesson-1"));
    assert.equal(res.status, 401);
    assert.equal(await res.text(), "");
  });

  test("authenticated but not a teacher → 401", async () => {
    auth.state.user = { id: "student-9", roleName: "student" };
    const res = await GET(request(), params("lesson-1"));
    assert.equal(res.status, 401);
    assert.equal(await res.text(), "");
  });

  test("play resolution fails closed → 404 with an empty body (retired-template legacy lesson lands here)", async () => {
    queries.state.lesson = null;
    const res = await GET(request(), params("lesson-1"));
    assert.equal(res.status, 404);
    assert.equal(await res.text(), "");
  });

  test("bound lesson resolved from runtime → 200 text/html with the composed player document", async () => {
    queries.state.lesson = {
      name: "في العسل شفاء",
      content: { words: ["عسل", "شفاء"] },
      htmlPlayer: "<html><head></head><body>runtime-player-bytes</body></html>",
      playerSource: "runtime",
    };
    const res = await GET(request(), params("lesson-1"));
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/html/);
    const body = await res.text();
    assert.match(body, /runtime-player-bytes/);
    assert.match(body, /window\.LESSON_DATA/);
    assert.match(body, /"عسل"/);
  });

  test("scopes the play query to the authenticated teacher and the route id", async () => {
    queries.state.lesson = {
      name: "l",
      content: {},
      htmlPlayer: "<html></html>",
      playerSource: "runtime",
    };
    await GET(request(), params("lesson-42"));
    assert.deepEqual(queries.state.lastCall, { ownerId: "teacher-1", lessonId: "lesson-42" });
  });
});
