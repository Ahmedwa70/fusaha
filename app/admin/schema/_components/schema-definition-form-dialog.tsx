"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { UploadIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogForm } from "@/components/shared/form/dialog-form";
import { createSchemaDefinitionSchema } from "@/validation/schema-definitions";
import { createSchemaDefinition } from "@/actions/schema-definitions";
import { locales, localeLabels, type Locale } from "@/i18n/config";

export function SchemaDefinitionFormDialog({
  open,
  onOpenChange,
  initialLevel,
  initialLevelKey,
  initialContent,
  templates,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLevel: Partial<Record<Locale, string>>;
  // Present only when adding a new version to an already-existing level —
  // its identity is carried through untouched. Undefined for a brand-new
  // level, whose key is generated server-side.
  initialLevelKey?: string;
  initialContent: string;
  templates: { id: string; name: string }[];
}) {
  const t = useTranslations("admin.schema");
  const tValidation = useTranslations("validation.schemaDefinitions");
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  return (
    <DialogForm
      schema={createSchemaDefinitionSchema(tValidation)}
      defaultValues={{
        level: Object.fromEntries(locales.map((locale) => [locale, initialLevel[locale] ?? ""])) as Record<
          Locale,
          string
        >,
        version: "",
        content: initialContent,
        templateId: "",
        active: true,
      }}
      isLoading={isPending}
      title={t("newVersionTitle")}
      description={t("newVersionDescription")}
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setFileError(null);
          setFileName(null);
        }
        onOpenChange(next);
      }}
      submitLabel={t("submitNewVersion")}
      cancelLabel={t("cancel")}
      className="sm:max-w-3xl"
      onSubmit={(values) => {
        return new Promise((resolve) => {
          startTransition(async () => {
            const result = await createSchemaDefinition(values, initialLevelKey);
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
          {locales.map((locale) => (
            <Field key={locale} data-invalid={!!methods.errors.level?.[locale]}>
              <FieldLabel htmlFor={`schema-level-${locale}`}>
                {t("fieldLevel")} — {localeLabels[locale]}
              </FieldLabel>
              <Input
                id={`schema-level-${locale}`}
                placeholder={t("fieldLevelPlaceholder")}
                {...methods.register(`level.${locale}`)}
              />
              <FieldError errors={[methods.errors.level?.[locale]]} />
            </Field>
          ))}

          <Field data-invalid={!!methods.errors.version}>
            <FieldLabel htmlFor="schema-version">{t("fieldVersion")}</FieldLabel>
            <Input id="schema-version" placeholder="2.1" {...methods.register("version")} />
            <FieldError errors={[methods.errors.version]} />
          </Field>

          <Field data-invalid={!!methods.errors.templateId}>
            <FieldLabel htmlFor="schema-template">{t("fieldTemplate")}</FieldLabel>
            <Select
              value={methods.watch("templateId")}
              onValueChange={(value) => methods.setValue("templateId", value as string)}
            >
              <SelectTrigger id="schema-template" className="w-full">
                <SelectValue placeholder={t("fieldTemplatePlaceholder")}>
                  {(value: string) => templates.find((template) => template.id === value)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <FieldError errors={[methods.errors.templateId]} />
          </Field>

          <Field orientation="horizontal">
            <Checkbox
              id="schema-active"
              checked={methods.watch("active")}
              onCheckedChange={(checked) => methods.setValue("active", checked === true)}
            />
            <FieldLabel htmlFor="schema-active">{t("fieldActive")}</FieldLabel>
          </Field>

          <Field data-invalid={!!methods.errors.content}>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="schema-content-upload">{t("fieldContent")}</FieldLabel>
              <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                <UploadIcon data-icon="inline-start" />
                {t("uploadMarkdownFile")}
              </Button>
              <input
                ref={fileInputRef}
                id="schema-content-upload"
                type="file"
                accept=".md"
                className="hidden"
                onChange={(e) => {
                  const selectedFile = e.target.files?.[0];
                  e.target.value = "";
                  if (!selectedFile) return;

                  if (!selectedFile.name.toLowerCase().endsWith(".md")) {
                    setFileError(t("invalidMarkdownFile"));
                    return;
                  }

                  setFileError(null);
                  const reader = new FileReader();
                  reader.onload = () => {
                    methods.setValue("content", String(reader.result ?? ""), {
                      shouldValidate: true,
                      shouldDirty: true,
                    });
                    setFileName(selectedFile.name);
                  };
                  reader.readAsText(selectedFile);
                }}
              />
            </div>
            {fileName && <p className="text-sm text-muted-foreground">{fileName}</p>}
            <div className="prose dark:prose-invert max-w-none max-h-96 overflow-auto rounded-md border bg-muted p-4">
              <Markdown remarkPlugins={[remarkGfm]}>{methods.watch("content")}</Markdown>
            </div>
            {fileError && <FieldError>{fileError}</FieldError>}
            <FieldError errors={[methods.errors.content]} />
          </Field>
        </FieldGroup>
      )}
    </DialogForm>
  );
}
