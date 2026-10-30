# Runtime Contract and Adapter Boundary

This module is an additive Phase 1 boundary. It is intentionally not imported by generation, dashboard rendering, public sharing, database code, or production routes.

## Minimum contract

A runtime package has:

- `manifest.contractVersion`: platform contract version.
- `manifest.runtimeId`: stable logical runtime identifier.
- `manifest.runtimeVersion`: implementation version supplied by the runtime owner.
- `manifest.packageKind`: `single-file` or `multi-file`.
- `manifest.entryPoint`: package-relative entry file.
- `manifest.capabilities`: explicitly declared platform capabilities.
- `manifest.assets`: optional package asset metadata and integrity values.
- `files`: package-relative file content.

Lesson data is represented separately as `RuntimeLessonData`. The contract does not embed lesson content into runtime files and does not execute HTML or JavaScript.

## Adapter responsibilities

An adapter converts one template implementation into the common package shape. It must:

1. Preserve the implementation's files without imposing visual structure.
2. Declare the entry point and capabilities.
3. Produce deterministic package metadata.
4. Validate package completeness and supported contract values.
5. Avoid network calls, database access, credential access, and runtime execution.

The current `htmlPlayerAdapter` wraps the repository's existing HTML player as `index.html`. It does not change `composePlayerHtml` and is not connected to production rendering.

## Identity and versioning

`getRuntimeIdentity` computes a deterministic SHA-256 identity over canonical manifest data and sorted package files. Manifest keys, metadata keys, capabilities, assets, and file paths are normalized before hashing. Any executable content or contract metadata change produces a different identity.

The identity is an in-memory/content identity for Phase 1. It is not persisted to the database and does not create a runtime registry.

## Extension examples

### Single-file HTML player

```ts
const runtime = htmlPlayerAdapter.createPackage({
  runtimeId: "html-player",
  runtimeVersion: "1.0.0",
  htmlPlayer: "<!doctype html><html><body><main id=app></main></body></html>",
});
```

The adapter exposes one `index.html` entry point and the `lesson-data` capability.

### Multi-file canvas runtime

A future adapter could create a package with `index.html`, `runtime.js`, `styles.css`, and declared assets. It would implement the same `RuntimeAdapter` shape, set `packageKind` to `multi-file`, and choose `index.html` as its entry point. The core lesson, database, and sharing contracts would not need to know how the runtime draws its canvas.

```ts
const runtime = canvasAdapter.createPackage({
  runtimeId: "canvas-activity",
  runtimeVersion: "2.0.0",
  files: {
    "index.html": "...",
    "runtime.js": "...",
    "styles.css": "...",
  },
  assets: [],
});
```

A future adapter may support a different structure, but it must still return a validated `RuntimePackage` and remain isolated from application persistence.

## Registry storage

`RuntimePackageRegistry` is the Phase 2 storage boundary. Its default `InMemoryRuntimePackageStore` is intentionally local and process-scoped because this phase forbids database migrations, production writes, and new external infrastructure. The store interface is small enough to back with an approved persistent repository in a later phase without changing identity, validation, or retrieval semantics.

Registration validates the package, calculates its identity, reuses an existing identical package, and stores a defensive clone. There is no update operation. A different package receives a different identity; a package stored under a mismatched identity is rejected on retrieval. `get` and `has` recalculate the full package identity before returning, so corrupted contents are detected.

The package identity is independent of template IDs, schema IDs, lesson IDs, and user IDs. It covers canonical manifest metadata and every sorted package file. Asset integrity and declared UTF-8 byte sizes are checked before registration.

## Lesson-version runtime binding

`LessonVersionRuntimeBindingService` binds one lesson version to one exact runtime identity. The binding records:

- `lessonVersionId`: the version-level owner of the reference.
- `status`: `bound` or explicit `legacy-unbound`.
- `runtimeIdentity`: the content identity returned by `RuntimePackageRegistry` when bound.
- `contractVersion`: the exact runtime contract expected by the binding.
- `reason`: required only for a legacy/unbound state.

Binding validates that the runtime exists, passes registry integrity checks, and exposes the expected contract version. A binding is immutable after its first established state. Reasserting the same bound identity is idempotent; assigning a different runtime or replacing a legacy/unbound state is rejected. Resolving a legacy/unbound version returns no runtime rather than silently selecting the current template or generating a replacement.

The model intentionally contains no lesson ID, template ID, or schema-definition ID. Those identities remain separate domain concerns. The binding only establishes the exact runtime required by a specific lesson version.

Existing lesson versions are represented as `legacy-unbound` until future backfill has verified evidence of the exact historical runtime. This phase does not assign those states in production and does not claim that current lesson versions are runtime-independent.

## Persistent storage boundary

Phase 3 uses `InMemoryLessonVersionRuntimeBindingStore` only. `LessonVersionRuntimeBindingStore` is the persistence boundary for a later approved database implementation. A future repository must provide atomic insert-if-absent semantics, read-by-lesson-version, a unique lesson-version constraint, immutable update behavior, and a foreign-key/reference check against the persistent runtime registry. The future migration must be expand/backfill/contract and must not infer historical runtime identity from a mutable current template row.

The application generation and rendering paths do not import this binding service yet. Production integration belongs to a later phase after persistent runtime storage, staging data inventory, and historical recovery evidence are available.

## Error handling

`validateRuntimePackage` returns structured issues instead of throwing for expected contract violations. It reports invalid contract/version values, empty or missing entry points, unsupported capabilities, and manifest assets missing from the package. `RuntimePackageRegistry` adds clear errors for invalid packages, missing identities, identity conflicts, and corrupted stored packages. `LessonVersionRuntimeBindingService` adds clear errors for missing/nonexistent runtimes, contract mismatches, invalid legacy reasons, and reassignment attempts. Callers decide whether a validation result is a warning or a publication blocker in a later phase.
