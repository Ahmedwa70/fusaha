# AI Lesson Engine Platform — PRD / SRS

Status: Draft v1
Source: translated & structured from `../PRD.md` (client-provided requirements report, Arabic)
Audience: engineering (this doc is the entry point for any new working session on `app/`)

---

## 0. How to use this document

This is the single source of truth for what we are building in `app/` (the Next.js project). Read section 1–9 for product requirements, section 10 for the data model, section 11 for the phased build plan, and section 12 for open decisions that still need a call before/while building that phase.

When starting a new session: read section 11 (Phased Roadmap) first, find the current phase, check `docs/PROGRESS.md` (create/update it as work lands) for what's already done in that phase, and continue from there.

Do **not** re-litigate the product decisions in sections 1–9 without the client — they come directly from the client's requirements report. Open technical/implementation decisions live only in section 12.

---

## 1. Product Overview

### 1.1 What this is replacing

The client already has a working manual system (`lesson v0.6_Arabic1/` in the repo root): a static HTML/CSS/JS lesson player with ~21 interactive activity types, driven by a `lesson.js` data file that conforms to a detailed `LESSON_SCHEMA.md`. Today, producing a new lesson means:

```
lesson source image + LESSON_SCHEMA.md + lesson.js template
  → paste into an external AI tool
  → AI generates a new lesson.js
  → manually replace the old lesson.js
  → open the HTML file to run the lesson
```

This requires the teacher to handle files, JSON/JS, and know the project structure. It does not scale past one technical person operating it.

### 1.2 What we are building

A SaaS platform where a non-technical teacher (primarily teachers of Arabic as a foreign language) never touches code or files:

```
teacher account → upload lesson source → pick level → AI generates the lesson
  → draft appears → teacher reviews & edits content → approve
  → lesson is ready to run inside the platform (fullscreen, in-classroom)
```

The complexity (schema, AI pipeline, internal QA/correction, tokens, APIs, versioning) stays entirely behind the system. The teacher only ever deals with: **source → level → generate → review → approve → run**.

### 1.3 Guiding principle

> The teacher sees a simple educational platform. All real complexity stays inside the system.

Every feature decision below should be evaluated against this: does it add something the teacher must understand, or does it stay invisible?

### 1.4 Relationship to the existing lesson engine

`lesson v0.6_Arabic1/` (the activity player, `bridge.js`, `LESSON_SCHEMA.md`, `validate_lesson.js`/`sanitize_lesson.js`) is the **lesson engine** and must be preserved and reused, not reinvented. The new platform is the product wrapper around it: accounts, AI generation, drafts, versioning, credits, sharing, admin. The AI's job is to produce data that conforms to this existing schema; the activity system's structure (which activity types exist, how they render) is not something the AI or the teacher can change.

Two earlier prototypes exist in the repo (`worker/` — a Cloudflare Worker AI pipeline, and `public/` — a stateless lesson viewer) but they target a **different schema and different, English-language exercise types**. They are not wired to `lesson v0.6_Arabic1` and are not being continued as-is. They are useful only as design reference (see 12.2).

---

## 2. Users & Roles

| Role | Description |
|---|---|
| **Teacher** | Primary user. Creates, reviews, approves, organizes, runs, and shares lessons. Owns credits balance. Cannot touch levels/schema/activity structure. |
| **Admin** | Manages the platform: users, level/schema definitions, activity registry, credit packages, payments oversight, backups/restores, system monitoring. Not tied to any single teacher's lessons unless accessed for support. |
| **Shared-link viewer** | Anonymous. Opens a lesson via a share link, can run it, cannot edit it or access the teacher's account. |
| *(future)* Super Admin / Editor-Content-Manager | Role granularity mentioned as a future need; design the admin permission model so new roles can be added without restructuring (simple role/permission table, not hardcoded checks). |

---

## 3. Localization

