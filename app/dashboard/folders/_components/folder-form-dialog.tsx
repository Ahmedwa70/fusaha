"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { createFolderSchema } from "@/validation/folders";
import { createFolder, updateFolder } from "@/actions/folders";
import type { FolderItem } from "@/lib/dashboard/queries/folder";
import { DialogForm } from "@/components/shared/form/dialog-form";

type Props =
  | { mode: "create"; open: boolean; onOpenChange: (open: boolean) => void; folder?: undefined }
  | { mode: "edit"; open: boolean; onOpenChange: (open: boolean) => void; folder: FolderItem };

export function FolderFormDialog({ mode, open, onOpenChange, folder }: Props) {
  const t = useTranslations("dashboard.folders");
  const tValidation = useTranslations("validation.folders");
  const [isPending, startTransition] = useTransition();

  if (mode === "edit") {
    return (
      <DialogForm
        schema={createFolderSchema(tValidation)}
        defaultValues={{ name: folder.name }}
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
              const result = await updateFolder(folder.id, values);
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
              <FieldLabel htmlFor="folder-edit-name">{t("fieldName")}</FieldLabel>
              <Input id="folder-edit-name" {...methods.register("name")} />
              <FieldError errors={[methods.errors.name]} />
            </Field>
          </FieldGroup>
        )}
      </DialogForm>
    );
  }

  return (
    <DialogForm
      schema={createFolderSchema(tValidation)}
      defaultValues={{ name: "" }}
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
            const result = await createFolder(values);
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
            <FieldLabel htmlFor="folder-name">{t("fieldName")}</FieldLabel>
            <Input id="folder-name" {...methods.register("name")} />
            <FieldError errors={[methods.errors.name]} />
          </Field>
        </FieldGroup>
      )}
    </DialogForm>
  );
}
