import { z } from "zod";

// Messages come from the "validation.auth" namespace so the schema reads
// the same on the client (useTranslations) and in server actions
// (getTranslations) — see app/auth/login/page.tsx and actions/auth.ts.
export function loginSchema(t: (key: string) => string) {
  return z.object({
    email: z.email(t("invalidEmail")),
    password: z.string(),
  });
}

export type LoginFormValues = z.infer<ReturnType<typeof loginSchema>>;

export function signupSchema(t: (key: string) => string) {
  return z.object({
    name: z.string().min(1, t("requiredName")),
    email: z.email(t("invalidEmail")),
    password: z.string().min(8, t("passwordTooShort")),
  });
}

export type SignupFormValues = z.infer<ReturnType<typeof signupSchema>>;

export function forgotPasswordSchema(t: (key: string) => string) {
  return z.object({
    email: z.email(t("invalidEmail")),
  });
}

export type ForgotPasswordFormValues = z.infer<ReturnType<typeof forgotPasswordSchema>>;
