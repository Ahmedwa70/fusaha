import { task, logger as triggerLogger } from "@trigger.dev/sdk";
import { eq } from "drizzle-orm";
import { createTranslator } from "next-intl";
import * as Sentry from "@sentry/nextjs";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { lessons, lessonVersions, generationEvents, LessonState, type SourceType } from "@/database/schema";
import { generateLessonContent, type GenerationSource } from "@/lib/ai/generate-lesson";
import type { Locale } from "@/i18n/config";
import ar from "@/messages/ar.json";
import en from "@/messages/en.json";
import zh from "@/messages/zh.json";

// next-intl's getTranslations (next-intl/server) requires Next.js's
// server-component bundler condition to resolve — outside a Next.js request
// (this task runs in a plain Node process on Trigger.dev) it silently
// resolves to the client-only build and throws. createTranslator works
// anywhere given the messages directly.
const messagesByLocale = { ar, en, zh } as const;

// sentry.server.config.ts only runs inside Next.js's own boot sequence, so
// it never initializes Sentry in this separate Trigger.dev process —
// without this, captureException below silently no-ops (safe, but errors
// here would never actually reach Sentry).
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
}

export type GenerateLessonPayload = {
  lessonId: string;
  versionId: string;
  teacherId: string;
  locale: Locale;
  source: GenerationSource;
  sourceType: SourceType;
  systemPrompt: string;
  blueprint: string;
  validationScript: string;
  lessonNameInput: string;
};

// Runs the LLM call outside Vercel's serverless function timeout (60s on the
// Hobby plan, which lesson generation regularly exceeds for image sources).
// Vercel platform-level timeout kills bypass all try/catch in the request
// handler, leaving lessons stuck on "Generating" with credits deducted and
// never refunded — running this here means a failure is a normal JS
// exception we can catch, log, and refund from.
export const generateLessonTask = task({
  id: "generate-lesson",
  maxDuration: 600,
  run: async (payload: GenerateLessonPayload) => {
    const { lessonId, versionId, teacherId, locale, source, sourceType, systemPrompt, blueprint, validationScript, lessonNameInput } = payload;
    const tContent = createTranslator({
      locale,
      messages: messagesByLocale[locale],
      namespace: "validation.generation",
    });

    const startedAt = Date.now();
    try {
      const { content, usage, validation, attempts } = await generateLessonContent(
        { source, systemPrompt, blueprint, validationScript },
        tContent as (key: string) => string
      );
      const durationMs = Date.now() - startedAt;

     
      if (validation.errors.length > 0) {
        throw new Error(
          `Template validation failed after ${attempts} attempt(s): ${validation.errors.join("; ")}`
        );
      }

      await db.transaction(async (tx) => {
        await tx.update(lessonVersions).set({ content }).where(eq(lessonVersions.id, versionId));
        await tx.update(lessons).set({ state: LessonState.Draft }).where(eq(lessons.id, lessonId));
        if (!lessonNameInput) {
          const fallbackTitle = (content as { meta?: { title?: string } })?.meta?.title;
          await tx.update(lessons).set({ name: fallbackTitle || tContent("untitledLesson") }).where(eq(lessons.id, lessonId));
        }
        await tx.insert(generationEvents).values({
          lessonId,
          teacherId,
          sourceType,
          success: true,
          durationMs,
          promptTokens: usage.promptTokens,
          completionTokens: usage.completionTokens,
          totalTokens: usage.totalTokens,
        });
      });

      if (validation.warnings.length) {
        triggerLogger.warn("Template validation flagged warnings", { lessonId, warnings: validation.warnings });
        logger.warn({ lessonId, warnings: validation.warnings }, "Template validation flagged warnings");
      }
    } catch (err) {
      const durationMs = Date.now() - startedAt;
      logger.error({ lessonId, err }, "Lesson generation failed");
      triggerLogger.error("Lesson generation failed", { lessonId, err });
      Sentry.captureException(err, { extra: { lessonId, versionId } });

      // Credits are not refunded on generation failure — the AI call (and
      // any retries) already consumed real cost regardless of outcome.
      await db.transaction(async (tx) => {
        await tx.update(lessons).set({ state: LessonState.GenerationFailed }).where(eq(lessons.id, lessonId));
        await tx.insert(generationEvents).values({
          lessonId,
          teacherId,
          sourceType,
          success: false,
          durationMs,
          errorMessage: err instanceof Error ? err.message : String(err),
        });
      });
    }
  },
});
