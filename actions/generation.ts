"use server";

import { and, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { tasks } from "@trigger.dev/sdk";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { lessons, lessonVersions, creditsLedgerEntries, users, LessonState, VersionStatus, SourceType } from "@/database/schema";
import { requireTeacher } from "@/lib/auth/dal";
import type { GenerationSource } from "@/lib/ai/generate-lesson";
import { extractTextFromFile } from "@/lib/ai/extract-file-text";
import { getSchemaDefinitionById } from "@/lib/admin/queries/schema-definition";
import { getTemplateById } from "@/lib/admin/queries/template";
import { getGenerationCost } from "@/lib/admin/settings";
import { MAX_TEXT_WORDS, MAX_IMAGES } from "@/constants/lesson-source-limits";
import type { generateLessonTask, GenerateLessonPayload } from "@/src/trigger/generate-lesson";
import type { Locale } from "@/i18n/config";

export type CreateLessonActionState = { error: string } | { success: true; lessonId: string };

class InsufficientCreditsError extends Error {}

export async function createLesson(formData: FormData): Promise<CreateLessonActionState> {
  const teacher = await requireTeacher();
  const t = await getTranslations("dashboard.wizard.errors");
  const tContent = await getTranslations("validation.generation");

  const sourceKind = formData.get("sourceKind");
  const schemaDefinitionId = String(formData.get("schemaDefinitionId") ?? "");
  const lessonNameInput = String(formData.get("lessonName") ?? "").trim();

  if (!schemaDefinitionId) return { error: t("invalidLevel") };
  const schemaDefinition = await getSchemaDefinitionById(schemaDefinitionId);
  if (!schemaDefinition) return { error: t("invalidLevel") };
  if (!schemaDefinition.templateId) return { error: t("invalidLevel") };
  const template = await getTemplateById(schemaDefinition.templateId);
  if (!template) return { error: t("invalidLevel") };

  let source: GenerationSource;
  let sourceType: SourceType;

  if (sourceKind === "text-write") {
    const text = String(formData.get("text") ?? "").trim();
    if (!text) return { error: t("textRequired") };
    const wordCount = text.split(/\s+/).length;
    if (wordCount > MAX_TEXT_WORDS) return { error: t("textTooLong") };
    source = { kind: "text", text };
    sourceType = SourceType.TextDirect;
  } else if (sourceKind === "text-upload") {
    const uploadedFile = formData.get("file");
    if (!(uploadedFile instanceof File) || uploadedFile.size === 0) return { error: t("fileRequired") };

    const extracted = await extractTextFromFile(uploadedFile);
    if (!extracted.ok) return { error: t(extracted.error) };

    source = { kind: "text", text: extracted.text };
    sourceType = extracted.kind === "pdf" ? SourceType.Pdf : SourceType.Docx;
  } else if (sourceKind === "images") {
    const files = formData.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length === 0) return { error: t("imagesRequired") };
    if (files.length > MAX_IMAGES) return { error: t("tooManyImages") };
    const images = await Promise.all(
      files.map(async (f) => ({
        base64: Buffer.from(await f.arrayBuffer()).toString("base64"),
        mediaType: f.type || "image/jpeg",
      }))
    );
    source = { kind: "images", images };
    sourceType = SourceType.Images;
  } else {
    return { error: t("invalidSource") };
  }

  const generationCost = await getGenerationCost();

  let created: { lessonId: string; versionId: string };
  try {
    created = await db.transaction(async (tx) => {
      const [lesson] = await tx
        .insert(lessons)
        .values({ ownerId: teacher.id, name: lessonNameInput || tContent("untitledLesson"), state: LessonState.Generating })
        .returning({ id: lessons.id });

      const deducted = await tx
        .update(users)
        .set({ creditsBalance: sql`${users.creditsBalance} - ${generationCost}` })
        .where(and(eq(users.id, teacher.id), gte(users.creditsBalance, generationCost)))
        .returning({ id: users.id });
      if (deducted.length === 0) throw new InsufficientCreditsError();

      await tx.insert(creditsLedgerEntries).values({
        userId: teacher.id,
        delta: -generationCost,
        reason: "generation",
        refId: lesson.id,
      });

      const [version] = await tx
        .insert(lessonVersions)
        .values({
          lessonId: lesson.id,
          versionNumber: 1,
          status: VersionStatus.Draft,
          schemaDefinitionId: schemaDefinition.id,
          content: {},
          sourceType,
        })
        .returning({ id: lessonVersions.id });

      return { lessonId: lesson.id, versionId: version.id };
    });
  } catch (err) {
    if (err instanceof InsufficientCreditsError) return { error: t("insufficientCredits", { cost: generationCost }) };
    throw err;
  }
  const { lessonId, versionId } = created;
  logger.info({ lessonId, versionId, sourceType }, "Lesson generation started");

  const locale = (await getLocale()) as Locale;
  const payload: GenerateLessonPayload = {
    lessonId,
    versionId,
    teacherId: teacher.id,
    locale,
    source,
    sourceType,
    systemPrompt: schemaDefinition.content,
    blueprint: template.blueprint,
    validationScript: template.validationScript,
    lessonNameInput,
  };

  try {
    await tasks.trigger<typeof generateLessonTask>("generate-lesson", payload);
  } catch (err) {
    logger.error({ lessonId, err }, "Failed to schedule lesson generation");
    await db.transaction(async (tx) => {
      await tx.update(lessons).set({ state: LessonState.GenerationFailed }).where(eq(lessons.id, lessonId));
      await tx
        .update(users)
        .set({ creditsBalance: sql`${users.creditsBalance} + ${generationCost}` })
        .where(eq(users.id, teacher.id));
      await tx.insert(creditsLedgerEntries).values({
        userId: teacher.id,
        delta: generationCost,
        reason: "admin_adjustment",
        refId: lessonId,
      });
    });
    revalidatePath("/dashboard");
    revalidatePath(`/dashboard/lessons/${lessonId}`);
    return { error: t("generationFailed") };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/lessons/${lessonId}`);
  return { success: true, lessonId };
}
