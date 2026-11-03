// Plain TypeScript enums, not Postgres enums (pgEnum). Numeric values so the
// columns are smallint — smaller and faster to index/compare than text, and
// still just a data update (not a blocking ALTER TYPE) if a value changes.

export enum LessonState {
  Draft = 0,
  Generating = 1,
  GenerationFailed = 2,
  Approved = 3,
}

export enum VersionStatus {
  Draft = 0,
  Approved = 1,
}

export enum SourceType {
  Images = 0,
  TextDirect = 1,
  TextPasted = 2,
  Pdf = 3,
  Docx = 4,
}

// Immutable runtime package lifecycle. Numeric smallint per the convention
// above; the text-state mapping is 1:1 with ADR §7 and
// docs/architecture/RUNTIME_VERSION_SCHEMA_DESIGN.md §3.7.
export enum RuntimeVersionState {
  Pending = 0,
  Published = 1,
  Failed = 2,
  Quarantined = 3,
  DeletionPending = 4,
  Collected = 5,
}

export enum RuntimePublicationAttemptState {
  Created = 0,
  Leased = 1,
  Uploading = 2,
  Verifying = 3,
  Finalizing = 4,
  Published = 5,
  Failed = 6,
  Expired = 7,
  Quarantined = 8,
}

export enum RuntimeStorageObjectState {
  Staged = 0,
  Available = 1,
  Missing = 2,
  Quarantined = 3,
  Deleted = 4,
}

export enum RuntimePackageKind {
  SingleFile = 0,
  MultiFile = 1,
}

export enum RuntimeBindingStatus {
  Unbound = 0,
  Bound = 1,
  Legacy = 2,
  Quarantined = 3,
  Unrecoverable = 4,
}
