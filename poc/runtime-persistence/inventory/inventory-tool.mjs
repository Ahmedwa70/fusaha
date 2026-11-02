// Phase 8 read-only inventory tool. Consumes an ANONYMIZED export file that
// follows EXPORT_CONTRACT.md (identifiers + timestamps only, no PII, no
// content bytes) and produces:
//   1. validation errors (fails loudly on missing/PII-incompatible exports),
//   2. the deterministic nine-class classification of every lesson version
//      (mirrors lib/runtime/historical-runtime-classification.ts exactly),
//   3. runtime reference health (missing/non-published/orphan runtimes),
//   4. affected share links (active links whose playable version would fail
//      closed or fall into review),
//   5. a separated list of HUMAN DECISIONS vs machine-actionable work.
//
// NEVER connects to a database. Read-only by construction: it only reads the
// export file you pass it.
//
// Usage:
//   node inventory-tool.mjs export.json [--decisions decisions.json]

import { readFileSync } from "node:fs";

const VERSION_STATUSES = new Set(["draft", "approved"]);
const LESSON_STATES = new Set(["draft", "generating", "generation_failed", "approved"]);
const BINDING_STATUSES = new Set(["unbound", "bound", "legacy", "quarantined", "unrecoverable"]);
const RUNTIME_STATES = new Set(["pending", "published", "failed", "quarantined", "deletion_pending", "collected"]);

const PII_FIELD_PATTERNS = [
  /email/i,
  /(^|_)(name|title)$/i,
  /display_?name/i,
  /html_?player/i,
  /(^|\.)content$/i,
  /lesson_?content|user_?content/i,
  /token/i, // share tokens are secrets; only `active` may leave the building
  /phone|avatar|photo/i,
];

const ISO_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})$/;

function isIso(value) {
  return typeof value === "string" && ISO_PATTERN.test(value) && !Number.isNaN(Date.parse(value));
}

function isId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 128;
}

function isNullableId(value) {
  return value === null || isId(value);
}

function isBool(value) {
  return typeof value === "boolean";
}

function isInt(value) {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Reject PII-shaped fields anywhere in the document (defense in depth). */
function findPiiFields(value, path = "", found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => findPiiFields(item, `${path}[${index}]`, found));
    return found;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      const here = path ? `${path}.${key}` : key;
      if (PII_FIELD_PATTERNS.some((pattern) => pattern.test(key))) found.push(here);
      findPiiFields(nested, here, found);
    }
  }
  return found;
}

function validateArray(name, data, errors, itemValidator) {
  if (!(name in data)) {
    errors.push(`missing required array: ${name}`);
    return [];
  }
  if (!Array.isArray(data[name])) {
    errors.push(`${name} must be an array`);
    return [];
  }
  data[name].forEach((item, index) => itemValidator(item, `${name}[${index}]`, errors));
  return data[name];
}

/**
 * Validate an export against EXPORT_CONTRACT.md v1.
 * Returns { ok, errors, data } — never throws on bad input.
 */
export function validateExport(raw) {
  const errors = [];
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return { ok: false, errors: [`invalid JSON: ${error.message}`], data: null };
    }
  }
  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { ok: false, errors: ["export root must be an object"], data: null };
  }
  if (data.exportVersion !== 1) {
    errors.push(`unsupported exportVersion: ${JSON.stringify(data.exportVersion)} (want 1)`);
  }
  if (!isIso(data.exportedAt)) errors.push("exportedAt must be an ISO-8601 timestamp");

  validateArray("lessons", data, errors, (item, at, errs) => {
    if (!isId(item.lessonId)) errs.push(`${at}.lessonId missing/invalid`);
    if (!LESSON_STATES.has(item.state)) errs.push(`${at}.state must be one of ${[...LESSON_STATES].join("|")}`);
    if (!isNullableId(item.currentApprovedVersionId)) errs.push(`${at}.currentApprovedVersionId must be id|null`);
  });
  validateArray("lessonVersions", data, errors, (item, at, errs) => {
    if (!isId(item.lessonVersionId)) errs.push(`${at}.lessonVersionId missing/invalid`);
    if (!isId(item.lessonId)) errs.push(`${at}.lessonId missing/invalid`);
    if (!isInt(item.versionNumber) || item.versionNumber < 1) errs.push(`${at}.versionNumber must be a positive integer`);
    if (!VERSION_STATUSES.has(item.status)) errs.push(`${at}.status must be draft|approved`);
    if (!isIso(item.createdAt)) errs.push(`${at}.createdAt must be ISO-8601`);
    if (item.approvedAt !== null && !isIso(item.approvedAt)) errs.push(`${at}.approvedAt must be ISO-8601|null`);
    if (!isNullableId(item.schemaDefinitionId)) errs.push(`${at}.schemaDefinitionId must be id|null`);
    if (!BINDING_STATUSES.has(item.runtimeBindingStatus)) errs.push(`${at}.runtimeBindingStatus must be one of ${[...BINDING_STATUSES].join("|")}`);
    if (!isNullableId(item.runtimeVersionId)) errs.push(`${at}.runtimeVersionId must be id|null`);
  });
  validateArray("schemaDefinitions", data, errors, (item, at, errs) => {
    if (!isId(item.schemaDefinitionId)) errs.push(`${at}.schemaDefinitionId missing/invalid`);
    if (!isNullableId(item.templateId)) errs.push(`${at}.templateId must be id|null`);
  });
  validateArray("templates", data, errors, (item, at, errs) => {
    if (!isId(item.templateId)) errs.push(`${at}.templateId missing/invalid`);
    if (!isIso(item.updatedAt)) errs.push(`${at}.updatedAt must be ISO-8601`);
  });
  validateArray("runtimes", data, errors, (item, at, errs) => {
    if (!isId(item.runtimeVersionId)) errs.push(`${at}.runtimeVersionId missing/invalid`);
    if (typeof item.identity !== "string" || !/^sha256-v1-[0-9a-f]{64}$/.test(item.identity)) {
      errs.push(`${at}.identity must match sha256-v1-<64 hex>`);
    }
    if (!RUNTIME_STATES.has(item.state)) errs.push(`${at}.state must be one of ${[...RUNTIME_STATES].join("|")}`);
  });
  validateArray("shareLinks", data, errors, (item, at, errs) => {
    if (!isId(item.lessonId)) errs.push(`${at}.lessonId missing/invalid`);
    if (!isBool(item.active)) errs.push(`${at}.active must be boolean`);
  });

  const pii = findPiiFields(data);
  if (pii.length > 0) errors.push(`PII/content fields present (contract violation): ${pii.join(", ")}`);

  return { ok: errors.length === 0, errors, data };
}

