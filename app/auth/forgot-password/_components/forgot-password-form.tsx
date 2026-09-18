"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { requestPasswordReset } from "@/actions/auth";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/validation/auth";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const tValidation = useTranslations("validation.auth");
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema(tValidation)),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    await requestPasswordReset(data);
    setSubmitted(true);
  });

  if (submitted) {
    return (
      <div className="space-y-6 text-center lg:text-start">
        <p className="text-sm text-foreground">{t("successMessage")}</p>
        <Link
          href={ROUTES.login}
          className="text-sm font-medium text-foreground underline underline-offset-4"
        >
          {t("backToLogin")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.email}>
            <FieldLabel htmlFor="email">{t("emailLabel")}</FieldLabel>
            <Input
              id="email"
              type="email"
              aria-invalid={!!errors.email}
              {...register("email")}
            />
            {errors.email && <FieldError>{errors.email.message}</FieldError>}
          </Field>
          <Field>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Spinner data-icon="inline-start" />}
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </Field>
        </FieldGroup>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href={ROUTES.login} className="font-medium text-foreground underline underline-offset-4">
          {t("backToLogin")}
        </Link>
      </p>
    </div>
  );
}
