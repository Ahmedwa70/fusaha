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
//
// Scope note: the predicate sees only the definition row. The picker query
// (getActiveSchemaDefinitions) additionally inner-joins templates and
// requires templates.active = true, matching createLesson's template.active
// gate — a schema whose template was deactivated/retired is not offered even
// though this predicate alone cannot see that.

export type SchemaDefinitionAvailability = {
  active: boolean;
  templateId: string | null;
};

export function isPickableSchemaDefinition(row: SchemaDefinitionAvailability): boolean {
  return row.active && row.templateId !== null;
}

// Sentinel level key: the schema_definitions row that absorbs
// lesson_versions.schema_definition_id when a schema definition is retired
// (D1). Never deletable itself, never pickable (active=false). Lives here —
// not in an actions/ "use server" file, which may only export async
// functions. Created on-demand by the staging/runtime tooling; the retire
// action refuses to run while the sentinel row is missing.
export const RETIRED_SCHEMA_DEFINITION_LEVEL_KEY = "retired";