/** Classify one version row — byte-for-byte the engine's decision table. */
function classifyRow(row, template, legacyDecisions) {
  if (row.status !== "approved") {
    return { classification: "out-of-scope-draft", reason: "version is not approved; playable migration covers approved versions only" };
  }
  if (row.runtimeBindingStatus === "bound" || row.runtimeBindingStatus === "legacy") {
    return { classification: "already-bound", reason: `binding already established (status=${row.runtimeBindingStatus})` };
  }
  if (row.runtimeBindingStatus === "quarantined" || row.runtimeBindingStatus === "unrecoverable") {
    return { classification: "remediated", reason: `previously remediated (status=${row.runtimeBindingStatus}); never reclassified automatically` };
  }
  const playerAvailable = row.schemaDefinitionId !== null && template !== undefined && template !== null;
  if (!playerAvailable) {
    return { classification: "quarantined-gap", reason: "no player bytes in the database (schema definition has no linked template); rendering is already broken; reviewable from backups" };
  }
  const immutabilityEvidence = Date.parse(template.updatedAt) <= Date.parse(row.createdAt);
  const decision = legacyDecisions.get(row.lessonVersionId);
  if (immutabilityEvidence) {
    return { classification: "bound-candidate", reason: "templates.updated_at <= version.created_at: player bytes provably unchanged since generation" };
  }
  if (decision !== undefined) {
    return {
      classification: "legacy-decision",
      reason: decision.trim().length > 0 ? `explicit legacy decision: ${decision}` : "explicit legacy decision with a blank reason (must be rejected at apply time)",
    };
  }
  return { classification: "quarantined-conflict", reason: "template was modified after version creation; html_player change cannot be disproven from the schema alone — review template audit history or supply an explicit legacy decision" };
}

/**
 * Classify a validated export. `legacyDecisions` is an array of
 * { lessonVersionId, reason }. Pure function: no I/O.
 */
