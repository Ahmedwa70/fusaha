// Pure predicate deciding which schema_definitions may appear in the
// create-lesson wizard's level picker. Kept alias/dependency-free so
// node:test can exercise it without a database.
//
// This MUST stay in exact sync with createLesson's contract in
// actions/generation.ts: a level can only be created when its definition is
// active AND linked to a template (templateId non-null; the FK with
// onDelete: "restrict" guarantees the linked template row exists). The bug
// this fixes: the picker offered active-but-template-less definitions, which
// creation then rejected with "اختر مستوى الدرس" — blaming the user for a
// server-side data gap they can neither see nor fix.

export type SchemaDefinitionAvailability = {
  active: boolean;
  templateId: string | null;
};

export function isPickableSchemaDefinition(row: SchemaDefinitionAvailability): boolean {
  return row.active && row.templateId !== null;
}
