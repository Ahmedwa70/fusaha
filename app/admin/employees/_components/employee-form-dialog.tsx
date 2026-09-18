"use client";

import { useTransition } from "react";
import { Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldGroup, FieldLabel, FieldError, FieldDescription } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createEmployeeSchema, updateEmployeeSchema } from "@/validation/employees";
import { createEmployee, updateEmployee } from "@/actions/employees";
import type { EmployeeListItem, AssignableRole } from "@/lib/admin/queries/employee";
import { DialogForm } from "@/components/shared/form/dialog-form";

type Props =
  | { mode: "create"; open: boolean; onOpenChange: (open: boolean) => void; employee?: undefined; assignableRoles: AssignableRole[] }
  | { mode: "edit"; open: boolean; onOpenChange: (open: boolean) => void; employee: EmployeeListItem; assignableRoles: AssignableRole[] };

export function EmployeeFormDialog({ mode, open, onOpenChange, employee, assignableRoles }: Props) {
  const t = useTranslations("admin.employees");
  const tValidation = useTranslations("validation.employees");
  const [isPending, startTransition] = useTransition();

  const roleField = (
    field: { value: string; onChange: (value: string) => void },
    id: string
  ) => (
    <Select value={field.value} onValueChange={(value) => field.onChange(value as string)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder={t("fieldRolePlaceholder")}>
          {(value: string) => assignableRoles.find((r) => r.id === value)?.title}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {assignableRoles.map((role) => (
            <SelectItem key={role.id} value={role.id}>
              {role.title}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );

  if (mode === "create") {
    return (
      <DialogForm
        schema={createEmployeeSchema(tValidation)}
        defaultValues={{ name: "", email: "", password: "", roleId: "" }}
        isLoading={isPending}
        title={t("createDialogTitle")}
        description={t("createDialogDescription")}
        open={open}
        onOpenChange={onOpenChange}
        submitLabel={t("submitCreate")}
        cancelLabel={t("cancel")}
        onSubmit={(values) => {
          return new Promise((resolve) => {
            startTransition(async () => {
              const result = await createEmployee(values);
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
            <Field data-invalid={!!methods.errors.name}>
              <FieldLabel htmlFor="employee-name">{t("fieldName")}</FieldLabel>
              <Input id="employee-name" {...methods.register("name")} />
              <FieldError errors={[methods.errors.name]} />
            </Field>

            <Field data-invalid={!!methods.errors.email}>
              <FieldLabel htmlFor="employee-email">{t("fieldEmail")}</FieldLabel>
              <Input id="employee-email" type="email" dir="ltr" {...methods.register("email")} />
              <FieldError errors={[methods.errors.email]} />
            </Field>

            <Field data-invalid={!!methods.errors.password}>
              <FieldLabel htmlFor="employee-password">{t("fieldPassword")}</FieldLabel>
              <Input id="employee-password" type="password" dir="ltr" {...methods.register("password")} />
              <FieldError errors={[methods.errors.password]} />
            </Field>

            <Field data-invalid={!!methods.errors.roleId}>
              <FieldLabel htmlFor="employee-role">{t("fieldRole")}</FieldLabel>
              <Controller
                control={methods.control}
                name="roleId"
                render={({ field }) => roleField(field, "employee-role")}
              />
              <FieldError errors={[methods.errors.roleId]} />
            </Field>
          </FieldGroup>
        )}
      </DialogForm>
    );
  }

  return (
    <DialogForm
      schema={updateEmployeeSchema(tValidation)}
      defaultValues={{ name: employee.name, roleId: employee.roleId, active: employee.active }}
      isLoading={isPending}
      title={t("editDialogTitle")}
      description={t("editDialogDescription")}
      open={open}
      onOpenChange={onOpenChange}
      submitLabel={t("submitUpdate")}
      cancelLabel={t("cancel")}
      onSubmit={(values) => {
        return new Promise((resolve) => {
          startTransition(async () => {
            const result = await updateEmployee(employee.id, values);
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
          <Field data-invalid={!!methods.errors.name}>
            <FieldLabel htmlFor="employee-edit-name">{t("fieldName")}</FieldLabel>
            <Input id="employee-edit-name" {...methods.register("name")} />
            <FieldError errors={[methods.errors.name]} />
          </Field>

          <Field>
            <FieldLabel>{t("fieldEmail")}</FieldLabel>
            <Input value={employee.email} dir="ltr" disabled />
            <FieldDescription>{t("fieldEmailImmutable")}</FieldDescription>
          </Field>

          <Field data-invalid={!!methods.errors.roleId}>
            <FieldLabel htmlFor="employee-edit-role">{t("fieldRole")}</FieldLabel>
            <Controller
              control={methods.control}
              name="roleId"
              render={({ field }) => roleField(field, "employee-edit-role")}
            />
            <FieldError errors={[methods.errors.roleId]} />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="employee-active">{t("fieldActive")}</FieldLabel>
            <Controller
              control={methods.control}
              name="active"
              render={({ field }) => (
                <Switch id="employee-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </Field>
        </FieldGroup>
      )}
    </DialogForm>
  );
}
