"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { BaseForm } from "@/components/shared/form/base-form";
import { updateNameSchema, updatePasswordSchema } from "@/validation/profile";
import { updateTeacherProfileName, updateTeacherProfilePassword } from "@/actions/profile";

type Translator = ReturnType<typeof useTranslations>;

export function ProfileForm({ name, email }: { name: string; email: string }) {
  const t = useTranslations("dashboard.profile");
  const tValidation = useTranslations("validation.profile");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("nameCardTitle")}</CardTitle>
          <CardDescription>{t("nameCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <NameForm t={t} tValidation={tValidation} name={name} email={email} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("passwordCardTitle")}</CardTitle>
          <CardDescription>{t("passwordCardDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PasswordForm t={t} tValidation={tValidation} />
        </CardContent>
      </Card>
    </div>
  );
}

function NameForm({
  t,
  tValidation,
  name,
  email,
}: {
  t: Translator;
  tValidation: Translator;
  name: string;
  email: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  return (
    <BaseForm
      schema={updateNameSchema(tValidation)}
      defaultValues={{ name }}
      isLoading={isPending}
      onSubmit={(values) => {
        setSuccess(false);
        return new Promise((resolve) => {
          startTransition(async () => {
            const result = await updateTeacherProfileName(values.name);
            if ("error" in result) {
              resolve({ error: result.error });
              return;
            }
            setSuccess(true);
            resolve();
          });
        });
      }}
    >
      {(methods) => (
        <FieldGroup>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="profile-email">{t("fieldEmail")}</FieldLabel>
              <Input id="profile-email" value={email} disabled readOnly />
            </Field>

            <Field data-invalid={!!methods.errors.name}>
              <FieldLabel htmlFor="profile-name">{t("fieldName")}</FieldLabel>
              <Input id="profile-name" {...methods.register("name")} />
              <FieldError errors={[methods.errors.name]} />
            </Field>
          </div>

          <FieldError>{methods.rootError}</FieldError>
          {success && <p className="text-sm text-primary">{t("nameUpdateSuccess")}</p>}

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner data-icon="inline-start" />}
              {t("submitName")}
            </Button>
          </div>
        </FieldGroup>
      )}
    </BaseForm>
  );
}

function PasswordForm({
  t,
  tValidation,
}: {
  t: Translator;
  tValidation: Translator;
}) {
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  return (
    <BaseForm
      schema={updatePasswordSchema(tValidation)}
      defaultValues={{ password: "", confirmPassword: "" }}
      isLoading={isPending}
      onSubmit={(values) => {
        setSuccess(false);
        return new Promise((resolve) => {
          startTransition(async () => {
            const result = await updateTeacherProfilePassword(values.password, values.confirmPassword);
            if ("error" in result) {
              resolve({ error: result.error });
              return;
            }
            setSuccess(true);
            resolve();
          });
        });
      }}
    >
      {(methods) => (
        <FieldGroup>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Field data-invalid={!!methods.errors.password}>
              <FieldLabel htmlFor="profile-password">{t("fieldPassword")}</FieldLabel>
              <Input id="profile-password" type="password" {...methods.register("password")} />
              <FieldError errors={[methods.errors.password]} />
            </Field>

            <Field data-invalid={!!methods.errors.confirmPassword}>
              <FieldLabel htmlFor="profile-confirm-password">{t("fieldConfirmPassword")}</FieldLabel>
              <Input id="profile-confirm-password" type="password" {...methods.register("confirmPassword")} />
              <FieldError errors={[methods.errors.confirmPassword]} />
            </Field>
          </div>

          <FieldError>{methods.rootError}</FieldError>
          {success && <p className="text-sm text-primary">{t("passwordUpdateSuccess")}</p>}

          <div>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner data-icon="inline-start" />}
              {t("submitPassword")}
            </Button>
          </div>
        </FieldGroup>
      )}
    </BaseForm>
  );
}
