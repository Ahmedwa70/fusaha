"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { dateFormatter } from "@/lib/dashboard/format";
import type { EmployeeListItem } from "@/lib/admin/queries/employee";
import { InfoField } from "@/components/shared/info-field";
import { StatusBadge } from "@/components/shared/status-badge";

export function EmployeeViewDialog({
  employee,
  onOpenChange,
  onEdit,
}: {
  employee: EmployeeListItem | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (employee: EmployeeListItem) => void;
}) {
  const t = useTranslations("admin.employees");

  return (
    <Dialog open={!!employee} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("viewDialogTitle")}</DialogTitle>
        </DialogHeader>

        {employee && (
          <>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <InfoField label={t("fieldName")} value={employee.name} />
              <InfoField label={t("fieldEmail")} value={employee.email} />
              <InfoField label={t("fieldRole")} value={employee.roleTitle} />
              <InfoField label={t("columnStatus")} value={<StatusBadge active={employee.active} />} />
              <InfoField label={t("fieldJoinedAt")} value={dateFormatter.format(employee.createdAt)} />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onEdit(employee)}>
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
