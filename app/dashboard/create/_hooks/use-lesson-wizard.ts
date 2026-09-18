"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import * as Sentry from "@sentry/nextjs";
import { ROUTES } from "@/constants/routes";
import { MAX_TEXT_WORDS, MAX_IMAGES } from "@/constants/lesson-source-limits";
import { createLesson } from "@/actions/generation";
import type { SourceType, TextMode, UploadedFile, UploadedImage, Translator } from "@/app/dashboard/create/_components/wizard-types";

function formatFileSize(bytes: number, t: Translator) {
  const mb = bytes / (1024 * 1024);
  return mb >= 1
    ? t("fileSizeMb", { size: mb.toFixed(1) })
    : t("fileSizeKb", { size: Math.max(1, Math.round(bytes / 1024)) });
}

export function useLessonWizard() {
  const t = useTranslations("dashboard.wizard");
  const router = useRouter();
  const [step, setStep] = useState(1);

  const [sourceType, setSourceType] = useState<SourceType | null>(null);
  const [textMode, setTextMode] = useState<TextMode>("write");
  const [text, setText] = useState("");
  const [file, setFile] = useState<UploadedFile | null>(null);
  const [images, setImages] = useState<UploadedImage[]>([]);

  const [schemaDefinitionId, setSchemaDefinitionId] = useState<string | null>(null);
  const [lessonName, setLessonName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
  const textTooLong = wordCount > MAX_TEXT_WORDS;

  const step1Valid =
    sourceType === "images"
      ? images.length > 0
      : sourceType === "text"
        ? textMode === "write"
          ? text.trim().length > 0 && !textTooLong
          : file !== null
        : false;
  const step2Valid = schemaDefinitionId !== null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile({ name: picked.name, sizeLabel: formatFileSize(picked.size, t), file: picked });
    e.target.value = "";
  }

  function handleImagesChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const room = MAX_IMAGES - images.length;
    const accepted = picked.slice(0, room);
    setImages((prev) => [
      ...prev,
      ...accepted.map((f) => ({ id: crypto.randomUUID(), name: f.name, url: URL.createObjectURL(f), file: f })),
    ]);
    e.target.value = "";
  }

  function removeImage(id: string) {
    setImages((prev) => {
      const target = prev.find((img) => img.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((img) => img.id !== id);
    });
  }

  async function handleGenerate() {
    if (!sourceType || schemaDefinitionId === null) return;
    setError(null);
    setSubmitting(true);

    const data = new FormData();
    data.set("schemaDefinitionId", schemaDefinitionId);
    data.set("lessonName", lessonName);

    if (sourceType === "images") {
      images.forEach((img) => data.append("images", img.file));
      data.set("sourceKind", "images");
    } else if (textMode === "write") {
      data.set("sourceKind", "text-write");
      data.set("text", text);
    } else {
      data.set("sourceKind", "text-upload");
      if (file) data.set("file", file.file);
    }

    let result;
    try {
      result = await createLesson(data);
    } catch (err) {
      Sentry.captureException(err);
      setSubmitting(false);
      setError(t("errors.unexpectedError"));
      return;
    }
    setSubmitting(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    setSubmitted(true);
    router.push(`${ROUTES.dashboard}/lessons/${result.lessonId}`);
  }

  return {
    t,
    step,
    setStep,
    sourceType,
    setSourceType,
    textMode,
    setTextMode,
    text,
    setText,
    file,
    setFile,
    images,
    schemaDefinitionId,
    setSchemaDefinitionId,
    lessonName,
    setLessonName,
    submitting,
    submitted,
    error,
    fileInputRef,
    imageInputRef,
    wordCount,
    textTooLong,
    step1Valid,
    step2Valid,
    handleFileChange,
    handleImagesChange,
    removeImage,
    handleGenerate,
  };
}
