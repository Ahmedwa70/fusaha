import { z } from "zod";

// Messages come from the "validation.profile" namespace so the schema reads
// the same on the client (useTranslations) and in server actions
// (getTranslations) — see validation/teachers.ts for the same convention.
export function updateNameSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("requiredName")),
  });
}

export function updatePasswordSchema(t: (key: string) => string) {
  return z
    .object({
      password: z.string().min(8, t("passwordTooShort")),
      confirmPassword: z.string().min(1, t("requiredConfirmPassword")),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("passwordMismatch"),
      path: ["confirmPassword"],
    });
}

export type UpdateNameValues = z.infer<ReturnType<typeof updateNameSchema>>;
export type UpdatePasswordValues = z.infer<ReturnType<typeof updatePasswordSchema>>;
