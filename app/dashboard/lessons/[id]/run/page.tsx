import { notFound } from "next/navigation";
import Link from "next/link";
import { LogOutIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireTeacher } from "@/lib/auth/dal";
import { getApprovedLessonForPlay } from "@/lib/dashboard/queries/lesson";

// PRD §12: "Play Lesson" opens the lesson engine in fullscreen, designed
// for the classroom's large display — its own route rather than a modal
// over the dashboard chrome.
export default async function RunLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const teacher = await requireTeacher();
  const { id } = await params;
  const lesson = await getApprovedLessonForPlay(teacher.id, id);

  if (!lesson) notFound();

  const t = await getTranslations("dashboard.lessonRun");

  return (
    <div className="fixed inset-0">
      <iframe
        src={`/dashboard/lessons/${id}/run/frame`}
        sandbox="allow-scripts"
        className="h-full w-full border-0"
        title={lesson.name}
      />
      <Link
        href={`/dashboard/lessons/${id}`}
        title={t("exit")}
        className="fixed bottom-4 left-4 z-50 flex size-10 items-center justify-center rounded-full bg-background/90 text-foreground shadow-lg ring-1 ring-border transition-colors hover:bg-background"
      >
        <LogOutIcon className="size-5" />
        <span className="sr-only">{t("exit")}</span>
      </Link>
    </div>
  );
}
