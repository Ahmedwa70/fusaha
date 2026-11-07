# Fusaha Library — Admin Backend API Contract

> عقد واجهات إدارة مكتبة Fusaha. وثّقت هذه الواجهات ليتمكن v0 من بناء لوحة إدارة
> المكتبة وربطها بالـ Backend القائم دون تغيير أي منطق خادم.

## 1. Architecture overview

- **Management surface = Next.js Server Actions** (NOT REST). The v0-built admin UI
  must import and call these actions from Client Components, exactly like the existing
  admin pages do.
- **Public reading surface = HTTP routes** (`app/api/library/...`) for in-platform
  PDF streaming/download. These are consumed by the public library UI and the future
  embedded reader — not by the admin panel.
- Storage: file bytes live in **Cloudflare R2 (private bucket `fusaha-library`)**.
  The database stores only file metadata + `storageKey`. Original R2 URLs are never
  exposed; delivery only through the guarded routes below.
- AuthZ: every entry point checks permissions server-side via `requirePermission`.
  The UI should hide/disabled controls, but the server is the enforcing boundary.

## 2. Server Actions — book lifecycle (`actions/library.ts`)

All actions return:

```ts
type LibraryActionState = { success: true; id?: string } | { error: string };
```

| Action | Permission | Purpose |
|---|---|---|
| `createLibraryBook(data: CreateLibraryBookValues)` | `libraryCreate` | Create draft book |
| `updateLibraryBook(id: string, data: UpdateLibraryBookValues)` | `libraryUpdate` | Edit metadata/lifecycle |
| `publishLibraryBook(id: string)` | `libraryPublish` | Set `published` (requires `verified`) |
| `unpublishLibraryBook(id: string)` | `libraryUnpublish` | Move back from published |
| `archiveLibraryBook(id: string)` | `libraryUpdate` | Archive (keeps record) |
| `deleteLibraryBook(id: string)` | `libraryDelete` | Hard delete (guarded) |

Book fields (Zod-validated, `validation/library-books.ts`):

- `slug` — kebab-case unique, 1–160.
- `originalTitle` (req), `authors` (req), `publisher?`, `publicationYear?` (1000–3000),
  `originalLanguage` (default `"ar"`), `isbn?`, `category` (req), `audience` (req),
  `level` (req), `skills: string[]` (≤30).
- Localized objects (`record<locale, string>`): `displayTitle` (req in EVERY locale),
  `description` (req in every locale), `longDescription?`, `accessNotes?`.
- `sourceName` (req), `sourceUrl` (req URL), `destinationType`
  (`publisher|author|institution|library|other`), `accessStatus`
  (`free_reading|preview|purchase|institutional_access|unknown`, default `unknown`),
  `coverUrl?` (URL).
- Lifecycle (update only): `publicationStatus`
  (`draft|pending_review|published|unpublished|archived`), `reviewStatus`
  (`needs_review|verified`). Invariant enforced server-side: **published ⇒ verified**.

Public visibility rule: public pages list only `publicationStatus='published'` AND
`reviewStatus='verified'` books (`lib/library/public-books.ts`). The same
condition gates the stream/download routes for everyone, managers included
(`not_published` denial in `lib/library/access-policy.ts`).

## 2b. Server Actions — dashboard queries (`actions/library.ts`)

Read-only catalog helpers for the admin dashboard. All are permission-checked
and input-validated server-side; return `{ error: string }` (pre-localized)
on failure.

### `listLibraryBooks(input: LibraryBookListQuery)`

