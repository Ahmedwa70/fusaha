"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { BaseForm } from "@/components/shared/form/base-form";
import { dateFormatter } from "@/lib/dashboard/format";
import { updateGenerationCostSchema } from "@/validation/settings";
import { updateGenerationCost } from "@/actions/settings";

export function GenerationCostForm({
  generationCost,
}: {
  generationCost: { cost: number; updatedAt: Date | null };
}) {
  const t = useTranslations("admin.settings");
  const tValidation = useTranslations("validation.settings");
  const [isPending, startTransition] = useTransition();
  const [success, setSuccess] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("generationCostCardTitle")}</CardTitle>
        <CardDescription>{t("generationCostCardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {generationCost.updatedAt && (
          <div className="mb-6 flex flex-col gap-1 rounded-md border bg-muted/40 p-3 text-sm">
            <span className="text-muted-foreground">
              {t("lastUpdatedAt", { date: dateFormatter.format(generationCost.updatedAt) })}
            </span>
          </div>
        )}

        <BaseForm
          schema={updateGenerationCostSchema(tValidation)}
          defaultValues={{ cost: generationCost.cost }}
          isLoading={isPending}
          onSubmit={(values) => {
            setSuccess(false);
            return new Promise((resolve) => {
              startTransition(async () => {
                const result = await updateGenerationCost(values);
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
              <Field data-invalid={!!methods.errors.cost}>
                <FieldLabel htmlFor="generation-cost">{t("fieldGenerationCost")}</FieldLabel>
                <Input id="generation-cost" type="number" min={1} step={1} {...methods.register("cost")} />
                <FieldError errors={[methods.errors.cost]} />
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
