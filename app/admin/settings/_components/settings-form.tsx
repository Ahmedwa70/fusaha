"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { BaseForm } from "@/components/shared/form/base-form";
import { dateFormatter } from "@/lib/dashboard/format";
import { updateDeepSeekApiKeySchema } from "@/validation/settings";
import { updateDeepSeekApiKey } from "@/actions/settings";

type DeepSeekStatus = {
  configured: boolean;
  masked: string | null;
  updatedAt: Date | null;
};

export function SettingsForm({ deepSeekStatus }: { deepSeekStatus: DeepSeekStatus }) {
  const t = useTranslations("admin.settings");
  const tValidation = useTranslations("validation.settings");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle>{t("deepSeekCardTitle")}</CardTitle>
            <CardDescription>{t("deepSeekCardDescription")}</CardDescription>
          </div>
          <Badge variant={deepSeekStatus.configured ? "default" : "destructive"}>
            {deepSeekStatus.configured ? t("statusConfigured") : t("statusNotConfigured")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {deepSeekStatus.configured && (
          <div className="mb-6 flex flex-col gap-1 rounded-md border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">{t("currentKeyLabel")}</span>
            <span className="font-mono">{deepSeekStatus.masked}</span>
            {deepSeekStatus.updatedAt && (
              <span className="text-xs text-muted-foreground">
                {t("lastUpdatedAt", { date: dateFormatter.format(deepSeekStatus.updatedAt) })}
              </span>
            )}
          </div>
        )}

        <BaseForm
          schema={updateDeepSeekApiKeySchema(tValidation)}
          defaultValues={{ apiKey: "" }}
          isLoading={isPending}
          onSubmit={(values) => {
            setSuccess(false);
            return new Promise((resolve) => {
              startTransition(async () => {
                const result = await updateDeepSeekApiKey(values);
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
              <Field data-invalid={!!methods.errors.apiKey}>
                <FieldLabel htmlFor="deepseek-api-key">{t("fieldApiKey")}</FieldLabel>
                <Input
                  id="deepseek-api-key"
                  type="password"
                  autoComplete="off"
                  placeholder={t("fieldApiKeyPlaceholder")}
                  {...methods.register("apiKey")}
                />
                <FieldError errors={[methods.errors.apiKey]} />
              </Field>

              <FieldError>{methods.rootError}</FieldError>
              {success && <p className="text-sm text-primary">{t("updateSuccess")}</p>}

              <div>
                <Button type="submit" disabled={isPending}>
                  {isPending && <Spinner data-icon="inline-start" />}
                  {t("submit")}
                </Button>
              </div>
            </FieldGroup>
          )}
        </BaseForm>
      </CardContent>
    </Card>
  );
}
