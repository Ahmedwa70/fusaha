"use client";

import { useTransition } from "react";
import { Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { roleSchema } from "@/validation/roles";
import { createRole, updateRole } from "@/actions/roles";
import type { RoleListItem } from "@/lib/admin/queries/role";
import { DialogForm } from "@/components/shared/form/dialog-form";
import { PermissionsField } from "./permissions-field";

type Props =
  | { mode: "create"; open: boolean; onOpenChange: (open: boolean) => void; role?: undefined; allPermissions: string[] }
  | { mode: "edit"; open: boolean; onOpenChange: (open: boolean) => void; role: RoleListItem; allPermissions: string[] };

export function RoleFormDialog({ mode, open, onOpenChange, role, allPermissions }: Props) {
  const t = useTranslations("admin.roles");
  const tValidation = useTranslations("validation.roles");
  const [isPending, startTransition] = useTransition();

  return (
    <DialogForm
      schema={roleSchema(tValidation)}
      defaultValues={{
        name: role?.name ?? "",
        title: role?.title ?? "",
        permissionKeys: role?.permissionKeys ?? [],
      }}
      isLoading={isPending}
      title={mode === "create" ? t("createDialogTitle") : t("editDialogTitle")}
      description={mode === "create" ? t("createDialogDescription") : t("editDialogDescription")}
      open={open}
      onOpenChange={onOpenChange}
      submitLabel={mode === "create" ? t("submitCreate") : t("submitUpdate")}
      cancelLabel={t("cancel")}
      className="sm:max-w-3xl"
      onSubmit={(values) => {
        return new Promise((resolve) => {
          startTransition(async () => {
            const result = mode === "create" ? await createRole(values) : await updateRole(role.id, values);
            if ("error" in result) {
              resolve({ error: result.error });
              return;
            }
            onOpenChange(false);
            resolve();
          });
        });
      }}
    >
      {(methods) => (
        <FieldGroup>
          <Field data-invalid={!!methods.errors.title}>
            <FieldLabel htmlFor="role-title">{t("fieldTitle")}</FieldLabel>
            <Input id="role-title" {...methods.register("title")} />
            <FieldError errors={[methods.errors.title]} />
          </Field>

          <Field data-invalid={!!methods.errors.name}>
            <FieldLabel htmlFor="role-name">{t("fieldName")}</FieldLabel>
            <Input id="role-name" dir="ltr" {...methods.register("name")} />
            <FieldDescription>{t("fieldNameDescription")}</FieldDescription>
            <FieldError errors={[methods.errors.name]} />
          </Field>

          <Field>
            <FieldLabel>{t("fieldPermissions")}</FieldLabel>
            <Controller
              control={methods.control}
              name="permissionKeys"
              render={({ field }) => (
                <PermissionsField allPermissions={allPermissions} value={field.value ?? []} onChange={field.onChange} />
              )}
            />
          </Field>
        </FieldGroup>
      )}
    </DialogForm>
  );
}
