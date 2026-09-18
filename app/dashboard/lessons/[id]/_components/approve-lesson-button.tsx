"use client";

import { useState, useTransition } from "react";
import { CheckCircle2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { approveLesson } from "@/actions/lessons";

export function ApproveLessonButton({ lessonId }: { lessonId: string }) {
  const t = useTranslations("dashboard.lessonDetail");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        className="gap-1.5"
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await approveLesson(lessonId);
            if ("error" in result) setError(result.error);
          });
        }}
      >
        <CheckCircle2Icon data-icon="inline-start" />
        {t("approve")}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
