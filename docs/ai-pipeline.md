# AI Pipeline and Integrations

## 1. Lesson generation, end to end

```
 Teacher                Server Action           Trigger.dev task            DeepSeek
    │                         │                        │                       │
    │ wizard (source+level)   │                        │                       │
    ├────────────────────────▶│                        │                       │
    │                    validate limits               │                       │
    │                    deduct credits ─┐             │                       │
    │                    insert lesson   │ one txn     │                       │
    │                    insert ledger   │             │                       │
    │                    insert v1 ──────┘             │                       │
    │                         │  enqueue               │                       │
    │                         ├───────────────────────▶│                       │
    │◀── lessonId ────────────┤                        │  generate (≤3 tries)  │
    │                                                  ├──────────────────────▶│
    │   poll every 4s (router.refresh)                 │◀──────────────────────┤
    │◀ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │  validate + correct   │
    │                                                  │  write content        │
    │            state: Generating → Draft             │  state → Draft        │
```

### Step 1 — the wizard
`app/dashboard/create/` — a three-step client wizard. It collects the source, the level,
and an optional lesson name, and enforces the limits client-side for immediate feedback.
The page itself first checks `creditsBalance >= generationCost` and shows a
buy-credits empty state instead of the wizard when the teacher is short.

### Step 2 — `createLesson` (synchronous)
See [api-reference.md §2](./api-reference.md) for the full contract. The critical part is
the credit deduction, which is a **conditional update inside a transaction**:

```sql
UPDATE users SET credits_balance = credits_balance - :cost
WHERE id = :id AND credits_balance >= :cost
```

Zero rows affected means insufficient credits, and the whole transaction rolls back.
This is why two concurrent generations cannot overdraw a balance.

### Step 3 — the Trigger.dev task
`src/trigger/generate-lesson.ts`, task id `generate-lesson`, `maxDuration: 600`.

**Why it exists:** on Vercel, a Hobby function is killed at 60 seconds, and a platform
kill bypasses `try/catch` — the lesson would be stranded in `Generating` forever with
the credits already gone. Moving generation off the request makes failure observable.

**Payload**
```ts
{ lessonId, versionId, teacherId, locale, source, sourceType,
  systemPrompt, blueprint, validationScript, lessonNameInput }
```

Note that the prompt, blueprint, and validation script are passed **by value**. The task
does not re-read the template, so an admin editing a template mid-run does not affect an
in-flight generation.

**Two environment quirks this task handles itself:**
- `next-intl`'s `getTranslations` cannot resolve outside a Next.js request, so the task
  uses `createTranslator` with statically imported `messages/{ar,en,zh}.json`.
- `sentry.server.config.ts` never runs in the Trigger.dev process, so the task calls
  `Sentry.init` itself from `SENTRY_DSN`.

**On success** (one transaction): writes `lesson_versions.content`, flips the lesson to
`Draft`, backfills the lesson name from `content.meta.title` (or a localized
`untitledLesson`) when the teacher left it blank, and inserts a `generation_events` row
with `durationMs` and the three token counts.

**On failure:** the lesson goes to `GenerationFailed` and a failure event is recorded
with the error message. **Credits are deliberately not refunded** — the model call has
already been paid for. Failures are reported to pino, the Trigger logger, and Sentry.

### Step 4 — the UI catches up
`GenerationPoller` calls `router.refresh()` every 4 seconds while the lesson is
`Generating`; `LessonsExplorer` does the same whenever any row in the list is generating.
There are no websockets and no Supabase Realtime subscriptions.

---

## 2. The model call

`lib/ai/generate-lesson.ts`

**Provider.** `@ai-sdk/deepseek` wrapped by the Vercel AI SDK v7.

| Source | Model |
|---|---|
| Text (typed, pasted, PDF, DOCX) | `deepseek-v4-flash` |
| Images | `deepseek-v4-flash-vision-exp` |

**The API key is not an environment variable.** `lib/ai/deepseek-client.ts` reads it from
`system_settings.deepseek_api_key`, decrypts it with `lib/crypto/secret-box.ts`, and
memoizes the provider — rebuilding it only when the decrypted key changes. Admins rotate
the key at `/admin/settings` and it takes effect without a redeploy. This is the single
most surprising part of the setup, so do not go looking for `DEEPSEEK_API_KEY`.

**Output shape.** `lib/ai/lesson-content-schema.ts` is deliberately permissive:
`z.record(z.string(), z.unknown())`. There is no fixed lesson shape at the framework
level — the real structure is defined per template and enforced by that template's
validation script. This is what lets admins ship new lesson formats without a code change.

**The call.** `generateText({ model, output: Output.object({ schema }), system, messages })`
— **non-streaming**. The result is awaited whole; `streamText`/`streamObject` are not
used anywhere.

