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
