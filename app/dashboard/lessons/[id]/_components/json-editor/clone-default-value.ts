// When a teacher adds a new item to an array (vocab list, dialogue lines,
// MCQ options, ...) we need a sensible blank value shaped like its
// siblings — there is no schema to consult (content is template-defined
// JSON, see lib/ai/lesson-content-schema.ts), so we clone the shape of an
// existing sibling and blank out its leaves.
export function cloneDefaultValue(sample: unknown): unknown {
  if (Array.isArray(sample)) {
    return sample.map(cloneDefaultValue);
  }
  if (sample !== null && typeof sample === "object") {
    return Object.fromEntries(
      Object.entries(sample as Record<string, unknown>).map(([key, value]) => [key, cloneDefaultValue(value)])
    );
  }
  if (typeof sample === "number") return 0;
  if (typeof sample === "boolean") return false;
  return "";
}
