export type GoldenLessonVersion = {
  id: string;
  versionNumber: number;
  status: "draft" | "approved";
  content: unknown;
};

export const goldenPlayerHtml = `<!doctype html>
<html lang="ar" dir="rtl">
  <head><meta charset="utf-8"><title>Golden lesson player</title></head>
  <body><main id="app"></main></body>
</html>`;

export const goldenLessonContent = {
  title: "التحية بالعربية",
  direction: "rtl",
  prompt: "اكتب: <مرحبا> & \"أهلًا\"",
  examples: ["أهلًا وسهلًا", "</script><script>window.evil = true</script>"],
  unicode: "ض ظ ع غ — café — 日本語",
};

export const approvedLessonWithOneVersion = {
  name: "Golden Arabic lesson",
  state: "approved" as const,
  currentApprovedVersionId: "version-1",
  versions: [
    {
      id: "version-1",
      versionNumber: 1,
      status: "approved" as const,
      content: goldenLessonContent,
    },
  ] satisfies GoldenLessonVersion[],
  htmlPlayer: goldenPlayerHtml,
};

export const approvedLessonWithMultipleVersions = {
  name: "Golden Arabic lesson with history",
  state: "approved" as const,
  currentApprovedVersionId: "version-2",
  versions: [
    {
      id: "version-1",
      versionNumber: 1,
      status: "approved" as const,
      content: { ...goldenLessonContent, title: "الإصدار القديم" },
    },
    {
      id: "version-2",
      versionNumber: 2,
      status: "approved" as const,
      content: { ...goldenLessonContent, title: "الإصدار الحالي" },
    },
  ] satisfies GoldenLessonVersion[],
  htmlPlayer: goldenPlayerHtml,
};

export function getCurrentApprovedFixtureContent(lesson: typeof approvedLessonWithMultipleVersions): unknown {
  return lesson.versions.find((version) => version.id === lesson.currentApprovedVersionId)?.content ?? null;
}
