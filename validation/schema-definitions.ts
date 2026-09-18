import { z } from "zod";
import { locales } from "@/i18n/config";

// Messages come from the "validation.schemaDefinitions" namespace so the
// schema reads the same on the client (useTranslations) and in server
// actions (getTranslations) — see validation/teachers.ts for the same
// convention.
export function createSchemaDefinitionSchema(t: (key: string) => string) {
  return z.object({
    // One display name per configured locale (see i18n/config.ts) — the
    // stable, non-translated levelKey is generated server-side, never
    // entered here.
    level: z.object(
      Object.fromEntries(locales.map((locale) => [locale, z.string().min(1, t("requiredLevel"))])) as Record<
        (typeof locales)[number],
        z.ZodString
      >
    ),
    version: z
      .string()
      .min(1, t("requiredVersion"))
      .regex(/^\d+(\.\d+)*$/, t("invalidVersion")),
    content: z.string().min(1, t("requiredContent")),
    templateId: z.string().min(1, t("requiredTemplate")),
    active: z.boolean(),
  });
}

export type CreateSchemaDefinitionValues = z.infer<ReturnType<typeof createSchemaDefinitionSchema>>;
