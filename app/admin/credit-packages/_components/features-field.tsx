"use client";

import {
  useFieldArray,
  type Control,
  type UseFormRegister,
  type FieldValues,
  type FieldArray,
  type FieldArrayPath,
  type Path,
} from "react-hook-form";
import { useTranslations } from "next-intl";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { locales, localeLabels, type Locale } from "@/i18n/config";

type LocaleErrors = Partial<Record<Locale, { message?: string } | undefined>>;

// Features are stored as one entry per bullet, each carrying that bullet's
// text in every locale (see validation/credit-packages.ts), and edited as
// add/remove rows rather than one-line-per-feature in a textarea — closer to
// how the admin thinks about the list, and avoids blank/duplicate lines
// slipping in unnoticed. Keeping the locales together in one row (instead of
// a separate list per language) keeps the bullets aligned across languages.
export function FeaturesField<T extends FieldValues>({
  name,
  control,
  register,
  errors,
}: {
  name: string;
  control: Control<T>;
  register: UseFormRegister<T>;
  // Indexed rather than an array: react-hook-form reports array-field errors
  // as an array-shaped object that also carries its own error properties.
  errors?: { [index: number]: LocaleErrors | undefined };
}) {
  const t = useTranslations("admin.creditPackages");
  type ArrayPath = FieldArrayPath<T>;
  const { fields, append, remove } = useFieldArray({ control, name: name as ArrayPath });
  const emptyRow = Object.fromEntries(locales.map((locale) => [locale, ""]));

  return (
    <div className="flex flex-col gap-3">
      {fields.length === 0 && <p className="text-sm text-muted-foreground">{t("noFeatures")}</p>}

      {fields.map((field, index) => (
        <div key={field.id} className="flex items-start gap-2 rounded-lg border border-border p-3">
          <div className="flex flex-1 flex-col gap-2">
            <p className="text-xs font-medium text-muted-foreground">{t("featureNumber", { number: index + 1 })}</p>
            {locales.map((locale) => (
              <div key={locale} className="flex flex-col gap-1">
                <Input
                  dir="auto"
                  aria-label={`${t("fieldFeatures")} — ${localeLabels[locale]}`}
                  placeholder={`${t("featurePlaceholder")} — ${localeLabels[locale]}`}
                  {...register(`${name}.${index}.${locale}` as Path<T>)}
                />
                <FieldError errors={[errors?.[index]?.[locale]]} />
              </div>
            ))}
          </div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={t("removeFeature")}
            onClick={() => remove(index)}
          >
            <Trash2Icon className="text-destructive" />
          </Button>
        </div>
      ))}

      <Button
        type="button"
        size="sm"
        variant="outline"
        className="w-fit gap-1"
        onClick={() => append(emptyRow as FieldArray<T, ArrayPath>)}
      >
        <PlusIcon data-icon="inline-start" />
        {t("addFeature")}
      </Button>
    </div>
  );
}
