// Independent tests for the Phase 8 read-only inventory tool. No database,
// no network — pure export-file fixtures per EXPORT_CONTRACT.md.
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { validateExport, classifyExport, runCli } from "./inventory-tool.mjs";

const BASE = "2026-01-01T00:00:00Z";
const LATER = "2026-06-01T00:00:00Z";

function validExport(overrides = {}) {
  return {
    exportVersion: 1,
    exportedAt: "2026-11-02T00:00:00Z",
    lessons: [{ lessonId: "l1", state: "approved", currentApprovedVersionId: "v-bound" }],
    lessonVersions: [
      {
        lessonVersionId: "v-bound",
        lessonId: "l1",
        versionNumber: 1,
        status: "approved",
        createdAt: BASE,
        approvedAt: BASE,
        schemaDefinitionId: "sd1",
        runtimeBindingStatus: "bound",
        runtimeVersionId: "r1",
      },
    ],
    schemaDefinitions: [{ schemaDefinitionId: "sd1", templateId: "t1" }],
    templates: [{ templateId: "t1", updatedAt: BASE }],
    runtimes: [{ runtimeVersionId: "r1", identity: `sha256-v1-${"a".repeat(64)}`, state: "published" }],
    shareLinks: [{ lessonId: "l1", active: true }],
    ...overrides,
  };
}

describe("validateExport — contract enforcement", () => {
  test("accepts a complete valid export", () => {
    const result = validateExport(validExport());
    assert.equal(result.ok, true, result.errors.join("; "));
  });

  test("rejects malformed JSON without throwing", () => {
    const result = validateExport("{not json");
    assert.equal(result.ok, false);
    assert.match(result.errors[0], /invalid JSON/);
  });

  test("rejects unsupported exportVersion", () => {
    const result = validateExport(validExport({ exportVersion: 2 }));
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("exportVersion")));
  });

  test("rejects missing required arrays", () => {
    const data = validExport();
    delete data.runtimes;
    const result = validateExport(data);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("runtimes")));
  });

  test("rejects unknown enum values", () => {
    const data = validExport();
    data.lessonVersions[0].runtimeBindingStatus = "maybe";
    const result = validateExport(data);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("runtimeBindingStatus")));
  });

  test("rejects malformed runtime identity", () => {
    const data = validExport();
    data.runtimes[0].identity = "not-a-identity";
    const result = validateExport(data);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("identity")));
  });

  test("rejects non-ISO timestamps", () => {
    const data = validExport();
    data.templates[0].updatedAt = "yesterday";
    const result = validateExport(data);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("updatedAt")));
  });

  test("rejects PII/content fields anywhere in the document", () => {
    const data = validExport();
    data.lessonVersions[0].htmlPlayer = "<html>secret lesson content</html>";
    data.lessons[0].ownerEmail = "teacher@real-school.example";
    const result = validateExport(data);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("PII")));
    assert.ok(result.errors.some((e) => e.includes("ownerEmail")));
    assert.ok(result.errors.some((e) => e.includes("htmlPlayer")));
  });

  test("rejects share tokens (secrets must not travel)", () => {
    const data = validExport();
    data.shareLinks[0].token = "s3cret-token";
    const result = validateExport(data);
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((e) => e.includes("PII")));
  });
});

