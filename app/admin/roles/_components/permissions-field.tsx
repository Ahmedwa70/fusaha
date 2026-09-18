"use client";

import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PERMISSION_TRANSLATION_KEYS } from "@/constants/permissions";
import { groupPermissionKeys } from "@/lib/admin/permissions";

export function PermissionsField({
  allPermissions,
  value,
  onChange,
}: {
  allPermissions: string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useTranslations("admin.permissions");
  const tResources = useTranslations("admin.permissionResources");
  const groups = groupPermissionKeys(allPermissions);

  const toggleKey = (key: string, checked: boolean) => {
    onChange(checked ? [...value, key] : value.filter((k) => k !== key));
  };

  const toggleGroup = (keys: string[], checked: boolean) => {
    const rest = value.filter((k) => !keys.includes(k));
    onChange(checked ? [...rest, ...keys] : rest);
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Object.entries(groups).map(([resource, keys]) => {
        const allChecked = keys.every((key) => value.includes(key));
        const someChecked = !allChecked && keys.some((key) => value.includes(key));

        return (
          <Card key={resource} size="sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span>{tResources(resource)}</span>
                <Label className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={someChecked}
                    onCheckedChange={(checked) => toggleGroup(keys, checked === true)}
                  />
                  {t("selectAll")}
                </Label>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {keys.map((key) => (
                <Label key={key} className="flex items-center gap-2 text-sm font-normal">
                  <Checkbox
                    checked={value.includes(key)}
                    onCheckedChange={(checked) => toggleKey(key, checked === true)}
                  />
                  {t(PERMISSION_TRANSLATION_KEYS[key] ?? key)}
                </Label>
              ))}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
