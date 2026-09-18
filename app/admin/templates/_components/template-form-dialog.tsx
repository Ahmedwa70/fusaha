"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Controller } from "react-hook-form";
import { UploadIcon, XIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { createTemplateSchema, updateTemplateSchema } from "@/validation/templates";
import { createTemplate, updateTemplate, bundleTemplateZipAction } from "@/actions/templates";
import type { BundleReport } from "@/lib/templates/bundle-zip";
import { DialogForm } from "@/components/shared/form/dialog-form";
import type { templates } from "@/database/schema";

type TemplateRow = typeof templates.$inferSelect;

type Props =
  | { mode: "create"; open: boolean; onOpenChange: (open: boolean) => void; template?: undefined }
  | { mode: "edit"; open: boolean; onOpenChange: (open: boolean) => void; template: TemplateRow };

export function TemplateFormDialog({ mode, open, onOpenChange, template }: Props) {
  const t = useTranslations("admin.templates");
  const tValidation = useTranslations("validation.templates");
  const [isPending, startTransition] = useTransition();
  const [isBundling, startBundling] = useTransition();
  const [bundleReport, setBundleReport] = useState<BundleReport | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);
  const [zipFileName, setZipFileName] = useState<string | null>(null);
  const zipInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const schema = mode === "create" ? createTemplateSchema(tValidation) : updateTemplateSchema(tValidation);
  const defaultValues = {
    name: template?.name ?? "",
    htmlPlayer: template?.htmlPlayer ?? "",
    blueprint: template?.blueprint ?? "",
    validationScript: template?.validationScript ?? "",
    previewImage: template?.previewImage ?? "",
    active: template?.active ?? true,
  };

  return (
    <DialogForm
      schema={schema}
      defaultValues={defaultValues}
      isLoading={isPending}
      title={mode === "create" ? t("createDialogTitle") : t("editDialogTitle")}
      description={mode === "create" ? t("createDialogDescription") : t("editDialogDescription")}
      open={open}
      onOpenChange={onOpenChange}
      submitLabel={mode === "create" ? t("submitCreate") : t("submitUpdate")}
      cancelLabel={t("cancel")}
      onSubmit={(values) => {
        return new Promise((resolve) => {
          startTransition(async () => {
            const result = mode === "create" ? await createTemplate(values) : await updateTemplate(template.id, values);
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
      {(methods) => {
        const previewImage = methods.watch("previewImage");

        const handleZipUpload = (file: File) => {
          setBundleReport(null);
          setBundleError(null);
          setZipFileName(file.name);
          const formData = new FormData();
          formData.set("zip", file);
          startBundling(async () => {
            const result = await bundleTemplateZipAction(formData);
            if ("error" in result) {
              setBundleError(tValidation(`zipErrors.${result.error}`));
              return;
            }
            methods.setValue("htmlPlayer", result.html, { shouldDirty: true, shouldValidate: true });
            methods.setValue("blueprint", result.blueprint, { shouldDirty: true, shouldValidate: true });
            methods.setValue("validationScript", result.validationScript, {
              shouldDirty: true,
              shouldValidate: true,
            });
            setBundleReport(result.report);
          });
        };

        return (
          <FieldGroup>
            <Field data-invalid={!!methods.errors.name}>
              <FieldLabel htmlFor="template-name">{t("fieldName")}</FieldLabel>
              <Input id="template-name" {...methods.register("name")} />
              <FieldError errors={[methods.errors.name]} />
            </Field>

            <Field data-invalid={!!methods.errors.htmlPlayer}>
              <FieldLabel htmlFor="template-zip-upload">{t("zipUploadLabel")}</FieldLabel>
              <p className="text-muted-foreground text-sm">
                {mode === "create" ? t("zipUploadHint") : t("zipUploadEditHint")}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isBundling}
                  onClick={() => zipInputRef.current?.click()}
                >
                  <UploadIcon data-icon="inline-start" />
                  {t("uploadZipFile")}
                </Button>
                <span className="text-muted-foreground truncate text-sm">
                  {zipFileName ?? t("noFileSelected")}
                </span>
              </div>
              <input
                ref={zipInputRef}
                id="template-zip-upload"
                type="file"
                accept=".zip"
                disabled={isBundling}
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) handleZipUpload(file);
                }}
              />
              {isBundling && (
                <p className="text-muted-foreground flex items-center gap-2 text-sm">
                  <Spinner /> {t("zipBundling")}
                </p>
              )}
              {bundleError && <p className="text-destructive text-sm">{bundleError}</p>}
              {bundleReport && (
                <div className="text-sm">
                  <p>
                    {t("zipBundleSuccessBody", {
                      styles: bundleReport.inlinedStyles.length,
                      scripts: bundleReport.inlinedScripts.length,
                      appended: bundleReport.appendedScripts.length,
                    })}
                  </p>
                  {bundleReport.droppedDataFiles.length > 0 && (
                    <p className="text-muted-foreground">
                      {t("zipDroppedDataLabel", { count: bundleReport.droppedDataFiles.length })}
                    </p>
                  )}
                  {bundleReport.ignoredFiles.length > 0 && (
                    <details className="text-muted-foreground">
                      <summary>{t("zipIgnoredFilesLabel", { count: bundleReport.ignoredFiles.length })}</summary>
                      <ul className="list-inside list-disc" dir="ltr">
                        {bundleReport.ignoredFiles.map((path) => (
                          <li key={path}>{path}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
              <FieldError errors={[methods.errors.htmlPlayer, methods.errors.blueprint, methods.errors.validationScript]} />
            </Field>

            <Field data-invalid={!!methods.errors.previewImage}>
              <FieldLabel htmlFor="template-preview-image">{t("fieldPreviewImage")}</FieldLabel>
              <div className="flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => imageInputRef.current?.click()}>
                  <UploadIcon data-icon="inline-start" />
                  {previewImage ? t("changeImage") : t("uploadImageFile")}
                </Button>
                {previewImage && (
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("removeImage")}
                    onClick={() => {
                      methods.setValue("previewImage", "", { shouldDirty: true });
                      if (imageInputRef.current) imageInputRef.current.value = "";
                    }}
                  >
                    <XIcon />
                  </Button>
                )}
              </div>
              <input
                ref={imageInputRef}
                id="template-preview-image"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    methods.setValue("previewImage", reader.result as string, { shouldDirty: true });
                  };
                  reader.readAsDataURL(file);
                }}
              />
              {previewImage && (
                // eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image doesn't support it
                <img src={previewImage} alt="" className="mt-2 max-h-40 rounded-md border" />
              )}
              <FieldError errors={[methods.errors.previewImage]} />
            </Field>

            <Field orientation="horizontal">
              <FieldLabel htmlFor="template-active">{t("fieldActive")}</FieldLabel>
              <Controller
                control={methods.control}
                name="active"
                render={({ field }) => (
                  <Switch id="template-active" checked={field.value} onCheckedChange={field.onChange} />
                )}
              />
            </Field>
          </FieldGroup>
        );
      }}
    </DialogForm>
  );
}
