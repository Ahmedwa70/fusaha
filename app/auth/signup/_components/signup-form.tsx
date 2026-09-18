"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { signUp, signInWithGoogle } from "@/actions/auth";
import { signupSchema, type SignupFormValues } from "@/validation/auth";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.63h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.81Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.74l4-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z"
      />
    </svg>
  );
}

export function SignupForm() {
  const t = useTranslations("auth.signup");
  const tValidation = useTranslations("validation.auth");
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema(tValidation)),
    defaultValues: { name: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    const result = await signUp(data);
    if (result?.error) setError("root", { message: result.error });
  });

  return (
    <div className="space-y-6">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={isGoogleLoading}
        onClick={() => {
          setIsGoogleLoading(true);
          signInWithGoogle();
        }}
      >
        {isGoogleLoading ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <GoogleIcon className="size-4" />
        )}
        {t("continueWithGoogle")}
      </Button>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("orContinueWith")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">{t("nameLabel")}</FieldLabel>
            <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </Field>
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
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <FieldError>{errors.password.message}</FieldError>
            )}
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

      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link href={ROUTES.login} className="font-medium text-foreground underline underline-offset-4">
          {t("loginLink")}
        </Link>
      </p>
    </div>
  );
}
