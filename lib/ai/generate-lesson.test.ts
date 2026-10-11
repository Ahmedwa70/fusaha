import { register } from "node:module";
import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

// Register module hooks BEFORE importing the system under test, so its
// "server-only" / "ai" / "@/..." imports resolve to the test mocks.
register(new URL("./generate-lesson.test-hooks.mjs", import.meta.url).href);

// Computed specifiers: Node's type stripping requires the real ".ts"
// extension at runtime, and the computed form avoids TS5097 (the project
// keeps allowImportingTsExtensions off and tsconfig.json untouched).
const { generateLessonContent } = await import("./generate-lesson" + ".ts");
const { NoObjectGeneratedError } = await import("ai");

type GenerateTextStub = () => Promise<unknown>;

declare global {
  var __generateTextStub: GenerateTextStub | undefined;
}

// Shaped per the real ai SDK constructor; the mock accepts and ignores the
// extra fields.
const makeParseError = () =>
  new NoObjectGeneratedError({
    message: "could not parse the response.",
    text: '{"partial":',
    response: { id: "mock-response", timestamp: new Date(0), modelId: "mock-model" },
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      inputTokenDetails: { noCacheTokens: undefined, cacheReadTokens: undefined, cacheWriteTokens: undefined },
      outputTokenDetails: { textTokens: undefined, reasoningTokens: undefined },
    },
    finishReason: "length" as const,
  });

const t = (key: string) => key;
const input = {
  source: { kind: "text" as const, text: "lesson source text" },
  systemPrompt: "system prompt",
  blueprint: "short blueprint", // lines < ECHO_MIN_LINE_LENGTH → echo check no-ops
  validationScript: "",
};
const okResult = {
  output: { lesson: "generated content" },
  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
};

beforeEach(() => {
  globalThis.__generateTextStub = undefined;
});

describe("generateLessonContent retry on NoObjectGeneratedError", () => {
  test("parse failure on attempts 1-2 is retried; attempt 3 succeeds", async () => {
    let calls = 0;
    globalThis.__generateTextStub = async () => {
      calls++;
      if (calls < 3) {
        throw makeParseError();
      }
      return okResult;
    };

    const result = await generateLessonContent(input, t);

    assert.equal(calls, 3, "all three attempts should have been used");
    assert.equal(result.attempts, 3);
    assert.deepEqual(result.content, okResult.output);
  });

  test("parse failure on every attempt throws after exactly MAX_ATTEMPTS (3) calls", async () => {
    let calls = 0;
    globalThis.__generateTextStub = async () => {
      calls++;
      throw makeParseError();
    };

    await assert.rejects(
      () => generateLessonContent(input, t),
      (err: unknown) => {
        assert.ok(err instanceof NoObjectGeneratedError, "the parse error itself must propagate");
        return true;
      }
    );
    assert.equal(calls, 3, "must stop retrying after the last attempt");
  });

  test("non-parse errors still fail fast on the first attempt", async () => {
    let calls = 0;
    const boom = new Error("network down");
    globalThis.__generateTextStub = async () => {
      calls++;
      throw boom;
    };

    await assert.rejects(() => generateLessonContent(input, t), boom);
    assert.equal(calls, 1, "non-parse errors must not be retried");
  });
});
