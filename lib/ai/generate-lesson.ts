import "server-only";
import { generateText, Output, type ModelMessage } from "ai";
import { getDeepSeekTextModel, getDeepSeekVisionModel } from "@/lib/ai/deepseek-client";
import { lessonContentSchema, type LessonContent } from "@/lib/ai/lesson-content-schema";
import { runTemplateValidation } from "@/lib/templates/run-validation";
import { logger } from "@/lib/logger";

export type GenerationSource =
  | { kind: "text"; text: string }
  | { kind: "images"; images: { base64: string; mediaType: string }[] };

export type GenerateLessonInput = {
  source: GenerationSource;
  systemPrompt: string;
  blueprint: string;
  validationScript: string;
};

const ECHO_MIN_LINE_LENGTH = 30;
const ECHO_MATCH_RATIO_THRESHOLD = 0.3;

function detectEchoedBlueprint(content: unknown, blueprint: string): string | null {
  const output = JSON.stringify(content);
  const distinctiveLines = blueprint
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length >= ECHO_MIN_LINE_LENGTH);
  if (distinctiveLines.length === 0) return null;

  const matched = distinctiveLines.filter((line) => output.includes(line));
  const ratio = matched.length / distinctiveLines.length;
  if (ratio <= ECHO_MATCH_RATIO_THRESHOLD) return null;

  return "The output reproduces large portions of the example's exact text/code instead of generating new content — it looks like the example was echoed back rather than used as a structural reference.";
}

function buildSystemPrompt(systemPrompt: string, blueprint: string): string {
  return [
    systemPrompt,
    "",
    "---",
    "STRICT OUTPUT RULES — read before the example below:",
    "- The block marked EXAMPLE further down is a structural reference only. It is not a draft, not a starting point, and must never appear — in whole or in large part — in your output.",
    "- Never copy the example's specific words, sentences, comment text, or code syntax into your response. Every piece of real content you write must be newly generated from the source material the user provides, in the requested language.",
    "- Match the example's *shape* only — the same top-level keys, the same nesting, the same kind of values — filled with entirely new content about the new source.",
    "- Your response is JSON data, not source code: never include JS syntax, comment banners, or a `module.exports` wrapper in it.",
    "",
    "===== EXAMPLE (structure reference only — do not reproduce) =====",
    blueprint,
    "===== END EXAMPLE =====",
    "",
    "Reminder: the example above is not your answer. Generate entirely fresh content for the source the user gives you next, following the example's structure but never its literal text.",
  ].join("\n");
}

function buildCorrectionMessage(errors: string[], echoIssue: string | null): string {
  const lines = [
    "Your previous response is invalid and cannot be used. Produce a corrected, complete lesson object that fixes every issue below.",
  ];
  if (echoIssue) {
    lines.push(`- ${echoIssue} Write entirely new content about the actual source provided — do not reuse the example's text, keys, or structure literally.`);
  }
  for (const error of errors) {
    lines.push(`- ${error}`);
  }
  lines.push("Return the full corrected lesson object again in one response — not just the changed parts, and not an explanation of what you fixed.");
  return lines.join("\n");
}

// Never log source.text/images in full — lesson source content, potentially
// large (base64 images) or containing learner-submitted text. A preview is
// enough to diagnose prompt-shape issues without bloating/leaking via logs.
function describeSource(source: GenerationSource) {
  if (source.kind === "text") {
    return { sourceKind: "text", textLength: source.text.length, textPreview: source.text.slice(0, 300) };
  }
  return { sourceKind: "images", imageCount: source.images.length };
}

function buildUserMessage(source: GenerationSource): ModelMessage {
  if (source.kind === "text") {
    return {
      role: "user",
      content: `Generate the lesson content from this source text:\n\n"""\n${source.text}\n"""`,
    };
  }
  return {
    role: "user",
    content: [
      { type: "text", text: "Generate the lesson content from these source image(s):" },
      ...source.images.map((img) => ({
        type: "image" as const,
        image: `data:${img.mediaType};base64,${img.base64}`,
      })),
    ],
  };
}

export type LessonGenerationUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type GenerateLessonResult = {
  content: LessonContent;
  usage: LessonGenerationUsage;
  // The validation result for the content actually returned (after any
  // retries) — the caller decides what a non-empty `errors` means for lesson
  // state; this function's job ends at "tried its best to get valid content."
  validation: { errors: string[]; warnings: string[] };
  attempts: number;
};

const MAX_ATTEMPTS = 3;

export async function generateLessonContent(
  input: GenerateLessonInput,
  t: (key: string) => string
): Promise<GenerateLessonResult> {
  const model = input.source.kind === "images" ? await getDeepSeekVisionModel() : await getDeepSeekTextModel();
  const system = buildSystemPrompt(input.systemPrompt, input.blueprint);
  const messages: ModelMessage[] = [buildUserMessage(input.source)];

  let usage: LessonGenerationUsage = {};
  let content: LessonContent | undefined;
  let validation: { errors: string[]; warnings: string[] } = { errors: [], warnings: [] };
  let attempt = 0;

  for (attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: lessonContentSchema(t) }),
        system,
        messages,
      });
      const durationMs = Date.now() - startedAt;
      content = result.output;
      usage = {
        promptTokens: result.usage.inputTokens,
        completionTokens: result.usage.outputTokens,
        totalTokens: result.usage.totalTokens,
      };

      const echoIssue = detectEchoedBlueprint(content, input.blueprint);
      const { errors, warnings } = runTemplateValidation(input.validationScript, content);
      validation = { errors: echoIssue ? [echoIssue, ...errors] : errors, warnings };

      logger.info(
        {
          sourceKind: input.source.kind,
          attempt,
          durationMs,
          promptTokens: result.usage.inputTokens,
          completionTokens: result.usage.outputTokens,
          totalTokens: result.usage.totalTokens,
          validationErrors: validation.errors,
          validationWarnings: validation.warnings,
        },
        "LLM lesson generation call completed"
      );

      if (validation.errors.length === 0 || attempt === MAX_ATTEMPTS) {
        break;
      }

      // Feed the actual assistant turn back so the model has its own prior
      // output in context, then tell it exactly what to fix — much more
      // effective than restarting the conversation from scratch each retry.
      messages.push({ role: "assistant", content: JSON.stringify(content) });
      messages.push({ role: "user", content: buildCorrectionMessage(validation.errors, echoIssue) });
    } catch (err) {
      logger.error(
        {
          err,
          attempt,
          durationMs: Date.now() - startedAt,
          systemPreview: system.slice(0, 1000),
          systemLength: system.length,
          ...describeSource(input.source),
        },
        "LLM lesson generation call failed"
      );
      throw err;
    }
  }

  return { content: content as LessonContent, usage, validation, attempts: attempt };
}
