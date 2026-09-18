import { notFound } from "next/navigation";
import { getApprovedLessonByShareToken } from "@/lib/dashboard/queries/lesson";

// PRD §13: anonymous run flow via a share link — same player as the
// dashboard's "Play Lesson", no auth, no exit control back into the
// dashboard (there's nothing for an anonymous viewer to exit to).
export default async function SharedLessonPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lesson = await getApprovedLessonByShareToken(token);

  if (!lesson) notFound();

  return (
    <iframe
      src={`/l/${token}/frame`}
      sandbox="allow-scripts"
      className="h-screen w-screen border-0"
      title={lesson.name}
    />
  );
}
