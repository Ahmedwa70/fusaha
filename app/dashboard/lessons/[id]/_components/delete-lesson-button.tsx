"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { ROUTES } from "@/constants/routes";
import { deleteLesson } from "@/actions/lessons";

export function DeleteLessonButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("dashboard.lessonDetail");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="gap-1.5 text-destructive hover:text-destructive"
        onClick={() => setOpen(true)}
      >
        <Trash2Icon data-icon="inline-start" />
        {t("delete")}
      </Button>

      <DeleteConfirmationDialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
        title={t("deleteDialogTitle")}
        description={t("deleteDialogDescription", { name })}
        cancelLabel={t("cancel")}
        confirmLabel={t("delete")}
        confirmingLabel={t("deleting")}
        isLoading={isPending}
        onConfirm={() => {
          startTransition(async () => {
            const result = await deleteLesson(id);
            if ("error" in result) {
              setError(result.error);
              return;
            }
            router.push(ROUTES.dashboard);
          });
        }}
      />
      {error && <p className="text-sm text-destructive">{error}</p>}
    </>
  );
}
