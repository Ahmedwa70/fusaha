"use client";

import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Loader2Icon, PencilIcon, ArrowLeftIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { updateLessonVersionContent } from "@/actions/lessons";
import { JsonForm } from "./json-editor/json-form";

const AUTOSAVE_DEBOUNCE_MS = 650;

type SaveStatus =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  | { kind: "error"; message: string };

export function LessonContentEditor({
  lessonId,
  versionId,
  content,
}: {
  lessonId: string;
  versionId: string;
  content: Record<string, unknown>;
}) {
  const t = useTranslations("dashboard.lessonDetail.editor");
  const methods = useForm<Record<string, unknown>>({ defaultValues: content });
  const values = useWatch({ control: methods.control });

  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [html, setHtml] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstRunRef = useRef(true);
  // Guards against an in-flight save's result landing after a newer edit
  // has already kicked off another save.
  const saveTokenRef = useRef(0);

  useEffect(() => {
    const save = (values: Record<string, unknown>) => {
      const token = ++saveTokenRef.current;
      setStatus({ kind: "saving" });
      void updateLessonVersionContent(lessonId, versionId, values).then(
        (result) => {
          if (token !== saveTokenRef.current) return;
          if ("error" in result) {
            setStatus({ kind: "error", message: result.error });
            return;
          }
          setStatus({ kind: "saved" });
          setHtml(result.html);
        },
      );
    };

    if (isFirstRunRef.current) {
      isFirstRunRef.current = false;
      // Populate the preview immediately from the version's current content,
      // rather than leaving it blank until the teacher's first edit.
      save(values);
      return;
    }

    timerRef.current = setTimeout(() => save(values), AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [values, lessonId, versionId]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {status.kind === "saving" && (
            <>
              <Loader2Icon className="size-3.5 animate-spin" />
              {t("saving")}
            </>
          )}
          {status.kind === "saved" && <span>{t("saved")}</span>}
          {status.kind === "error" && (
            <span className="text-destructive">
              {t("saveFailed")}: {status.message}
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsEditing((prev) => !prev)}
        >
          {isEditing ? (
            <>
              <ArrowLeftIcon className="size-4 rtl:rotate-180" />
              {t("backToLesson")}
            </>
          ) : (
            <>
              <PencilIcon className="size-4" />
              {t("editButton")}
            </>
          )}
        </Button>
      </div>

      {isEditing ? (
        <FormProvider {...methods}>
          <form onSubmit={(event) => event.preventDefault()}>
            <JsonForm content={content} />
          </form>
        </FormProvider>
      ) : (
        <div className="h-[600px] min-w-0 overflow-hidden rounded-lg border">
          {html !== null ? (
            <iframe
              sandbox="allow-scripts"
              className="h-full w-full border-0"
              srcDoc={html}
              title={t("previewTitle")}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {t("previewPending")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
