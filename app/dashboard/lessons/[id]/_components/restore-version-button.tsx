"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { restoreLessonVersion } from "@/actions/lessons";

export function RestoreVersionButton({
  lessonId,
  versionId,
  disabled,
}: {
  lessonId: string;
  versionId: string;
  disabled?: boolean;
}) {
  const t = useTranslations("dashboard.lessonDetail");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        variant="ghost"
        disabled={disabled || isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await restoreLessonVersion(lessonId, versionId);
            if ("error" in result) setError(result.error);
          });
        }}
      >
        {t("restore")}
      </Button>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
