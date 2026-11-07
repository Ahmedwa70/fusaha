// Regression guard for the missing save button on /admin/library/new.
//
// The form is long (bibliographic, classification, localized content, source,
// cover, PDF upload). Its only submit control used to live in the top header
// row, so once an admin scrolled down there was no visible way to save. The
// fix adds a sticky bottom action bar with a submit button at the end of the
// form. This project has no DOM/component test harness, so this test pins the
// contract at the source level: an end-of-form sticky bar containing a
// `type="submit"` control labelled with the saveDraft translation key must
// exist after the main field grid and before </form>.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "library-book-form.tsx"),
  "utf-8"
);

test("library book form has a sticky end-of-form submit bar (regression: no visible save button)", () => {
  const gridEnd = source.indexOf("</aside></div>");
  assert.notEqual(gridEnd, -1, "form structure changed unexpectedly (field grid not found)");
  const formEnd = source.indexOf("</form>", gridEnd);
  assert.notEqual(formEnd, -1, "form structure changed unexpectedly (</form> not found)");

  const bar = source.indexOf("sticky bottom-0", gridEnd);
  assert.notEqual(bar, -1, "missing sticky bottom action bar after the field grid");
  assert.ok(bar < formEnd, "sticky action bar must be inside the <form>");

  const submit = source.indexOf('type="submit"', bar);
  assert.notEqual(submit, -1, "sticky action bar has no submit button");
  assert.ok(submit < formEnd, "submit button must be inside the <form>");
  assert.ok(
    source.slice(submit, submit + 500).includes('t("saveDraft")'),
    "sticky submit button must be labelled with the saveDraft translation key"
  );
});

test("library book form keeps a header submit control as well", () => {
  assert.ok(
    source.split('type="submit"').length - 1 >= 2,
    "form should expose the save action in both the header and the sticky bottom bar"
  );
});
