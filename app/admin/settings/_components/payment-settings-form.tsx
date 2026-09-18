"use client";

import { useState, useTransition } from "react";
import { Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { BaseForm } from "@/components/shared/form/base-form";
import { dateFormatter } from "@/lib/dashboard/format";
import { updatePaymentSettingsSchema } from "@/validation/settings";
import { updatePaymentSettings } from "@/actions/settings";

export function PaymentSettingsForm({
  paymentSettings,
}: {
  paymentSettings: { autoPaymentEnabled: boolean; whatsappContactNumber: string; updatedAt: Date | null };
}) {
  const t = useTranslations("admin.settings");
  const tValidation = useTranslations("validation.settings");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("paymentCardTitle")}</CardTitle>
        <CardDescription>{t("paymentCardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {paymentSettings.updatedAt && (
          <div className="mb-6 flex flex-col gap-1 rounded-md border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">
              {t("lastUpdatedAt", { date: dateFormatter.format(paymentSettings.updatedAt) })}
            </span>
          </div>
        )}

        <BaseForm
          schema={updatePaymentSettingsSchema(tValidation)}
          defaultValues={paymentSettings}
          isLoading={isPending}
          onSubmit={(values) => {
            setSuccess(false);
            return new Promise((resolve) => {
              startTransition(async () => {
                const result = await updatePaymentSettings(values);
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
              <Field orientation="horizontal">
                <FieldLabel htmlFor="auto-payment-enabled">{t("fieldAutoPaymentEnabled")}</FieldLabel>
                <Controller
                  control={methods.control}
                  name="autoPaymentEnabled"
                  render={({ field }) => (
                    <Switch id="auto-payment-enabled" checked={field.value} onCheckedChange={field.onChange} />
                  )}
                />
              </Field>
              <FieldDescription>{t("fieldAutoPaymentEnabledDescription")}</FieldDescription>

              <Field data-invalid={!!methods.errors.whatsappContactNumber}>
                <FieldLabel htmlFor="whatsapp-contact-number">{t("fieldWhatsappContactNumber")}</FieldLabel>
                <Input id="whatsapp-contact-number" dir="ltr" {...methods.register("whatsappContactNumber")} />
                <FieldDescription>{t("fieldWhatsappContactNumberDescription")}</FieldDescription>
                <FieldError errors={[methods.errors.whatsappContactNumber]} />
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