- **Platform UI languages (v1):** Arabic, Chinese. Architecture must support adding more UI languages later (i.e., don't hardcode strings; use a standard i18n library/message catalog from day one even with just 2 locales).
- **AI internal instructions:** English (prompts, schema, system messages).
- **Generated lesson content:** Modern Standard Arabic or Chinese, depending on the lesson source/target language selected.

---

## 4. Learner Levels

Level selection is **mandatory** before generation starts. Three fixed levels, each with a system-wide, admin-only-editable definition:

| Level | Learner profile |
|---|---|
| **1 — Beginner** | Knows very little of the language. Limited reading of letters/words. Cannot really speak yet. |
| **2 — Intermediate** | Basic speaking. Can give a little self-introduction. Can write. Better comprehension/usage overall. |
| **3 — Advanced (of this curriculum, not fluent)** | Can hold a simple dialogue. Understands clear, straightforward conversation. Gets the general meaning even without every detail. Cannot yet discuss varied topics or hold an advanced discussion. |

The level applies uniformly to **every** lesson component: vocabulary, sentences, dialogues, questions, answers, exercises, activities, instructions, and any other educational content.

**Only Admin can edit level definitions and the Schema.** These are the rules the generation system operates under; teachers select a level but never redefine what it means.

---

## 5. Lesson Creation

### 5.1 Entry point
"Create New Lesson" inside the teacher dashboard.

### 5.2 Sources — exactly one of two paths per creation

**A. Images**
- 1 or 2 images max (hard limit — no more than 2 per generation).
- Upload from device.
- Manual reordering (drag to sequence) before generation.
- Future: capture directly from phone camera.

**B. Text**
- One of: type directly, paste text, upload PDF, upload DOCX.
- **PDF and DOCX cannot both be used in the same creation.**

Images and text are mutually exclusive per creation — a lesson is generated from either images or text, not both.

### 5.3 Source limits (hard limits, block generation if exceeded — never silently truncate)

| Source | Limit |
|---|---|
| PDF | 2 pages max. Over the limit → block generation with a clear message. Never auto-take the first 2 pages. |
| DOCX | Same: 2 pages max, same blocking behavior. |
| Direct/pasted text | Roughly equivalent to 2 pages of content. |
| Images | 2 images max. |

### 5.4 Lesson naming
After analyzing the source, the AI proposes a name (e.g. "At the Restaurant"). The teacher can edit it before approval. Names are **not required to be unique** — a teacher can have two lessons with the same name.

---

## 6. AI Generation Behavior

These are hard behavioral rules for the generation pipeline, not suggestions:

1. **Extraction scope**: pull everything extractable from the source — vocabulary, sentences, dialogues, questions, answers, exercises, activities, teaching info, clearly-inferable learning objectives, and any other lesson components present.
2. **Preserve original content**: do not rewrite from scratch without cause. Keep most of the original content; only adjust what's necessary to fit the selected level. If something is too hard for the level, the AI may adapt it but must preserve meaning, purpose, and original idea as much as possible.
3. **Limited enrichment only**: the AI may add a vocabulary item, sentence, question, answer, or example — but only if needed to make the lesson complete, pedagogically sound, or template-conformant, and only within the selected level. It must never invent content unrelated to the source topic.
4. **Objective inference**: only when objectives are directly and clearly inferable from the content (e.g. a self-introduction lesson → "state name/nationality/occupation"). Never infer distant objectives (e.g. "discuss cultural identity" from a self-introduction lesson).
5. **Unclear source content**: if a word/section in an image is unclear, the AI first tries context-based inference. If confident, it uses the inference. If not confident, it flags the element for teacher review instead of presenting a guess as fact.
6. **No unsolicited error correction**: the AI does not "fix" the original content just because it looks wrong to the AI. The teacher owns correction decisions — errors in the source are left for the teacher to fix during review. The AI is only allowed to transform content as required by level rules and lesson structure.

### 6.1 Schema contract
The Schema (`LESSON_SCHEMA.md`) is the contract between the AI and the lesson engine: internally in English, defines lesson structure, components, constraints, level requirements, and required data shape. The AI must follow it exactly. Admin-editable only (future).

### 6.2 Lesson structure
Every lesson uses the same sections and base ordering — the AI fills a fixed template, it never invents new structure per lesson.

### 6.3 Activities
The set of activity types is currently fixed platform-wide (same set for every lesson — see the 21 types in `lesson v0.6_Arabic1/activities/`). The AI selects and fills appropriate content into these existing activities per lesson/level. "Teacher can edit everything" means **activity content** (question, answer, options, text, vocabulary, sentences) — never the activity system's structure. During review, the teacher cannot: add a new activity type, remove an activity type from the system, or change an activity's code/behavioral structure. The system must be designed so developers can add new activity types in the future without a rewrite (i.e. activity registry pattern, not hardcoded switch statements).

---

## 7. Automated QA & Internal Correction

After generation, the system automatically checks the output.

- If a violation is found, the system attempts to correct **each violating part once, independently**.
- Success → use the corrected version.
- Failure → do not retry that same element again.
- The system must never bombard the teacher with technical/failure messages. Instead, it quietly flags the specific part that needs visual review during the review step.
- The teacher must never feel the system "crashed" or hit a major technical problem — failures degrade gracefully into "please double check this part," not error dialogs.

---

## 8. Review, Draft & Autosave

After generation, the teacher sees the lesson **draft**. This is the most important step before approval. The teacher has full freedom to edit: lesson name, vocabulary, dialogues, sentences, questions, answers, options, activity content, any other educational data.

- **Autosave**: edits save automatically. If the teacher closes the page and returns, the draft is exactly as they left it.
- No draft-edit history/versioning is needed at this stage (only approved-version history matters — see §14).

---

## 9. Credits System

### 9.1 Generation cost
Every lesson creation costs a flat **10 credits**, regardless of lesson size, vocab count, dialogue count, activity count, or question count.

### 9.2 Deduction timing
10 credits are deducted **the instant generation starts** — even if generation fails, errors out, the teacher closes the browser, or the process has to be retried.

### 9.3 Browser closed during generation
The teacher must stay on the generation page and not close the browser until it completes.
- If the browser closes mid-generation: the current generation is **not** resumed. Returning starts a fresh generation, and a **new** 10 credits are deducted.
- Worked example: 20 credits → start generation → 10 credits → browser closed → return → start again → 0 credits.

### 9.4 Internal correction cost
Every 3 small internal corrections (see §7) = 1 credit. Nothing is charged until a full group of 3 completes; remainders carry over to the next generation.

```
1 correction = 0 charged
2 corrections = 0 charged
3 corrections = 1 credit
4 corrections = 1 credit
...
6 corrections = 2 credits

Example across two generations:
Generation 1: 4 corrections → 1 credit charged, 1 unit carried over internally
Generation 2: 2 corrections → 1(carried) + 2 = 3 → 1 credit charged, 0 carried over
```

These internals are **hidden from the teacher**. The teacher only ever sees their credits balance — never correction units, correction counts, correction cost, or internal AI operations.

### 9.5 Insufficient credits for corrections
If the teacher doesn't have enough credits to cover all pending internal corrections:
1. The 10 lesson-creation credits are still deducted.
2. The system runs as many corrections as the remaining balance covers.
3. Remaining flagged elements are left uncorrected.
4. Those elements surface to the teacher for review (quiet, visual flag — not an error).
5. The lesson generation is **never halted** because of this.

### 9.6 Purchasing credits
Teacher can buy credits in-platform. Packages are admin-configurable (examples: +10, +25, +50, +100; admin can add more later, e.g. +200).

**Payment methods (from launch):** WeChat Pay, Alipay, Visa/Mastercard.
On successful payment, credits are added automatically — no manual admin top-up needed for the normal path.

### 9.7 Admin credits controls
Admin can: create/edit/disable-or-delete packages, change price, change credit amount, view purchase history, view balance/ledger history, manually add/deduct credits when necessary, resolve balance issues. Deleting a package stops it from being offered for new purchases but does not affect credits teachers already own.

---

## 10. Teacher Dashboard

At minimum: My Lessons, Create New Lesson, Approved Lessons, Drafts, Search Lessons, Open Lesson, Edit Lesson, Run Lesson, Folders/Categories, Credits Balance, Buy Credits, Lesson/Version History, Shared Lessons. Designed to be extended later.

### 10.1 Organization
Teachers can create folders/categories to organize lessons, e.g.:
```
📁 Level 1
├── Self-Introduction
├── Family
└── University
📁 Level 2
├── Travel
└── Restaurant
```

### 10.2 Search
v1: text search on lesson name, with filters for level and lesson status. Full content search is out of scope for v1.

### 10.3 Lesson states
`Draft` · `Generating` · `Generation Failed` · `Approved`. If generation fails completely, the lesson appears in Drafts with state "Generation Failed" and a **Retry** action — retrying deducts a fresh 10 credits.

---

## 11. Approval & Versioning

### 11.1 Approving a draft
When the teacher finishes reviewing and clicks **Approve**:
- The new version becomes the approved version.
- It becomes runnable.
- It's saved to the teacher's account as the lesson's current version.

### 11.2 Editing an already-approved lesson
Opening an approved lesson to edit it **never** mutates the approved version directly:
```
Approved version → edit → new draft → autosave → review → approve → becomes the new current version
```
The old approved version is preserved in version history. This guarantees the version currently in use is never put at risk mid-edit.

### 11.3 Version history
A lesson is always **one item** in lists, showing the latest approved version by default. Inside the lesson's page, the teacher can reach previous versions and: view, run, see its date and level, and **restore** it.

**Restoring** never edits the old version in place — it creates a new draft copied from it, which the teacher can then edit and approve like any other draft.

---

## 12. Running & Audio

- Once approved, a lesson runs directly inside the platform via **Run Lesson**, opening in **fullscreen**, designed for the classroom's large display.
- No file downloads, no manual HTML, no VS Code, no manual `lesson.js` swapping — ever.
- **Audio (v1)**: Web Speech API, same as the current system. A dedicated audio system may be built later if needed.

---

## 13. Sharing

- The owning teacher can generate a **share link** for a lesson at any time.
- Anyone with the link can open and run it. They need no account, cannot edit, and cannot reach the owner's account.
- The link is tied to the **lesson**, not a specific version: `share link → latest approved version`, always — approving a new version updates what the same link shows, no new link needed.
- **Privacy**: accessible to anyone with the link, but the lesson is not indexed by search engines, has no public browse page, and has no in-platform discovery mechanism. The link itself is the only access path.
- **Revoking**: the owning teacher can disable the share link at any time; the link stops working immediately once disabled.

---

## 14. Deletion & Backup

- Teacher-initiated delete removes the lesson from their account immediately. **The teacher cannot undo this.**
- The system internally retains a backup. **Only Admin** can restore a deleted lesson from backup.

---

## 15. Admin

A separate admin account system (not a teacher role flag). V1 can be a single Admin role; the permission model should support adding Super Admin / Admin / Editor-Content-Manager later without restructuring.

**Capabilities:**
- **Users**: create/manage teacher accounts, activate/deactivate, manage permissions.
- **Lessons**: view when needed, access per permissions, restore deleted lessons from backup.
- **System**: edit system settings, edit level definitions, edit Schema, manage the activity registry, manage credit packages, manage credit settings.
- **Oversight**: monitor generation operations, monitor credits consumption, monitor purchases, review logs.

---

## 16. Non-Functional Requirements

- **No technical exposure to teachers**: no Schema, AI pipeline internals, JSON, correction internals, tokens, API details, webhooks, or processing internals ever surface in teacher-facing UI or messaging.
- **Graceful degradation**: generation/QA failures must read as "needs a quick look," never as system errors (see §7).
- **Data integrity under concurrent edit**: editing an approved lesson must never risk the version currently in classroom use (see §11.2).
- **Auditability**: credits ledger and version history must be reconstructable/inspectable (for admin support and dispute resolution), even though hidden from teachers.
- **i18n-ready architecture**: UI strings externalized from day one, even for the 2 initial locales.

---

## 17. Data Model (initial sketch)

Entities — refine per phase, not a final schema:

- **User** (role: teacher | admin, locale, credits_balance)
- **Lesson** (owner_id, name, current_approved_version_id, state, folder_id, created_at)
- **LessonVersion** (lesson_id, version_number, status: draft|approved, level, schema_version, content JSON, source_type, created_at, approved_at)
- **Draft** — modeled as a `LessonVersion` with `status = draft`; autosave writes update it in place until approved.
- **Folder** (owner_id, name, parent_id nullable)
- **ShareLink** (lesson_id, token, active boolean, created_at)
- **CreditsLedgerEntry** (user_id, delta, reason: generation|correction|purchase|admin_adjustment, ref_id, created_at)
- **CreditPackage** (name, credits_amount, price, currency, active boolean)
- **Purchase** (user_id, package_id, amount, provider: wechat|alipay|card, status, created_at)
- **GenerationJob** (lesson_version_id, status, source_refs, attempts, correction_units_carried, started_at, finished_at)
- **LevelDefinition** (level_number, definition JSON) — admin-editable
- **SchemaDefinition** (version, content) — admin-editable, versioned so old LessonVersions stay interpretable
- **ActivityType** (key, display metadata, active boolean) — registry, not hardcoded

---

## 18. Phased Roadmap

Each phase should be independently demoable and merges into `app/` without breaking the previous phase. No hard deadline — phases proceed in this dependency order.

### Phase 1 — Foundation
- Next.js app scaffolding decisions locked in (see §19 open decisions: DB/ORM, auth, hosting, file storage).
- DB schema + migrations for core entities (§17).
- Auth: teacher signup/login, admin login (separate).
- Integrate the existing lesson engine (`lesson v0.6_Arabic1`) as a renderable component/route in the new app (establish the embedding approach — see §19.5) — prove one hand-authored lesson JSON renders correctly end-to-end inside `app/`.
- Basic teacher dashboard shell (empty states for the nav items in §10).

**Exit criteria:** a logged-in teacher can see an empty dashboard, and a manually-inserted lesson record renders correctly via Run Lesson.

### Phase 2 — Core Generation Loop (MVP)
- "Create New Lesson" flow: source upload (start with text only, then add images/PDF/DOCX), level selection, source limits enforced (§5.3).
- AI pipeline v1: single provider, prompts built from `LESSON_SCHEMA.md`, generation rules from §6.
- Draft view (read/edit basic fields), no autosave polish yet, no automated QA/correction loop yet.
- Flat credits deduction on generation start (10 credits, no purchasing yet — seed accounts with balance).

**Exit criteria:** a teacher can upload a source, pick a level, generate a lesson, see a draft, and run it.

### Phase 3 — Review, Autosave, Automated QA
- Full review/edit UI covering every editable field in §8.
- Autosave with reliable resume-on-return.
- Automated QA + one-shot internal correction pipeline (§7), including the "flag for review" UX for unresolved items.
- Lesson naming suggestion + rename.

**Exit criteria:** the full generate → draft → autosave → review → (quietly flagged items) loop works without technical error messages ever reaching the teacher.

### Phase 4 — Lesson Library & Versioning
- Approve flow (§11.1), lesson states (§10.3), retry-on-failure.
- Folders/categories (§10.1), search + filters (§10.2).
- Version history: edit-approved-creates-new-draft, view/run/restore old versions (§11.2–11.3).

**Exit criteria:** teacher can manage a real library of lessons across states, edit an approved lesson safely, and restore an old version.

### Phase 5 — Credits & Payments
- Real credits ledger wired to generation (§9.1–9.5), including the 3-corrections-per-credit batching and the insufficient-balance degrade path.
- Credit packages + purchase flow.
- Payment integration: WeChat Pay, Alipay, Visa/Mastercard (§9.6) — see §19.3 for provider/PSP decision.

**Exit criteria:** a teacher can run out of credits, buy more through a real payment flow, and see their balance update correctly.

### Phase 6 — Sharing & Runner Polish
- Share link generation/revocation (§13), anonymous run flow, privacy behavior (no indexing/discovery).
- Fullscreen classroom runner polish (§12), Web Speech API audio parity with the current system.

**Exit criteria:** a lesson can be shared and run by someone with no account, and revoked on demand.

### Phase 7 — Admin Panel
- Admin auth + role/permission model (§15, designed for future role expansion).
- User management, level/Schema editors, activity registry management, credit package management, purchase/credits oversight, deleted-lesson restore from backup.

**Exit criteria:** Admin can run the platform end-to-end without direct DB access.

### Phase 8 — Hardening & Extensibility
- i18n pass for both locales (Arabic, Chinese UI) end-to-end.
- Activity registry proven extensible (add one new activity type as a test without touching core code).
- Load/perf pass on the AI pipeline (timeouts, retries, provider fallback — informed by `worker/`'s design, see §19.2).
- Security review (upload handling, share-link enumeration resistance, admin permission boundaries).

---

## 19. Open Decisions

These need an explicit call — flagged here instead of assumed, since they materially change Phase 1–2 work:

1. **ORM/DB driver** for Postgres (e.g. Prisma vs Drizzle) — not yet chosen.
2. **AI pipeline architecture**: reuse `worker/`'s design patterns (multi-provider abstraction, layered validation, versioning, retry/timeout handling) as reference, rebuilt against `LESSON_SCHEMA.md` instead of `worker/schemas/lesson-schema.json`. Confirm whether the pipeline runs in-process (Next.js server) or as a separate service (e.g. still a Worker) — affects Phase 2 setup.
3. **Payment provider integration**: WeChat Pay / Alipay integration in particular usually goes through a PSP or requires a China-side merchant account — needs a concrete provider decision before Phase 5, likely needs client input (do they already have a merchant/PSP relationship?).
4. **Auth provider**: build custom vs. NextAuth/Auth.js vs. a hosted provider (Clerk etc.) — affects Phase 1.
5. **File storage** for uploaded images/PDF/DOCX (S3-compatible, Vercel Blob, etc.).
6. **Lesson engine embedding approach**: how `lesson v0.6_Arabic1`'s HTML/CSS/JS player is served from the new Next.js app — iframe embedding the existing static engine as-is (fastest, keeps the engine untouched) vs. porting it into a React component tree (more invasive, more maintainable long-term). Recommendation: start with iframe embedding in Phase 1 to honor "preserve the lesson engine, don't reinvent it," revisit only if it becomes a real constraint.
7. **Hosting target** (Vercel vs other) — affects file storage and background-job options for the AI pipeline.

---

## 20. Traceability

This document restructures and translates the client's original requirements report at `../PRD.md` (Arabic, 43 numbered points). Every functional requirement here maps to a specific point there; when in doubt about intent, that source document is authoritative for *what*, this document is authoritative for *how it's organized into buildable phases*.
