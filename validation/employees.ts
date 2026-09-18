import { z } from "zod";

// Messages come from the "validation.employees" namespace so the schema
// reads the same on the client (useTranslations) and in server actions
// (getTranslations) — see validation/teachers.ts for the same convention.
export function createEmployeeSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("requiredName")),
    email: z.email(t("invalidEmail")),
    password: z.string().min(8, t("passwordTooShort")),
    roleId: z.string().min(1, t("requiredRole")),
  });
}

export type CreateEmployeeValues = z.infer<ReturnType<typeof createEmployeeSchema>>;

export function updateEmployeeSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("requiredName")),
    roleId: z.string().min(1, t("requiredRole")),
    active: z.boolean(),
  });
}

export type UpdateEmployeeValues = z.infer<ReturnType<typeof updateEmployeeSchema>>;
