# Service Reference

This is the equivalent of a Postman collection for this project.

## How to read this document

Fusaha has **no REST API**. Every mutation is a React **Server Action**: an exported
async function marked `"use server"` that the client imports and calls like a normal
function. Next.js serializes the call over an internal RPC channel it manages itself —
there is no stable URL, method, or JSON body to point a HTTP client at.

So each action is documented here the way an endpoint would be:

- **Module / name** — where to import it from
- **Auth** — the guard it runs
- **Input** — the arguments and the zod schema applied
- **Returns** — the success and error shapes
- **Side effects** — writes, audit logs, cache revalidation, external calls

Three genuine HTTP route handlers also exist and are documented in
[§10](#10-http-route-handlers).

### Universal conventions

**Return contract.** Actions return `{ error: string }` for expected failures and
`{ success: true }` (plus extra fields where noted) on success. They do **not** throw.
The `error` value is an already-translated message. Callers narrow with:

```ts
const result = await updateTeacher(id, values);
if ("error" in result) { /* show result.error */ return; }
```

**Authorization guards redirect, they do not return.** `requireTeacher()`,
`requireAdmin()`, and `requirePermission(key)` throw a Next.js redirect. An unauthorized
call never resolves to an `{ error }` value — the caller is sent to `/auth/login` or
`/unauthorized`. Guards are defined in `lib/auth/dal.ts`.

**Validation.** Schemas live in `validation/` and are factory functions taking a
translator, so the same schema validates on both sides with localized messages. On the
server, a parse failure collapses to one generic translated message; field-level detail
is surfaced client-side.

**Reads are not actions.** Data is read inside Server Components via
`lib/dashboard/queries/` and `lib/admin/queries/`. Those are catalogued in
[§11](#11-read-layer).

---

## 1. Authentication — `actions/auth.ts`

Return type: `AuthActionState = { error: string } | null` (`null` means success).

### `signIn(data)`
- **Auth:** none (public)
- **Input:** `{ email, password }`, schema `loginSchema`
- **Behaviour:** Supabase `signInWithPassword`, then loads the `users` ⋈ `roles` profile.
  A missing profile signs the user out and returns `invalidCredentials`. An inactive
  profile signs them out and returns `accountInactive`.
- **On success:** **redirects** to `/admin` when the role is not `teacher`, else `/dashboard`.

### `signUp(data)`
- **Auth:** none (public)
- **Input:** `{ name, email, password }` (min 8), schema `signupSchema`
- **Behaviour:** rejects an existing `users.email` with `emailTaken`; resolves the
  `teacher` role; creates the Supabase user through the **service-role admin client**
  with `email_confirm: true`; inserts the `users` row with `credits_balance: 0` and
  `active: true`; signs in.
- **On success:** redirects to `/dashboard`.

### `requestPasswordReset(data)`
- **Auth:** none · **Input:** `{ email }`, schema `forgotPasswordSchema`
- **Behaviour:** `resetPasswordForEmail` with
  `redirectTo = <origin>/auth/callback?next=/auth/reset-password`.
- **Returns:** always `null` — it never reveals whether the account exists.

### `resetPassword(data)`
- **Auth:** requires a live recovery session, else `resetLinkExpired`
- **Input:** `{ password, confirmPassword }`, schema `updatePasswordSchema` (min 8 + match refine)
- **On success:** redirects by role.

### `signInWithGoogle()`
- **Auth:** none · **Input:** none
- **Behaviour:** `signInWithOAuth({ provider: "google", redirectTo: <origin>/auth/callback })`;
  redirects to the provider, or back to `/auth/login` on failure.

### `signOut()`
- **Auth:** none · Signs out and redirects to `/auth/login`.

---

## 2. Lesson generation — `actions/generation.ts`

### `createLesson(formData)`

The most important action in the system.

- **Auth:** `requireTeacher()`
- **Returns:** `{ error: string } | { success: true, lessonId: string }`
- **Input:** `FormData` (not a plain object — it carries files)

| Field | Type | Notes |
|---|---|---|
| `sourceKind` | `"text-write" \| "text-upload" \| "images"` | required |
| `schemaDefinitionId` | uuid | the chosen level |
| `lessonName` | string | optional; backfilled from generated content if omitted |
| `text` | string | when `sourceKind = "text-write"` |
| `file` | File | when `sourceKind = "text-upload"` — `.pdf` or `.docx` |
| `images[]` | File[] | when `sourceKind = "images"` |

**Limits** (`constants/lesson-source-limits.ts`, enforced on both client and server):
`MAX_TEXT_WORDS = 1000`, `MAX_PDF_PAGES = 2`, `MAX_IMAGES = 2`.

**Flow**

1. Resolve the schema definition. It must exist **and have a `templateId`**, otherwise
   `invalidLevel`.
2. Load the linked template (player HTML, blueprint, validation script).
3. Build the source: text → `SourceType.TextDirect`; file → `extractTextFromFile` →
   `Pdf` or `Docx`; images → base64 data URLs → `Images`.
4. Read the generation cost from `app_settings.generation_cost` (fallback `10`).
5. **In one transaction:**
   - insert the lesson with `state = Generating`
   - `UPDATE users SET credits_balance = credits_balance - cost WHERE id = ? AND credits_balance >= cost`
     — the conditional is the atomic guard; zero rows affected raises
     `InsufficientCreditsError` → `insufficientCredits { cost }`
   - insert a ledger entry `{ delta: -cost, reason: "generation", refId: lessonId }`
   - insert `lesson_versions` #1 with empty content
6. Enqueue the Trigger.dev task `generate-lesson`.

**Compensation:** if enqueueing throws, the lesson flips to `GenerationFailed`, the
credits are refunded, and a compensating ledger entry is written with
`reason: "admin_adjustment"`. Returns `generationFailed`.

**Errors:** `invalidLevel`, `textTooLong`, `pdfTooLong`, `fileTooLong`,
`unsupportedFileType`, `insufficientCredits`, `generationFailed`

**Revalidates:** `/dashboard`, `/dashboard/lessons/{id}`

---

## 3. Lessons — `actions/lessons.ts`

| Action | Auth | Input | Notes |
|---|---|---|---|
| `deleteLesson(id)` | `requireTeacher` | lesson id | **Soft delete.** Owner-scoped; sets `deleted_at = now()`. Revalidates `/dashboard` and the lesson page. |
| `hardDeleteLesson(id)` | `lessons.delete` | lesson id | Permanent; versions and share links cascade. Audit-logged with `oldValues`. Revalidates `/admin/lessons`. |
| `restoreLesson(id)` | `lessons.restore` | lesson id | Clears `deleted_at`. Errors: `notFound`, `notDeleted`. Audit-logged. |
| `createShareLink(lessonId)` | `requireTeacher` | lesson id | Lesson must be **Approved** (`notApproved`). Token = `randomBytes(24).toString("base64url")`. |
| `setShareLinkActive(lessonId, active)` | `requireTeacher` | id, boolean | Toggles an existing link (`shareLinkNotFound`). The token is reused, so deactivated URLs come back to life when re-enabled. |
| `moveLessonToFolder(lessonId, folderId \| null)` | `requireTeacher` | ids | Both lesson and folder must belong to the teacher (`folderNotFound`). `null` unfiles. |
| `approveLesson(lessonId)` | `requireTeacher` | lesson id | Approves the highest `version_number`. Transaction sets the version to `Approved` + `approved_at`, and the lesson to `Approved` + `current_approved_version_id`. Errors: `noDraftVersion`, `alreadyApproved`. |
| `restoreLessonVersion(lessonId, versionId)` | `requireTeacher` | ids | Copies that version's content into a **new** draft at `max + 1` and sets the lesson back to `Draft`. History is never rewritten. Error: `versionNotFound`. |
| `updateLessonVersionContent(lessonId, versionId, content)` | `requireTeacher` | ids + content | Returns `{ success: true, html }` — the recomposed player HTML for the live preview. Only permitted when the version is `Draft` **and** is the latest (`cannotEditApprovedVersion`). ⚠️ `content` is typed `unknown` and is **not validated** before being written to `jsonb`. |

---

## 4. Folders — `actions/folders.ts`

All three require `requireTeacher()` and are owner-scoped. Schema: `createFolderSchema`
(`{ name: min 1 }`). None are audit-logged.

| Action | Notes |
|---|---|
| `createFolder({ name })` | Inserts with `ownerId` = current teacher. |
| `updateFolder(id, { name })` | Error: `notFound`. Also revalidates `/dashboard/folders/{id}`. |
| `deleteFolder(id)` | Lessons survive — `lessons.folder_id` is `SET NULL`. |

Revalidates `/dashboard/folders` and `/dashboard`.

---

## 5. Teachers — `actions/teachers.ts`

### `updateTeacher(id, data)`
- **Auth:** `requirePermission("users.update")`
- **Input:** `{ name, creditsBalance: int ≥ 0, active: boolean }`, schema `updateTeacherSchema`
- ⚠️ **Credits are overwritten directly with no ledger entry**, so an admin adjustment
  made here does not appear in the teacher's credit history.
- Audit-logged (`resourceType: "teacher"`). Revalidates `/admin`, `/admin/teachers`.

### `deleteTeacher(id)`
- **Auth:** `requirePermission("users.delete")`
- Refuses self-deletion (`cannotDeleteSelf`). Best-effort Supabase
  `auth.admin.deleteUser`, then the database row (cascading folders, lessons, ledger,
  purchases). Audit-logged.
- ⚠️ **No role check** — this can delete an admin or employee by id.

---

## 6. Employees and roles

### `actions/employees.ts`
`NON_EMPLOYEE_ROLES = ["teacher", "admin"]` is enforced on both the assigned role and
the target user, so system-role users can never be managed here.

| Action | Permission | Input | Errors |
|---|---|---|---|
| `createEmployee(data)` | `employees.create` | `{ name, email, password ≥ 8, roleId }` | `invalidRole`, `emailTaken`, `createUserFailed` |
| `updateEmployee(id, data)` | `employees.update` | `{ name, roleId, active }` | `invalidRole`, `notFound` |
| `deleteEmployee(id)` | `employees.delete` | id | `cannotDeleteSelf` |

All audit-logged; revalidate `/admin` and `/admin/employees`.

### `actions/roles.ts`
Schema `roleSchema`: `{ name: /^[a-z0-9-]+$/, title, permissionKeys: string[] }`.

| Action | Permission | Notes |
|---|---|---|
| `createRole(data)` | `roles.create` | Unique name (`nameTaken`); `isSystem: false`; grants synced in a transaction (delete all, re-insert matched keys). |
| `updateRole(id, data)` | `roles.update` | Blocked for system roles (`cannotEditSystem`). Captures the previous permission set for the audit diff. |
| `deleteRole(id)` | `roles.delete` | Blocked for system roles (`cannotDeleteSystem`). Grants cascade. ⚠️ Does not check for assigned users — the `users.role_id` FK is `no action`, so a role in use fails with a raw constraint error. |

---

## 7. Credit packages — `actions/credit-packages.ts`

Schemas in `validation/credit-packages.ts`:

- `name` — **required in every locale**
- `creditsAmount` — positive integer (coerced)
- `price` — number ≥ 0 **in major units**; the action stores `Math.round(price * 100)` as cents
- `paddlePriceId` — optional, must start with `pri_`
- `badgeLabel`, `subtitle`, `footerText` — optional but **all-or-nothing across locales**
- `features` — array of per-locale rows; blank rows are dropped, partially filled rows error
- `colorDark` — optional `#rgb` or `#rrggbb`
- update adds `active: boolean`

| Action | Permission | Notes |
|---|---|---|
| `createCreditPackage(data)` | `credit-packages.create` | Inserts with `active: true`. |
| `updateCreditPackage(id, data)` | `credit-packages.update` | `notFound`; audit records a full old/new snapshot. |
| `deleteCreditPackage(id)` | `credit-packages.delete` | Hard delete. ⚠️ `purchases.package_id` is `no action`, so deleting a purchased package fails at the database level. |

---

## 8. Levels and templates

### `actions/schema-definitions.ts`
A "level" is a `schema_definition`: a stable `levelKey`, a localized display name, a
version string, and the AI system prompt (`content`), linked to a template.

**`createSchemaDefinition(data, existingLevelKey?)`** — `schema.create`
- Input: `{ level: one non-empty string per locale, version: /^\d+(\.\d+)*$/, content, templateId, active }`
- Pass `existingLevelKey` to add a **new version to an existing level**; omit it to mint
  a new `levelKey` via `generateLevelKey()` (`level-<8 hex>`, retried on collision).
- If a row already exists at `(levelKey, version)`: an **inactive** one errors with
  `versionExists`; an **active** one is updated in place.
- When `active: true`, a transaction deactivates every other version of that level first
  — **only one version per level can be active.**
- Audit `resourceId` is `"<levelKey>/<version>"`; `newValues` records `contentLength`,
  not the prompt itself.

**`deleteSchemaDefinition(id)`** — `schema.delete`
- Blocked when any `lesson_versions` row references it (`schemaInUse`), pre-empting the
  `RESTRICT` foreign key with a friendly message.

### `actions/templates.ts`

**`bundleTemplateZipAction(formData)`** — `templates.create`
- Input: `FormData` with a `zip` field.
- Returns `{ success: true, html, blueprint, validationScript, report }` or
  `{ error }` where the error is one of `invalidZip`, `tooManyFiles`, `noHtmlFile`,
  `multipleHtmlFiles`, `noBlueprintFile`, `noValidationFile`.
- Flattens the ZIP into one self-contained HTML document. **No database write.**
  See [ai-pipeline.md §4](./ai-pipeline.md) for the bundling rules.

| Action | Permission | Notes |
|---|---|---|
| `createTemplate(data)` | `templates.create` | `{ name, htmlPlayer, blueprint, validationScript, previewImage?, active }` |
| `updateTemplate(id, data)` | `templates.update` | Same schema; sets `updated_at`. Error: `notFound`. |
| `deleteTemplate(id)` | `templates.delete` | Blocked when a schema definition references it (`templateInUse`). |

> These payloads carry inlined HTML plus a base64 preview image, which is why
> `next.config.ts` raises `experimental.serverActions.bodySizeLimit` to `10mb`.

---

## 9. Settings, profile, purchases, locale

### `actions/settings.ts` — all require `requirePermission("settings.update")`

| Action | Input | Writes |
|---|---|---|
| `updateDeepSeekApiKey({ apiKey })` | min 10 chars | AES-256-GCM encrypted into `system_settings.deepseek_api_key`. The audit log records the **key name only, never the value**. |
| `updateGenerationCost({ cost })` | positive int (coerced) | `app_settings.generation_cost` |
| `updatePaymentSettings({ autoPaymentEnabled, whatsappContactNumber })` | refine: when auto-payment is off, the number must match `^\+?[0-9]{8,15}$` | both `app_settings` keys; revalidates `/admin/settings` **and** `/dashboard/credits` |

### `actions/profile.ts`
`updateProfileName` / `updateProfilePassword` (`requireAdmin`) and
`updateTeacherProfileName` / `updateTeacherProfilePassword` (`requireTeacher`).
Passwords go through Supabase `updateUser`. Name changes revalidate the shell so the
header updates; password changes revalidate nothing.

### `actions/purchases.ts`

**`createCheckoutSession(packageId)`** → `{ transactionId } | { error }`
- **Auth:** `requireTeacher()`
- The package must exist, be `active` (`packageNotFound`), and have a `paddlePriceId`
  (`checkoutFailed`).
- Gets or creates the Paddle customer, persisting `users.paddle_customer_id`.
- Inserts a `purchases` row with `status: "pending"` and
  `paddle_transaction_id: "pending"`, creates the Paddle draft transaction with
  `customData { purchaseId, userId, packageId }`, then patches the real transaction id in.
- Any Paddle failure marks the purchase `failed` and returns `checkoutFailed` — it never
  throws, so the user never sees the Next.js error screen.
- The checkout overlay itself is opened client-side by Paddle.js.

### `actions/locale.ts`

**`setLocale(locale)`** — sets the `locale` cookie (`path: "/"`, 1 year).
⚠️ No authentication and no validation of the value against the locale list.

---

## 10. HTTP route handlers

These are the only real HTTP endpoints in the system.

### `POST /api/webhooks/paddle`
**Public — no session.** `app/api/webhooks/paddle/route.ts`

| Condition | Response |
|---|---|
| `PADDLE_WEBHOOK_SECRET` unset | `500 { error: "Webhook not configured" }` |
| Missing `paddle-signature` header | `400 { error: "Missing signature" }` |
| Signature verification fails | `400 { error: "Invalid signature" }` |
| Anything else (handled or not) | `200 { received: true }` |

The body is read as raw text and verified with `paddle.webhooks.unmarshal`.

**`TransactionCompleted`** → reads `customData.purchaseId`, then in one transaction:
updates the purchase to `completed` + `completed_at` + `paddle_payment_method`
**guarded by `status <> 'completed'`** (idempotency, while still allowing a credit after
an earlier attempt was marked failed), inserts a ledger entry with `reason: "purchase"`,
and increments `users.credits_balance`.

**`TransactionPaymentFailed`** → sets `status: "failed"` where currently `pending`.

> The webhook does **not** revalidate any cache. The credits page picks the change up on
> its next render, which is why `PurchaseBalancePoller` exists on the client.

### `GET /auth/callback`
`app/auth/callback/route.ts` · Query: `code`, optional `next`.

Exchanges the OAuth/recovery code for a session.
- `next === "/auth/reset-password"` short-circuits straight there, skipping the
  active/role checks (the recovery session must survive).
- Otherwise loads the profile, and **self-provisions a `users` row as a `teacher`** if
  the Supabase user has none — this is how first-time Google sign-in works. The name
  comes from `user_metadata.full_name ?? email`.
- Active → `/admin` for role `admin`, else `/dashboard`.
- Inactive → sign out → `/auth/login?error=account_inactive`.
- No code or exchange failure → `/auth/login?error=account_not_found`.

`resolveRedirectOrigin` trusts the `x-forwarded-host` header **only** when it matches the
host in `NEXT_PUBLIC_SITE_URL` — an open-redirect guard. In development it always uses
the request origin.

### `GET /dashboard/lessons/[id]/run/frame`
Serves the composed player HTML for the teacher's fullscreen iframe.

Uses `getCurrentUser()` rather than `requireTeacher()` **on purpose**: a redirect would
render the login page inside the iframe, so it returns a bare **401** instead. A missing
or unapproved lesson returns **404**. Success returns `text/html; charset=utf-8`.

### `GET /l/[token]/frame`
**Fully public.** Resolves the share token to an active link on a non-deleted, approved
lesson and returns the player HTML, or **404**. The token is the only credential.

---

## 11. Read layer

Reads are plain async functions called from Server Components. All are `server-only`.

### `lib/dashboard/queries/` — teacher side

| Function | Notes |
|---|---|
| `getTeacherLessons(ownerId, folderId?)` | `undefined` = all, `null` = unfiled, string = that folder. Fetches lessons, then all versions in one `IN` query, picking the latest per lesson in JS. |
| `getLessonsInOtherFolders(ownerId, excludeFolderId)` | Powers the folder's lesson picker. |
| `getLessonDetail(ownerId, lessonId)` | Versions descending + share link. |
| `getApprovedLessonForPlay(ownerId, lessonId)` | For the teacher's player frame. |
| `getApprovedLessonByShareToken(token)` | For `/l/[token]`. **The token is the only authorization.** |
| `getTeacherFolders(ownerId)` | With non-deleted lesson counts. |
| `getFolderById(ownerId, id)` | |
| `getActiveShareLinkCount(ownerId)`, `getSharedLessons(ownerId)` | |
| `getVersionHistory(ownerId, limit = 50)` | Cross-lesson feed. |
| `getCreditsLedger(userId)` | Newest 100. |
| `getActiveCreditPackages()` | Resolves localized `jsonb` to the request locale; ordered by `creditsAmount`. |

### `lib/admin/queries/` — staff side

`getTeachers` · `getEmployees` / `getAssignableRoles` (both exclude `teacher` and
`admin`) · `getRoles` (non-system only) / `getAllPermissions` · `getAdminLessons`
(**includes soft-deleted**) / `getAdminLessonById` (with `versionCount`) ·
`getCreditPackages` (raw localized `jsonb` for the admin form) · `getSchemaDefinitions` /
`getSchemaDefinitionById` / `getActiveSchemaDefinition(levelKey)` /
`getActiveSchemaDefinitions` (powers the create-lesson level picker) · `getTemplates` /
`getTemplateById` / `getActiveTemplates` · `getAuditLogs` (200 max) ·
`getGenerationEvents` (200 max) · `getGenerationCostSetting` / `getPaymentSettings` /
`getDeepSeekApiKeyStatus` (**returns a masked key only**).

---

## 12. Permission keys

31 keys, defined in `database/seeder/permissions.mjs` and re-exported with types by
`constants/permissions.ts`.

| Group | Keys |
|---|---|
| `users` | `list`, `create`, `update`, `delete` |
| `employees` | `list`, `create`, `update`, `delete` |
| `roles` | `list`, `create`, `update`, `delete` |
| `lessons` | `list`, `restore`, `delete` |
| `credit-packages` | `list`, `create`, `update`, `delete` |
| `templates` | `list`, `create`, `update`, `delete` |
| `schema` | `list`, `create`, `delete` |
| `audit-logs` | `list` |
| `generation-events` | `list` |
| `settings` | `list`, `update` |

Adding a permission means adding the key to `permissions.mjs` and re-seeding. Re-seeding
also **removes** keys deleted from that file, cascading to `role_permissions`.