export function classifyExport(data, legacyDecisions = []) {
  const decisions = new Map(legacyDecisions.map((d) => [d.lessonVersionId, d.reason]));
  const templateById = new Map(data.templates.map((t) => [t.templateId, t]));
  const schemaDefById = new Map(data.schemaDefinitions.map((s) => [s.schemaDefinitionId, s]));
  const runtimeById = new Map(data.runtimes.map((r) => [r.runtimeVersionId, r]));

  const counts = {
    "bound-candidate": 0,
    "legacy-decision": 0,
    "quarantined-conflict": 0,
    "quarantined-gap": 0,
    "unrecoverable": 0,
    "unbound-insufficient-evidence": 0,
    "already-bound": 0,
    remediated: 0,
    "out-of-scope-draft": 0,
  };
  const entries = [];
  const integrityViolations = [];

  for (const row of data.lessonVersions) {
    const schemaDef = row.schemaDefinitionId !== null ? schemaDefById.get(row.schemaDefinitionId) : undefined;
    const template = schemaDef && schemaDef.templateId !== null ? templateById.get(schemaDef.templateId) : undefined;
    const { classification, reason } = classifyRow(row, template, decisions);
    counts[classification] += 1;

    let runtimeHealth = null;
    if ((row.runtimeBindingStatus === "bound" || row.runtimeBindingStatus === "legacy") && row.runtimeVersionId) {
      const runtime = runtimeById.get(row.runtimeVersionId);
      if (!runtime) {
        runtimeHealth = "missing";
        integrityViolations.push({ lessonVersionId: row.lessonVersionId, runtimeVersionId: row.runtimeVersionId, problem: "referenced runtime row absent from export" });
      } else if (runtime.state !== "published") {
        runtimeHealth = `not-published(${runtime.state})`;
        integrityViolations.push({ lessonVersionId: row.lessonVersionId, runtimeVersionId: row.runtimeVersionId, problem: `referenced runtime state is ${runtime.state}` });
      } else {
        runtimeHealth = "ok";
      }
    }

    entries.push({
      lessonVersionId: row.lessonVersionId,
      lessonId: row.lessonId,
      versionNumber: row.versionNumber,
      classification,
      reason,
      runtimeHealth,
    });
  }

  // Orphan runtimes: published but referenced by no version row.
  const referencedRuntimeIds = new Set(
    data.lessonVersions.filter((v) => v.runtimeVersionId).map((v) => v.runtimeVersionId),
  );
  const orphanRuntimes = data.runtimes.filter((r) => r.state === "published" && !referencedRuntimeIds.has(r.runtimeVersionId));

  // Affected share links: active links whose lesson's current approved version
  // would fail closed (quarantined/unrecoverable binding), fall into review
  // (conflict/gap), or whose lesson/version simply is not in the export.
  const entryById = new Map(entries.map((e) => [e.lessonVersionId, e]));
  const versionsByLesson = new Map();
  for (const row of data.lessonVersions) {
    const list = versionsByLesson.get(row.lessonId) ?? [];
    list.push(row);
    versionsByLesson.set(row.lessonId, list);
  }
  const lessonsById = new Map(data.lessons.map((l) => [l.lessonId, l]));
  const affectedShareLinks = [];
  for (const link of data.shareLinks.filter((l) => l.active)) {
    const lesson = lessonsById.get(link.lessonId);
    if (!lesson) {
      affectedShareLinks.push({ lessonId: link.lessonId, problem: "lesson absent from export" });
      continue;
    }
    if (!lesson.currentApprovedVersionId) {
      affectedShareLinks.push({ lessonId: link.lessonId, problem: "lesson has no current approved version" });
      continue;
    }
    const entry = entryById.get(lesson.currentApprovedVersionId);
    if (!entry) {
      affectedShareLinks.push({ lessonId: link.lessonId, problem: "current approved version absent from export" });
      continue;
    }
    if (entry.classification === "quarantined-conflict" || entry.classification === "quarantined-gap") {
      affectedShareLinks.push({ lessonId: link.lessonId, problem: `playable version is ${entry.classification} (needs review)` });
    } else if (entry.runtimeHealth && entry.runtimeHealth !== "ok") {
      affectedShareLinks.push({ lessonId: link.lessonId, problem: `playable version runtime ${entry.runtimeHealth}` });
    }
  }

  const humanDecisions = entries
    .filter((e) => e.classification === "quarantined-conflict" || e.classification === "quarantined-gap" || (e.classification === "legacy-decision" && e.reason.includes("blank reason")))
    .map((e) => ({ lessonVersionId: e.lessonVersionId, kind: e.classification, reason: e.reason }));
  for (const violation of integrityViolations) {
    humanDecisions.push({ lessonVersionId: violation.lessonVersionId, kind: "integrity-violation", reason: violation.problem });
  }

  const machineActionable = {
    boundCandidates: counts["bound-candidate"],
    legacyDecisions: counts["legacy-decision"],
  };

  return {
    totalVersions: data.lessonVersions.length,
    counts,
    entries,
    integrityViolations,
    runtimes: {
      total: data.runtimes.length,
      published: data.runtimes.filter((r) => r.state === "published").length,
      nonPublished: data.runtimes.filter((r) => r.state !== "published").length,
      orphanPublished: orphanRuntimes.length,
    },
    shareLinks: {
      total: data.shareLinks.length,
      active: data.shareLinks.filter((l) => l.active).length,
      affected: affectedShareLinks.length,
      affectedList: affectedShareLinks,
    },
    machineActionable,
    humanDecisionCount: humanDecisions.length,
    humanDecisions,
  };
}

/** CLI entry point. */
export function runCli(argv, { readFile = readFileSync, stdout = console.log, stderr = console.error } = {}) {
  const exportPath = argv[2];
  if (!exportPath) {
    stderr("usage: node inventory-tool.mjs export.json [--decisions decisions.json]");
    return 2;
  }
  const decisionsPath = argv.includes("--decisions") ? argv[argv.indexOf("--decisions") + 1] : null;
  const raw = readFile(exportPath, "utf8");
  const validation = validateExport(raw);
  if (!validation.ok) {
    stderr(`export validation failed (${validation.errors.length} errors):`);
    for (const error of validation.errors) stderr(`  - ${error}`);
    return 1;
  }
  let decisions = [];
  if (decisionsPath) {
    try {
      decisions = JSON.parse(readFile(decisionsPath, "utf8"));
    } catch (error) {
      stderr(`decisions file unreadable: ${error.message}`);
      return 1;
    }
  }
  stdout(JSON.stringify(classifyExport(validation.data, decisions), null, 2));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(runCli(process.argv));
}
