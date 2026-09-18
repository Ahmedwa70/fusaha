"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { dateFormatter } from "@/lib/dashboard/format";
import type { TeacherListItem } from "@/lib/admin/queries/teacher";
import { InfoField } from "@/components/shared/info-field";
import { StatusBadge } from "@/components/shared/status-badge";

export function TeacherViewDialog({
  teacher,
  onOpenChange,
  onEdit,
}: {
  teacher: TeacherListItem | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (teacher: TeacherListItem) => void;
}) {
  const t = useTranslations("admin.teachers");

  return (
    <Dialog open={!!teacher} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("viewDialogTitle")}</DialogTitle>
        </DialogHeader>

        {teacher && (
          <>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <InfoField label={t("fieldName")} value={teacher.name} />
              <InfoField label={t("fieldEmail")} value={teacher.email} />
              <InfoField label={t("fieldCredits")} value={teacher.creditsBalance} />
              <InfoField label={t("columnStatus")} value={<StatusBadge active={teacher.active} />} />
              <InfoField label={t("fieldJoinedAt")} value={dateFormatter.format(teacher.createdAt)} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onEdit(teacher)}>
                <PencilIcon data-icon="inline-start" />
                {t("actionEdit")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
