"use client";

import { useTransition } from "react";
import { Controller } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldGroup, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { createCreditPackageSchema, updateCreditPackageSchema } from "@/validation/credit-packages";
import { createCreditPackage, updateCreditPackage } from "@/actions/credit-packages";
import type { CreditPackageListItem } from "@/lib/admin/queries/credit-package";
import type { LocalizedText } from "@/lib/localized-text";
import { locales, type Locale } from "@/i18n/config";
import { DialogForm } from "@/components/shared/form/dialog-form";
import { HexColorField } from "./hex-color-field";
import { FeaturesField } from "./features-field";
import { LocalizedTextField } from "./localized-text-field";

type Props =
  | { mode: "create"; open: boolean; onOpenChange: (open: boolean) => void; creditPackage?: undefined }
  | { mode: "edit"; open: boolean; onOpenChange: (open: boolean) => void; creditPackage: CreditPackageListItem };

// The localized fields are stored as jsonb keyed by locale, possibly with
// locales missing on older rows — the form always edits every locale, so
// missing ones come in as empty inputs.
function toLocalizedInput(value: LocalizedText | null | undefined): Record<Locale, string> {
  return Object.fromEntries(locales.map((locale) => [locale, value?.[locale] ?? ""])) as Record<Locale, string>;
}

