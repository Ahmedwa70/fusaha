"use client";

import type { FieldValues, Path, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { locales, localeLabels, type Locale } from "@/i18n/config";

type LocaleErrors = Partial<Record<Locale, { message?: string } | undefined>>;

// A display field the teacher reads on the pricing card: one input per
// locale, stacked, same shape as the schema-definition level field. The
// value is stored as jsonb keyed by locale — see lib/localized-text.ts.
export function LocalizedTextField<T extends FieldValues>({
  idPrefix,
  name,
  label,
  description,
  register,
  errors,
}: {
  idPrefix: string;
  name: string;
  label: string;
  description?: string;
  register: UseFormRegister<T>;
  errors?: LocaleErrors;
}) {
  return (
    <>
      {locales.map((locale, index) => (
        <Field key={locale} data-invalid={!!errors?.[locale]}>
          <FieldLabel htmlFor={`${idPrefix}-${locale}`}>
            {label} — {localeLabels[locale]}
          </FieldLabel>
          <Input id={`${idPrefix}-${locale}`} dir="auto" {...register(`${name}.${locale}` as Path<T>)} />
          {/* The hint describes the field as a whole, so it only goes under the last locale. */}
          {description && index === locales.length - 1 && <FieldDescription>{description}</FieldDescription>}
          <FieldError errors={[errors?.[locale]]} />
        </Field>
      ))}
    </>
  );
}
