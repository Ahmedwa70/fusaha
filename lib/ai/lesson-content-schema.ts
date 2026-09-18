import { z } from "zod";

// Each template now defines its own content shape via its blueprint +
// the schema-definition's instructions text — there is no more single
// fixed lesson shape to encode here. Real structural checking happens
// per-template via the template's validation script (see lib/templates/
// run-validation.ts, a separate follow-up piece of this same feature).
export function lessonContentSchema(t: (key: string) => string) {
  return z.record(z.string(), z.unknown());
}

export type LessonContent = z.infer<ReturnType<typeof lessonContentSchema>>;