The system prompt is assembled from three parts:
1. the schema definition's `content` (the level's instructions),
2. a hard `STRICT OUTPUT RULES` block,
3. the template's `blueprint`, fenced as
   `===== EXAMPLE (structure reference only) =====`.

The user message is either the source text in triple quotes, or a multi-part message
carrying `{ type: "image", image: "data:<mime>;base64,..." }` parts.

### The self-correcting retry loop

`MAX_ATTEMPTS = 3`. After each response the pipeline runs two checks:

- **`detectEchoedBlueprint`** — flags output that reproduces more than 30% of the
  blueprint's distinctive lines (≥30 characters). This catches the model parroting the
  example instead of generating a real lesson.
- **`runTemplateValidation`** — executes the template's validation script.

If either produces errors and attempts remain, the pipeline appends the model's own JSON
output as an assistant turn plus a `buildCorrectionMessage` user turn, and calls again —
**preserving the conversation** rather than restarting cold, so the model sees what it
got wrong. Validation errors surviving all three attempts are thrown, landing the run in
the failure path.

**Privacy in logs.** `describeSource()` logs only a length and a 300-character preview
for text, and a bare count for images. Full source material never reaches the logs.

**Token accounting.** Returned as
`{ promptTokens: usage.inputTokens, completionTokens: usage.outputTokens, totalTokens }`
and persisted to `generation_events`.

---

## 3. Source ingestion

`lib/ai/extract-file-text.ts` and `constants/lesson-source-limits.ts`.

| Source | Accepted | Parser | Limit |
|---|---|---|---|
| Typed / pasted text | plain text | — | `MAX_TEXT_WORDS = 1000` (≈2 pages) |
| PDF | `.pdf`, `application/pdf` | `pdf-parse` | `MAX_PDF_PAGES = 2` → `pdfTooLong` |
| DOCX | `.docx`, OOXML mime | `mammoth.extractRawText` | 1000 words → `fileTooLong` |
| Images | `image/*` (wizard allows any image) | — sent as base64 data URLs to the vision model | `MAX_IMAGES = 2` |

Anything else returns `unsupportedFileType`.

Two implementation details worth preserving:

- **`pdf-parse` is imported dynamically inside the `try` block.** Its `pdfjs-dist`
  dependency touches the browser-only `DOMMatrix` at module evaluation time, so a static
  import breaks the build. `parser.destroy()` runs in `finally`.
- **Limits are enforced twice** — once in the wizard for instant feedback, once in the
  server action as the real gate. The constants file explicitly states that sources are
  never silently truncated; over-limit input is rejected with a message.

`DEFAULT_GENERATION_COST = 10` also lives in this file, but only as a fallback — the live
cost comes from `app_settings.generation_cost`.

---

## 4. Templates

A template is the "shape" of a lesson, uploaded by an admin as a ZIP.

| Part | Purpose |
|---|---|
| `index.html` | The player. Reads `window.LESSON_DATA` |
| `blueprint.js` | A fully filled-in example lesson, used as the AI's few-shot reference |
| `validation.js` | `module.exports = (content) => ({ errors, warnings })` |

### Bundling — `lib/templates/bundle-zip.ts`
The ZIP is flattened into **one self-contained HTML file** so the player has no external
dependencies at runtime:

- max 500 files; exactly one `index.html`; `blueprint.js` and `validation.js` at the top level
- `<link rel=stylesheet>` and local `<script src>` are inlined
- unreferenced CSS/JS files are appended
- sample `LESSON_DATA` files are dropped, Node-looking scripts are ignored
- `__MACOSX/`, dotfiles, and a single wrapper folder are stripped

Errors: `invalidZip`, `tooManyFiles`, `noHtmlFile`, `multipleHtmlFiles`,
`noBlueprintFile`, `noValidationFile`.

### Validation — `lib/templates/run-validation.ts`
Runs the admin-authored script in `node:vm` with a 2000 ms timeout. Any throw or
malformed result degrades to `{ errors: [], warnings: [] }` so a broken validator can't
block generation.

> ⚠️ The code comments are explicit that **`node:vm` is not a security boundary**.
> Template authors are trusted. `isolated-vm` is the noted follow-up if untrusted
> template uploads ever become a requirement.

### Playback — `lib/templates/compose-player-html.ts`
Injects, immediately after `<head>`:

```html
<style>html,body{overflow-x:hidden}</style>
<script>window.LESSON_DATA = { ...escaped JSON... }</script>
```

`<`, U+2028, and U+2029 are escaped to prevent a `</script>` breakout. The result is
served by two route handlers and rendered in an `<iframe sandbox="allow-scripts">`:

