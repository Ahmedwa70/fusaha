import { z } from "zod";

// Messages come from the "validation.templates" namespace so the schema
// reads the same on the client (useTranslations) and in server actions
// (getTranslations) — see validation/schema-definitions.ts for the same
// convention.
export function createTemplateSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("requiredName")),
    htmlPlayer: z.string().min(1, t("requiredHtmlPlayer")),
    blueprint: z.string().min(1, t("requiredBlueprint")),
    validationScript: z.string().min(1, t("requiredValidationScript")),
    previewImage: z.string().optional(),
    active: z.boolean(),
  });
}

export type CreateTemplateValues = z.infer<ReturnType<typeof createTemplateSchema>>;

export function updateTemplateSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("requiredName")),
    htmlPlayer: z.string().min(1, t("requiredHtmlPlayer")),
    blueprint: z.string().min(1, t("requiredBlueprint")),
    validationScript: z.string().min(1, t("requiredValidationScript")),
    previewImage: z.string().optional(),
    active: z.boolean(),
  });
}

export type UpdateTemplateValues = z.infer<ReturnType<typeof updateTemplateSchema>>;
