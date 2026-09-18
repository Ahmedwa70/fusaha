"use client";

import { useTransition } from "react";
import { Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { updateTeacherSchema } from "@/validation/teachers";
import { updateTeacher } from "@/actions/teachers";
import type { TeacherListItem } from "@/lib/admin/queries/teacher";
import { DialogForm } from "@/components/shared/form/dialog-form";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacher: TeacherListItem;
};

export function TeacherFormDialog({ open, onOpenChange, teacher }: Props) {
  const t = useTranslations("admin.teachers");
  const tValidation = useTranslations("validation.teachers");
  const [isPending, startTransition] = useTransition();

  return (
    <DialogForm
      schema={updateTeacherSchema(tValidation)}
      defaultValues={{
        name: teacher.name,
        creditsBalance: teacher.creditsBalance,
        active: teacher.active,
      }}
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
            const result = await updateTeacher(teacher.id, values);
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
            <FieldLabel htmlFor="teacher-edit-name">{t("fieldName")}</FieldLabel>
            <Input id="teacher-edit-name" {...methods.register("name")} />
            <FieldError errors={[methods.errors.name]} />
          </Field>

          <Field data-invalid={!!methods.errors.creditsBalance}>
            <FieldLabel htmlFor="teacher-credits">{t("fieldCredits")}</FieldLabel>
            <Input id="teacher-credits" type="number" min={0} {...methods.register("creditsBalance")} />
            <FieldError errors={[methods.errors.creditsBalance]} />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="teacher-active">{t("fieldActive")}</FieldLabel>
            <Controller
              control={methods.control}
              name="active"
              render={({ field }) => (
                <Switch id="teacher-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </Field>
        </FieldGroup>
      )}
    </DialogForm>
  );
}
