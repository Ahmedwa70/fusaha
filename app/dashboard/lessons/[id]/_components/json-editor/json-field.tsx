"use client";

import { ArrayField } from "./array-field";
import { ObjectField } from "./object-field";
import { PrimitiveField } from "./primitive-field";

// The generic recursive dispatcher: lesson content has no fixed schema
// (each template shapes its own JSON — see lib/ai/lesson-content-schema.ts),
// so the form is driven entirely by the actual shape of the value at each
// RHF field path, recursing into objects/arrays until it bottoms out at a
// primitive (string/number/boolean/null/undefined).
export function JsonField({
  name,
  label,
  value,
  depth = 0,
}: {
  name: string;
  label: string;
  value: unknown;
  depth?: number;
}) {
  if (Array.isArray(value)) {
    return <ArrayField name={name} label={label} value={value} />;
  }

  if (value !== null && typeof value === "object") {
    return <ObjectField name={name} label={label} value={value as Record<string, unknown>} depth={depth} />;
  }

  return <PrimitiveField name={name} label={label} value={value} />;
}
