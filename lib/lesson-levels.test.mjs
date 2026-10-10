// Unit tests for the level-picker contract — no database needed.
// Run with: pnpm test

import { test } from "node:test";
import assert from "node:assert/strict";
import { isPickableSchemaDefinition } from "./lesson-levels.ts";

// The exact reported bug: "المستوى الأول" is active (shown in step 2) but its
// seeded definition has no template linked, so createLesson rejected it.
// Such a definition must never be offered by the picker in the first place.
test("active definition WITHOUT a template (the reported bug) is not pickable", () => {
  assert.equal(
    isPickableSchemaDefinition({ active: true, templateId: null }),
    false
  );
});

test("active definition WITH a template is pickable", () => {
  assert.equal(
    isPickableSchemaDefinition({ active: true, templateId: "template-uuid" }),
    true
  );
});

test("inactive definition with a template is not pickable", () => {
  assert.equal(
    isPickableSchemaDefinition({ active: false, templateId: "template-uuid" }),
    false
  );
});

test("inactive definition without a template is not pickable", () => {
  assert.equal(
    isPickableSchemaDefinition({ active: false, templateId: null }),
    false
  );
});