- Permission: `library.list`.
- Input (Zod, `libraryBookListQuerySchema`):
  - `query?: string` (≤160) — substring match on `originalTitle` OR `slug`
    (case-insensitive; `%`, `_`, `\` in the input are escaped, never wildcards).
  - `publicationStatus?: "draft" | "pending_review" | "published" | "unpublished" | "archived"`
  - `reviewStatus?: "needs_review" | "verified"`
  - `page?: number` (int ≥1, default 1)
  - `pageSize?: number` (int 1–100, default 20)
- Success:

```ts
{
  success: true;
  books: Array<{
    id: string; slug: string; originalTitle: string;
    publicationStatus: string; reviewStatus: string; updatedAt: Date;
  }>; // sorted by updatedAt desc
  page: number; pageSize: number; total: number; totalPages: number;
}
```

### `searchLibraryMembers(input: { query: string })`

- Permission: `library.update`.
- `query`: 1–160 chars; partial, case-insensitive email match (wildcards escaped).
- Success: `{ success: true; members: Array<{ id: string; email: string; name: string }> }`
  — at most 10 rows, ordered by email. Use the returned `id` with
  `grantLibraryDownload(bookId, email)` (email is the grant contract).

### `getLibraryStats()`

- Permission: `library.list`. No input.
- Success:

```ts
{
  success: true;
  stats: {
    totalBooks: number;
    byPublicationStatus: { draft: number; pending_review: number; published: number; unpublished: number; archived: number };
    totalGrants: number;
    grantsPerBook: Array<{ bookId: string; originalTitle: string; count: number }>;
    totalFiles: number;   // library_files rows
    totalBytes: number;   // sum of size_bytes
  };
}
```

## 3. Server Actions — files & access (`actions/library-files.ts`)

| Action | Permission | Purpose |
|---|---|---|
| `uploadLibraryBookFile(bookId: string, formData: FormData)` | `libraryUpdate` | Upload PDF (`formData.get("file")`) |
| `grantLibraryDownload(bookId: string, userId: string)` | `libraryUpdate` | Grant a user download rights |
| `revokeLibraryDownload(bookId: string, userId: string)` | `libraryUpdate` | Revoke |

Upload contract:
- MIME allowlist: PDF only; size 1 byte … `LIBRARY_UPLOAD_MAX_BYTES`.
- **SHA-256 dedup**: identical bytes reuse the existing `library_files` row (no second
  R2 object). Response distinguishes `deduplicated`.
- Creates `library_book_files` link (one primary file per book enforced by
  `library_book_files_book_unique`).

## 4. Public HTTP routes (read path)

| Route | Method | Guard | Response |
|---|---|---|---|
| `/api/library/books/[slug]/stream` | GET | `resolveLibraryBookAccess(slug).read.allowed` | PDF bytes, `Content-Disposition: inline` + `Range` support |
| `/api/library/books/[slug]/download` | GET | `.download.allowed` (explicit grant or library management) | PDF bytes, `attachment` |

Access policy (`lib/library/access-policy.ts`): free published books are readable in
platform; `download` additionally requires a `library_download_grants` row (or a
manager). Both fetch bytes from R2 via `storageKey` and never redirect to R2.

Range / partial content (both routes):
- `Accept-Ranges: bytes` is always sent; a `Range: bytes=a-b` (or `bytes=a-`)
  header yields `206` with `Content-Range`/`Content-Length`. Suffix ranges
  (`bytes=-N`), multi-ranges, and out-of-bounds ranges yield `416` with
  `Content-Range: bytes */<total>`.
- The access check runs **before** any byte is fetched from R2 — an unauthorized
  Range request still gets `404/403`, never a `206`.

## 5. Data model (applied to Production: migrations 0022 + 0024)

- `library_books` — 30 columns (metadata + localized display fields + lifecycle).
  Uniques: `slug`. FK: `created_by/updated_by → users.id`.
- `library_files` — `id, sha256 (unique), storage_key (unique), size_bytes,
  content_type, original_filename, uploaded_by?, created_at, updated_at`.
- `library_book_files` — book↔file link. Unique(book_id); FKs → books (cascade),
  files (restrict).
- `library_download_grants` — unique(book_id, user_id); FKs → books (cascade),
  users (granted_by, cascade/no-action pair).

## 6. Environment (already configured)

- Local: `.env.library-r2.local` (git-ignored) — `LIBRARY_R2_ACCOUNT_ID`,
  `LIBRARY_R2_ACCESS_KEY_ID`, `LIBRARY_R2_SECRET_ACCESS_KEY`,
  `LIBRARY_R2_BUCKET_NAME=fusaha-library`, `LIBRARY_R2_ENDPOINT`.
- Vercel (Preview/Production): the same five vars must be set per environment.

## 7. Rules for the v0 admin UI

1. Call the server actions directly; do not invent REST endpoints.
2. Handle `{ error }` results by surfacing them (they are pre-localized strings).
3. Upload via `<FormData>` with key `"file"`.
4. Respect the published⇒verified invariant in the UI (disable Publish until
   `reviewStatus === "verified"`).
5. Do not expose `storageKey` or build R2 URLs anywhere in the UI.
