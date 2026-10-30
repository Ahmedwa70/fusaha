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

## Error handling

`validateRuntimePackage` returns structured issues instead of throwing for expected contract violations. It reports invalid contract/version values, empty or missing entry points, unsupported capabilities, and manifest assets missing from the package. Callers decide whether a validation result is a warning or a publication blocker in a later phase.
