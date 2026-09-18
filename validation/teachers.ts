import { z } from "zod";

// Messages come from the "validation.teachers" namespace so the schema
// reads the same on the client (useTranslations) and in server actions
// (getTranslations) — see validation/auth.ts for the same convention.
export function updateTeacherSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("requiredName")),
    creditsBalance: z.coerce.number().int().min(0, t("negativeCredits")),
    active: z.boolean(),
  });
}

export type UpdateTeacherValues = z.infer<ReturnType<typeof updateTeacherSchema>>;
