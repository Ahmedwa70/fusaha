"use client";

import { useState, useTransition } from "react";
import { RotateCcwIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { restoreLesson } from "@/actions/lessons";

export function RestoreLessonButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("admin.lessons");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    startTransition(async () => {
      const result = await restoreLesson(id);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setError(null);
    });
  };

  return (
    <>
      <Button type="button" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
        <RotateCcwIcon data-icon="inline-start" />
        {t("restore")}
      </Button>

      <DeleteConfirmationDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title={t("restoreDialogTitle")}
        description={t("restoreDialogDescription", { name })}
        cancelLabel={t("cancel")}
        confirmLabel={t("restore")}
        confirmingLabel={t("restoring")}
        isLoading={isPending}
        onConfirm={handleConfirm}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
}
