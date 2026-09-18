"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { resetPassword } from "@/actions/auth";
import { updatePasswordSchema, type UpdatePasswordValues } from "@/validation/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";

export function ResetPasswordForm() {
  const t = useTranslations("auth.resetPassword");
  const tValidation = useTranslations("validation.profile");
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<UpdatePasswordValues>({
    resolver: zodResolver(updatePasswordSchema(tValidation)),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    const result = await resetPassword(data);
    if (result?.error) setError("root", { message: result.error });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={!!errors.password}>
          <FieldLabel htmlFor="password">{t("passwordLabel")}</FieldLabel>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              aria-invalid={!!errors.password}
              className="pe-10"
              {...register("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={t(showPassword ? "hidePassword" : "showPassword")}
              className="absolute inset-y-0 inset-e-0 flex w-10 items-center justify-center text-muted-foreground hover:text-foreground"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && <FieldError>{errors.password.message}</FieldError>}
        </Field>

        <Field data-invalid={!!errors.confirmPassword}>
          <FieldLabel htmlFor="confirmPassword">{t("confirmPasswordLabel")}</FieldLabel>
          <Input
            id="confirmPassword"
            type={showPassword ? "text" : "password"}
            aria-invalid={!!errors.confirmPassword}
            {...register("confirmPassword")}
          />
          {errors.confirmPassword && <FieldError>{errors.confirmPassword.message}</FieldError>}
        </Field>

        <Field>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Spinner data-icon="inline-start" />}
            {isSubmitting ? t("submitting") : t("submit")}
          </Button>
          {errors.root && <FieldError>{errors.root.message}</FieldError>}
        </Field>
      </FieldGroup>
    </form>
  );
}
