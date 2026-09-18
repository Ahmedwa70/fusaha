import { z } from "zod";

// Messages come from the "validation.roles" namespace so the schema reads
// the same on the client (useTranslations) and in server actions
// (getTranslations) — see validation/teachers.ts for the same convention.
export function roleSchema(t: (key: string) => string) {
  return z.object({
    name: z
      .string()
      .min(1, t("requiredName"))
      .regex(/^[a-z0-9-]+$/, t("invalidName")),
    title: z.string().min(1, t("requiredTitle")),
    permissionKeys: z.array(z.string()),
  });
}

export type RoleValues = z.infer<ReturnType<typeof roleSchema>>;
