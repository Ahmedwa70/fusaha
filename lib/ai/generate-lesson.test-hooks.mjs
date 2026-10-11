// Module-resolution hooks for generate-lesson.test.ts.
//
// The system under test (lib/ai/generate-lesson.ts) is a server-only module
// that imports "server-only", the real "ai" SDK, and "@/..." aliased modules
// that touch the database. None of those resolve (or are safe to execute)
// under a plain node:test run, so this hook serves tiny in-memory mocks for
// exactly those specifiers and leaves every other module to Node.
//
// The "ai" mock is driven by globalThis.__generateTextStub, which the test
// installs per case — that is how generateText calls are scripted.

const aiMock = `
export class NoObjectGeneratedError extends Error {
  constructor(opts = {}) {
    super(opts.message ?? "could not parse the response");
    this.name = "NoObjectGeneratedError";
    this.text = opts.text ?? null;
    this.usage = opts.usage ?? null;
    this.finishReason = opts.finishReason ?? null;
  }
  static isInstance(error) {
    return error instanceof NoObjectGeneratedError;
  }
}
export const Output = { object: (options) => ({ __outputObject: true, options }) };
export const generateText = async () => {
  const stub = globalThis.__generateTextStub;
  if (typeof stub !== "function") throw new Error("generateText stub not configured");
  return stub();
};
`;

const mocks = {
  "server-only": "export {};\n",
  ai: aiMock,
  "@/lib/ai/deepseek-client": `export const getDeepSeekTextModel = async () => ({ id: "text-mock" });
export const getDeepSeekVisionModel = async () => ({ id: "vision-mock" });`,
  "@/lib/ai/lesson-content-schema": `export const lessonContentSchema = () => ({});
`,
  "@/lib/templates/run-validation": `export const runTemplateValidation = () => ({ errors: [], warnings: [] });
`,
  "@/lib/logger": `export const logger = { info() {}, error() {}, warn() {}, debug() {} };
`,
};

export async function resolve(specifier, context, nextResolve) {
  if (Object.hasOwn(mocks, specifier)) {
    return { url: "mock:" + specifier, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url.startsWith("mock:")) {
    return { format: "module", source: mocks[url.slice(5)], shortCircuit: true };
  }
  return nextLoad(url, context);
}