describe("classifyExport — parity with the DB engine's decision table", () => {
  function fullExport() {
    return {
      exportVersion: 1,
      exportedAt: "2026-11-02T00:00:00Z",
      lessons: [
        { lessonId: "l-bound", state: "approved", currentApprovedVersionId: "v1" },
        { lessonId: "l-conflict", state: "approved", currentApprovedVersionId: "v3" },
        { lessonId: "l-gap", state: "approved", currentApprovedVersionId: "v5" },
        { lessonId: "l-fine", state: "approved", currentApprovedVersionId: "v6" },
        { lessonId: "l-no-approved", state: "draft", currentApprovedVersionId: null },
      ],
      lessonVersions: [
        { lessonVersionId: "v1", lessonId: "l-bound", versionNumber: 1, status: "approved", createdAt: LATER, approvedAt: LATER, schemaDefinitionId: "sd1", runtimeBindingStatus: "bound", runtimeVersionId: "r-ok" },
        { lessonVersionId: "v2", lessonId: "l-bound", versionNumber: 2, status: "approved", createdAt: LATER, approvedAt: LATER, schemaDefinitionId: "sd1", runtimeBindingStatus: "bound", runtimeVersionId: "r-failed" },
        { lessonVersionId: "v3", lessonId: "l-conflict", versionNumber: 1, status: "approved", createdAt: BASE, approvedAt: BASE, schemaDefinitionId: "sd2", runtimeBindingStatus: "unbound", runtimeVersionId: null },
        { lessonVersionId: "v4", lessonId: "l-conflict", versionNumber: 2, status: "approved", createdAt: BASE, approvedAt: BASE, schemaDefinitionId: "sd3", runtimeBindingStatus: "unbound", runtimeVersionId: null },
        { lessonVersionId: "v5", lessonId: "l-gap", versionNumber: 1, status: "approved", createdAt: LATER, approvedAt: LATER, schemaDefinitionId: "sd4", runtimeBindingStatus: "unbound", runtimeVersionId: null },
        { lessonVersionId: "v6", lessonId: "l-fine", versionNumber: 1, status: "approved", createdAt: LATER, approvedAt: LATER, schemaDefinitionId: "sd5", runtimeBindingStatus: "unbound", runtimeVersionId: null },
        { lessonVersionId: "v7", lessonId: "l-bound", versionNumber: 3, status: "draft", createdAt: LATER, approvedAt: null, schemaDefinitionId: "sd1", runtimeBindingStatus: "unbound", runtimeVersionId: null },
        { lessonVersionId: "v8", lessonId: "l-fine", versionNumber: 2, status: "approved", createdAt: LATER, approvedAt: LATER, schemaDefinitionId: "sd5", runtimeBindingStatus: "quarantined", runtimeVersionId: null },
        { lessonVersionId: "v9", lessonId: "l-gap", versionNumber: 2, status: "approved", createdAt: LATER, approvedAt: LATER, schemaDefinitionId: "sd2", runtimeBindingStatus: "bound", runtimeVersionId: "r-missing" },
      ],
      schemaDefinitions: [
        { schemaDefinitionId: "sd1", templateId: "t1" },
        { schemaDefinitionId: "sd2", templateId: "t2" },
        { schemaDefinitionId: "sd3", templateId: "t3" },
        { schemaDefinitionId: "sd4", templateId: null },
        { schemaDefinitionId: "sd5", templateId: "t5" },
      ],
      templates: [
        { templateId: "t1", updatedAt: LATER },
        { templateId: "t2", updatedAt: LATER }, // modified after v3/v9 were created
        { templateId: "t3", updatedAt: LATER }, // modified after v4 was created → evidence lost
        { templateId: "t5", updatedAt: BASE },
      ],
      runtimes: [
        { runtimeVersionId: "r-ok", identity: `sha256-v1-${"b".repeat(64)}`, state: "published" },
        { runtimeVersionId: "r-failed", identity: `sha256-v1-${"c".repeat(64)}`, state: "failed" },
        { runtimeVersionId: "r-orphan", identity: `sha256-v1-${"d".repeat(64)}`, state: "published" },
      ],
      shareLinks: [
        { lessonId: "l-bound", active: true },
        { lessonId: "l-conflict", active: true },
        { lessonId: "l-gap", active: true },
        { lessonId: "l-fine", active: true },
        { lessonId: "l-no-approved", active: true },
        { lessonId: "l-bound", active: false },
        { lessonId: "l-ghost", active: true },
      ],
    };
  }

  test("classifies every evidence combination exactly like the DB engine", () => {
    const report = classifyExport(fullExport());
    assert.equal(report.counts["already-bound"], 3); // v1, v2, v9 (bound rows are reported, never reclassified)
    assert.equal(report.counts["quarantined-conflict"], 2); // v3, v4
    assert.equal(report.counts["legacy-decision"], 0);
    assert.equal(report.counts["bound-candidate"], 1); // v6 (template last edited before generation)
    assert.equal(report.counts["quarantined-gap"], 1); // v5
    assert.equal(report.counts["out-of-scope-draft"], 1); // v7
    assert.equal(report.counts["remediated"], 1); // v8
    assert.equal(report.totalVersions, 9);
    const sum = Object.values(report.counts).reduce((a, b) => a + b, 0);
    assert.equal(sum, 9, "classes are mutually exclusive and exhaustive");
  });

  test("detects non-published and missing referenced runtimes", () => {
    const report = classifyExport(fullExport());
    assert.equal(report.integrityViolations.length, 2);
    const problems = report.integrityViolations.map((v) => v.problem).sort();
    assert.match(problems[0], /absent from export/);
    assert.match(problems[1], /state is failed/);
    assert.equal(report.runtimes.published, 2);
    assert.equal(report.runtimes.orphanPublished, 1, "published runtime referenced by no version is flagged");
  });

  test("flags affected share links only", () => {
    const report = classifyExport(fullExport());
    // affected: l-conflict (playable version in review), l-gap (runtime missing),
    // l-no-approved (no approved version), l-ghost (lesson absent)
    assert.equal(report.shareLinks.total, 7);
    assert.equal(report.shareLinks.active, 6);
    assert.equal(report.shareLinks.affected, 4);
    const problems = report.shareLinks.affectedList.map((a) => a.lessonId).sort();
    assert.deepEqual(problems, ["l-conflict", "l-gap", "l-ghost", "l-no-approved"]);
    // l-bound's active link is fine (its CURRENT approved version v1 is healthy).
  });

  test("separates human decisions from machine-actionable work", () => {
    const report = classifyExport(fullExport());
    // human: v3+v4 conflicts, v5 gap, v9 integrity violation (missing runtime), v2 integrity (failed runtime)
    assert.equal(report.humanDecisionCount, 5);
    const kinds = report.humanDecisions.map((d) => d.kind).sort();
    assert.deepEqual(kinds, ["integrity-violation", "integrity-violation", "quarantined-conflict", "quarantined-conflict", "quarantined-gap"]);
    assert.deepEqual(report.machineActionable, { boundCandidates: 1, legacyDecisions: 0 });
  });

  test("operator legacy decisions classify modified-template versions as legacy-decision", () => {
    const decisions = [
      { lessonVersionId: "v3", reason: "operator-approved snapshot (ticket INV-42)" },
      { lessonVersionId: "v4", reason: "   " }, // blank: legacy-decision but must be fixed by a human
    ];
    const report = classifyExport(fullExport(), decisions);
    assert.equal(report.counts["legacy-decision"], 2);
    assert.equal(report.counts["quarantined-conflict"], 0, "with a decision the conflict becomes legacy");
    assert.equal(report.counts["bound-candidate"], 1, "v6 only — v4 is now a decision, not evidence");
    const blank = report.humanDecisions.filter((d) => d.kind === "legacy-decision");
    assert.equal(blank.length, 1);
    assert.equal(blank[0].lessonVersionId, "v4");
  });

  test("a blank-reason decision is never silently downgraded to conflict", () => {
    const report = classifyExport(fullExport(), [{ lessonVersionId: "v3", reason: "" }]);
    const entry = report.entries.find((e) => e.lessonVersionId === "v3");
    assert.equal(entry.classification, "legacy-decision");
    assert.match(entry.reason, /blank reason/);
  });
});

