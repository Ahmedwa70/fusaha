"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { RoleListItem } from "@/lib/admin/queries/role";
import { InfoField } from "@/components/shared/info-field";
import { PERMISSION_TRANSLATION_KEYS } from "@/constants/permissions";

export function RoleViewDialog({
  role,
  onOpenChange,
  onEdit,
}: {
  role: RoleListItem | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (role: RoleListItem) => void;
}) {
  const t = useTranslations("admin.roles");
  const tPermissions = useTranslations("admin.permissions");

  return (
    <Dialog open={!!role} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("viewDialogTitle")}</DialogTitle>
        </DialogHeader>

        {role && (
          <>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <InfoField label={t("fieldTitle")} value={role.title} />
              <InfoField label={t("fieldName")} value={role.name} />
            </div>

            <InfoField
              label={t("fieldPermissions")}
              value={
                role.permissionKeys.length === 0 ? (
                  t("noPermissions")
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {role.permissionKeys.map((key) => (
                      <Badge key={key} variant="outline">
                        {tPermissions(PERMISSION_TRANSLATION_KEYS[key] ?? key)}
                      </Badge>
                    ))}
                  </div>
                )
              }
            />

            <DialogFooter>
              <Button variant="outline" onClick={() => onEdit(role)}>
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
