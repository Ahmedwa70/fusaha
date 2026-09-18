"use client";

import { ObjectField } from "./object-field";
import { DrillNavProvider } from "./drill-nav";
import { MobileDrillSheet } from "./mobile-drill-sheet";

// Root of the recursive JSON editor. Lesson content is always a top-level
// JSON object (see lib/ai/lesson-content-schema.ts), so this renders its
// keys directly at depth 0 (no collapsible chrome — it's already inside the
// editor's own card). DrillNavProvider/MobileDrillSheet back the mobile-only
// drill-down navigation used by nested ObjectField/ArrayField entries.
export function JsonForm({ content }: { content: Record<string, unknown> }) {
  return (
    <DrillNavProvider>
      <ObjectField name="" label="" value={content} depth={0} />
      <MobileDrillSheet />
    </DrillNavProvider>
  );
}