describe("runCli — exit codes and loud failure", () => {
  const files = {
    "/ok.json": JSON.stringify(validExport()),
    "/bad.json": JSON.stringify(validExport({ exportVersion: 9 })),
    "/pii.json": JSON.stringify({ ...validExport(), lessonVersions: [{ ...validExport().lessonVersions[0], name: "Real Student Name" }] }),
  };

  test("exit 2 without arguments", () => {
    const errors = [];
    const code = runCli(["node", "tool"], { readFile: () => { throw new Error("no read expected"); }, stdout: () => {}, stderr: (m) => errors.push(m) });
    assert.equal(code, 2);
    assert.match(errors[0], /usage/);
  });

  test("exit 1 on invalid export, with every error listed", () => {
    const errors = [];
    const code = runCli(["node", "tool", "/bad.json"], { readFile: (p) => files[p], stdout: () => {}, stderr: (m) => errors.push(m) });
    assert.equal(code, 1);
    assert.ok(errors.some((m) => m.includes("exportVersion")));
  });

  test("exit 1 on PII-bearing export", () => {
    const errors = [];
    const code = runCli(["node", "tool", "/pii.json"], { readFile: (p) => files[p], stdout: () => {}, stderr: (m) => errors.push(m) });
    assert.equal(code, 1);
    assert.ok(errors.some((m) => m.includes("PII")));
  });

  test("exit 0 and prints the report on a valid export", () => {
    let out = "";
    const code = runCli(["node", "tool", "/ok.json"], { readFile: (p) => files[p], stdout: (m) => { out = m; }, stderr: () => {} });
    assert.equal(code, 0);
    const report = JSON.parse(out);
    assert.equal(report.totalVersions, 1);
  });
});