export function CreditPackageFormDialog({ mode, open, onOpenChange, creditPackage }: Props) {
  const t = useTranslations("admin.creditPackages");
  const tValidation = useTranslations("validation.creditPackages");
  const [isPending, startTransition] = useTransition();

  if (mode === "create") {
    return (
      <DialogForm
        schema={createCreditPackageSchema(tValidation)}
        defaultValues={{
          name: toLocalizedInput(null),
          creditsAmount: 0,
          price: 0,
          paddlePriceId: "",
          badgeLabel: toLocalizedInput(null),
          subtitle: toLocalizedInput(null),
          footerText: toLocalizedInput(null),
          features: [],
          colorDark: "",
        }}
        isLoading={isPending}
        title={t("createDialogTitle")}
        description={t("createDialogDescription")}
        open={open}
        onOpenChange={onOpenChange}
        submitLabel={t("submitCreate")}
        cancelLabel={t("cancel")}
        className="sm:max-w-5xl"
        onSubmit={(values) => {
          return new Promise((resolve) => {
            startTransition(async () => {
              const result = await createCreditPackage(values);
              if ("error" in result) {
                resolve({ error: result.error });
                return;
              }
              onOpenChange(false);
              resolve();
            });
          });
        }}
      >
        {(methods) => (
          <FieldGroup>
            <LocalizedTextField
              idPrefix="credit-package-name"
              name="name"
              label={t("fieldName")}
              register={methods.register}
              errors={methods.errors.name}
            />

            <Field data-invalid={!!methods.errors.creditsAmount}>
              <FieldLabel htmlFor="credit-package-credits-amount">{t("fieldCreditsAmount")}</FieldLabel>
              <Input
                id="credit-package-credits-amount"
                type="number"
                min={1}
                {...methods.register("creditsAmount")}
              />
              <FieldError errors={[methods.errors.creditsAmount]} />
            </Field>

            <Field data-invalid={!!methods.errors.price}>
              <FieldLabel htmlFor="credit-package-price">{t("fieldPrice")}</FieldLabel>
              <Input id="credit-package-price" type="number" min={0} step="any" dir="ltr" {...methods.register("price")} />
              <FieldDescription>{t("fieldPriceDescription")}</FieldDescription>
              <FieldError errors={[methods.errors.price]} />
            </Field>

            <Field data-invalid={!!methods.errors.paddlePriceId}>
              <FieldLabel htmlFor="credit-package-paddle-price-id">{t("fieldPaddlePriceId")}</FieldLabel>
              <Input id="credit-package-paddle-price-id" dir="ltr" {...methods.register("paddlePriceId")} />
              <FieldDescription>{t("fieldPaddlePriceIdDescription")}</FieldDescription>
              <FieldError errors={[methods.errors.paddlePriceId]} />
            </Field>

            <LocalizedTextField
              idPrefix="credit-package-badge-label"
              name="badgeLabel"
              label={t("fieldBadgeLabel")}
              description={t("fieldBadgeLabelDescription")}
              register={methods.register}
              errors={methods.errors.badgeLabel}
            />

            <LocalizedTextField
              idPrefix="credit-package-subtitle"
              name="subtitle"
              label={t("fieldSubtitle")}
              description={t("fieldSubtitleDescription")}
              register={methods.register}
              errors={methods.errors.subtitle}
            />

            <LocalizedTextField
              idPrefix="credit-package-footer-text"
              name="footerText"
              label={t("fieldFooterText")}
              description={t("fieldFooterTextDescription")}
              register={methods.register}
              errors={methods.errors.footerText}
            />

            <Field data-invalid={!!methods.errors.features}>
              <FieldLabel>{t("fieldFeatures")}</FieldLabel>
              <FeaturesField
                name="features"
                control={methods.control}
                register={methods.register}
                errors={methods.errors.features}
              />
              <FieldDescription>{t("fieldFeaturesDescription")}</FieldDescription>
            </Field>

            <Field data-invalid={!!methods.errors.colorDark}>
              <FieldLabel htmlFor="credit-package-color-dark">{t("fieldColorDark")}</FieldLabel>
              <Controller
                control={methods.control}
                name="colorDark"
                render={({ field }) => (
                  <HexColorField id="credit-package-color-dark" value={field.value ?? ""} onChange={field.onChange} />
                )}
              />
              <FieldDescription>{t("fieldColorDescription")}</FieldDescription>
              <FieldError errors={[methods.errors.colorDark]} />
            </Field>
          </FieldGroup>
        )}
      </DialogForm>
    );
  }

  return (
    <DialogForm
      schema={updateCreditPackageSchema(tValidation)}
      defaultValues={{
        name: toLocalizedInput(creditPackage.name),
        creditsAmount: creditPackage.creditsAmount,
        price: creditPackage.price / 100,
        active: creditPackage.active,
        paddlePriceId: creditPackage.paddlePriceId ?? "",
        badgeLabel: toLocalizedInput(creditPackage.badgeLabel),
        subtitle: toLocalizedInput(creditPackage.subtitle),
        footerText: toLocalizedInput(creditPackage.footerText),
        features: creditPackage.features.map(toLocalizedInput),
        colorDark: creditPackage.colorDark ?? "",
      }}
      isLoading={isPending}
      title={t("editDialogTitle")}
      description={t("editDialogDescription")}
      open={open}
      onOpenChange={onOpenChange}
      submitLabel={t("submitUpdate")}
      cancelLabel={t("cancel")}
      className="sm:max-w-5xl"
      onSubmit={(values) => {
        return new Promise((resolve) => {
          startTransition(async () => {
            const result = await updateCreditPackage(creditPackage.id, values);
            if ("error" in result) {
              resolve({ error: result.error });
              return;
            }
            onOpenChange(false);
            resolve();
          });
        });
      }}
    >
      {(methods) => (
        <FieldGroup>
          <LocalizedTextField
            idPrefix="credit-package-edit-name"
            name="name"
            label={t("fieldName")}
            register={methods.register}
            errors={methods.errors.name}
          />

          <Field data-invalid={!!methods.errors.creditsAmount}>
            <FieldLabel htmlFor="credit-package-edit-credits-amount">{t("fieldCreditsAmount")}</FieldLabel>
            <Input
              id="credit-package-edit-credits-amount"
              type="number"
              min={1}
              {...methods.register("creditsAmount")}
            />
            <FieldError errors={[methods.errors.creditsAmount]} />
          </Field>

          <Field data-invalid={!!methods.errors.price}>
            <FieldLabel htmlFor="credit-package-edit-price">{t("fieldPrice")}</FieldLabel>
            <Input
              id="credit-package-edit-price"
              type="number"
              min={0}
              step="any"
              dir="ltr"
              {...methods.register("price")}
            />
            <FieldDescription>{t("fieldPriceDescription")}</FieldDescription>
            <FieldError errors={[methods.errors.price]} />
          </Field>

          <Field data-invalid={!!methods.errors.paddlePriceId}>
            <FieldLabel htmlFor="credit-package-edit-paddle-price-id">{t("fieldPaddlePriceId")}</FieldLabel>
            <Input id="credit-package-edit-paddle-price-id" dir="ltr" {...methods.register("paddlePriceId")} />
            <FieldDescription>{t("fieldPaddlePriceIdDescription")}</FieldDescription>
            <FieldError errors={[methods.errors.paddlePriceId]} />
          </Field>

          <Field orientation="horizontal">
            <FieldLabel htmlFor="credit-package-active">{t("fieldActive")}</FieldLabel>
            <Controller
              control={methods.control}
              name="active"
              render={({ field }) => (
                <Switch id="credit-package-active" checked={field.value} onCheckedChange={field.onChange} />
              )}
            />
          </Field>

          <LocalizedTextField
            idPrefix="credit-package-edit-badge-label"
            name="badgeLabel"
            label={t("fieldBadgeLabel")}
            description={t("fieldBadgeLabelDescription")}
            register={methods.register}
            errors={methods.errors.badgeLabel}
          />

          <LocalizedTextField
            idPrefix="credit-package-edit-subtitle"
            name="subtitle"
            label={t("fieldSubtitle")}
            description={t("fieldSubtitleDescription")}
            register={methods.register}
            errors={methods.errors.subtitle}
          />

          <LocalizedTextField
            idPrefix="credit-package-edit-footer-text"
            name="footerText"
            label={t("fieldFooterText")}
            description={t("fieldFooterTextDescription")}
            register={methods.register}
            errors={methods.errors.footerText}
          />

          <Field data-invalid={!!methods.errors.features}>
            <FieldLabel>{t("fieldFeatures")}</FieldLabel>
            <FeaturesField
              name="features"
              control={methods.control}
              register={methods.register}
              errors={methods.errors.features}
            />
            <FieldDescription>{t("fieldFeaturesDescription")}</FieldDescription>
          </Field>

          <Field data-invalid={!!methods.errors.colorDark}>
            <FieldLabel htmlFor="credit-package-edit-color-dark">{t("fieldColorDark")}</FieldLabel>
            <Controller
              control={methods.control}
              name="colorDark"
              render={({ field }) => (
                <HexColorField id="credit-package-edit-color-dark" value={field.value ?? ""} onChange={field.onChange} />
              )}
            />
            <FieldDescription>{t("fieldColorDescription")}</FieldDescription>
            <FieldError errors={[methods.errors.colorDark]} />
          </Field>
        </FieldGroup>
      )}
    </DialogForm>
  );
}