- `/dashboard/lessons/[id]/run/frame` — the teacher's classroom player
- `/l/[token]/frame` — the anonymous shared player

---

## 5. Billing (Paddle)

Paddle is the merchant of record. It replaced an earlier Stripe integration in
migration `0019`.

### Server — `lib/paddle.ts`
A **lazy** singleton, so pages that never touch payments work fine without Paddle keys
configured. `getOrCreatePaddleCustomer` creates the Paddle customer with
`customData.userId` and caches the id on `users.paddle_customer_id`.

### Browser — `lib/paddle-client.ts`
There is no npm browser SDK, so the module injects
`https://cdn.paddle.com/paddle/v2/paddle.js` at runtime. Two details matter:
`Environment.set()` must be called **before** `Initialize({ token })`, and a rejected
load promise is de-cached so a transient network failure is recoverable on retry.

### The purchase flow

1. **`createCheckoutSession(packageId)`** inserts a `pending` purchase, creates a Paddle
   draft transaction carrying `customData { purchaseId, userId, packageId }`, and returns
   the transaction id.
2. The client opens the overlay:
   `window.Paddle.Checkout.open({ transactionId, settings: { successUrl: "...?purchase=success" } })`.
3. Paddle POSTs to **`/api/webhooks/paddle`**. The handler verifies the signature, then
   in one transaction marks the purchase `completed` (guarded by `status <> 'completed'`),
   writes a ledger entry, and increments the balance.
4. The webhook is asynchronous and can **lose the race** with the success redirect, so
   `PurchaseBalancePoller` polls `router.refresh()` up to 5 times at 2-second intervals
   and renders three honest states — *processing*, *success*, *delayed* — instead of
   claiming success prematurely.

**Idempotency.** The guard is `status <> 'completed'` rather than `status = 'pending'`,
which is deliberate: it stays idempotent against duplicate webhooks while still allowing
a credit after an earlier attempt was marked `failed`.

### The manual-payment kill switch
When `app_settings.auto_payment_enabled` is `false`, `/dashboard/credits` replaces the
Paddle button with a WhatsApp contact button pointing at
`app_settings.whatsapp_contact_number`. Useful when Paddle is unavailable or a market
needs manual settlement.

---

## 6. Supabase

| Client | File | Use |
|---|---|---|
| Browser | `lib/supabase/client.ts` | Client Components |
| Server | `lib/supabase/server.ts` | Server Components and actions; swallows cookie-write errors, since the proxy handles refresh |
| Service role | `lib/supabase/admin.ts` | `auth.admin.createUser` / `deleteUser`. **Bypasses RLS — server-only** |
| Proxy | `lib/supabase/proxy.ts` | Session refresh in `proxy.ts` |

**Supabase Storage is not used.** There are no `.storage`, `.upload()`, or
`createSignedUrl` calls anywhere. Template preview images are base64 `data:` URIs stored
in a text column.

The database is reached through Drizzle over `postgres-js`, **not** through the Supabase
client, with `prepare: false` for the transaction-mode pooler.

---

## 7. Observability

| Piece | File | Notes |
|---|---|---|
| Server / edge Sentry | `sentry.server.config.ts`, `sentry.edge.config.ts` | Loaded by `instrumentation.ts` based on `NEXT_RUNTIME` |
| Browser Sentry | `instrumentation-client.ts` | `tracesSampleRate: 0.1`, enabled only in production |
| Request errors | `instrumentation.ts` | Exports `onRequestError` → `Sentry.captureRequestError` |
| Source maps | `next.config.ts` | `withSentryConfig` uploads at build time using `SENTRY_ORG` / `SENTRY_PROJECT` / `SENTRY_AUTH_TOKEN` |
| Logging | `lib/logger.ts` | pino; level from `LOG_LEVEL` (default `info`); ISO timestamps; server-only |

Domain-level observability lives in the database: `generation_events` (tokens, latency,
success) at `/admin/generation-events`, and `audit_logs` at `/admin/audit-logs`.

---

## 8. Cryptography

`lib/crypto/secret-box.ts` — AES-256-GCM.

- Key: `scryptSync(APP_KEY, "system-settings-secret-box", 32)`, cached in-process.
- Payload: `iv.authTag.ciphertext`, base64, dot-joined, stored in
  `system_settings.encrypted_value`.
- `maskSecret()` renders the first and last four characters for the admin UI. **The
  plaintext is never sent back to the browser.**

Share tokens use `randomBytes(24).toString("base64url")` — 192 bits of entropy, stored
with a unique index.

> **Rotating `APP_KEY` invalidates every stored secret.** They are encrypted with a key
> derived from it and cannot be recovered; they must be re-entered in the admin UI.
