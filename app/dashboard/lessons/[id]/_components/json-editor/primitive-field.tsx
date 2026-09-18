"use client";

import { Controller, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldContent, FieldLabel } from "@/components/ui/field";

// >80 chars or a newline reads better in a multi-line Textarea than a
// single-line Input — everything else (short titles, single words) stays
// an Input.
const LONG_TEXT_THRESHOLD = 80;

export function PrimitiveField({
  name,
  label,
  value,
}: {
  name: string;
  label: string;
  value: unknown;
}) {
  const { control, register } = useFormContext();

  if (typeof value === "boolean") {
    return (
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <FieldLabel className="flex-row items-center gap-2">
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
            <span>{label}</span>
          </FieldLabel>
        )}
      />
    );
  }

  if (typeof value === "number") {
    return (
      <Field>
        <FieldLabel>{label}</FieldLabel>
        <FieldContent>
          <Input type="number" {...register(name, { valueAsNumber: true })} />
        </FieldContent>
      </Field>
    );
  }

  // Strings, null and undefined all edit as text — this is real lesson
  // content (often Arabic), so it must take its natural text direction
  // rather than being forced to `dir="ltr"` like the raw code-editor
  // textareas elsewhere in this codebase.
  const stringValue = typeof value === "string" ? value : "";
  const isLong = stringValue.length > LONG_TEXT_THRESHOLD || stringValue.includes("\n");

  return (
    <Field>
      <FieldLabel>{label}</FieldLabel>
      <FieldContent>
        {isLong ? <Textarea {...register(name)} rows={4} /> : <Input {...register(name)} />}
      </FieldContent>
    </Field>
  );
}
