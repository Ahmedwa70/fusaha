import { getTranslations } from "next-intl/server";
import { BookOpenIcon, CheckCircle2Icon, FileEditIcon, Share2Icon } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { LessonsExplorer } from "@/components/dashboard/lessons-explorer";
import { ArchPattern } from "@/app/auth/login/_components/arch-pattern";
import { requireTeacher } from "@/lib/auth/dal";
import { getTeacherLessons } from "@/lib/dashboard/queries/lesson";
import { getActiveShareLinkCount } from "@/lib/dashboard/queries/share-link";
import { getTeacherFolders } from "@/lib/dashboard/queries/folder";
import { LessonState } from "@/database/schema";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const t = await getTranslations("dashboard.home");
  const teacher = await requireTeacher();
  const { folder } = await searchParams;
  const [lessons, shared, folders] = await Promise.all([
    getTeacherLessons(teacher.id),
    getActiveShareLinkCount(teacher.id),
    getTeacherFolders(teacher.id),
  ]);

  const total = lessons.length;
  const approved = lessons.filter((l) => l.state === LessonState.Approved).length;
  const drafts = lessons.filter(
    (l) => l.state === LessonState.Draft || l.state === LessonState.GenerationFailed
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-gold-100 px-4 py-5 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-700 sm:rounded-3xl sm:px-8 sm:py-7 dark:bg-brand-950">
        <ArchPattern className="absolute inset-0 h-full w-full text-brand-900/8 dark:text-gold-400/8" />
        <div className="relative flex items-start gap-3 sm:gap-4">
          <span
            role="img"
            aria-label={t("waveAlt")}
            className="motion-safe:animate-wave inline-block shrink-0 text-2xl sm:text-5xl"
          >
            👋
          </span>
          <div className="min-w-0">
            <h1 className="font-heading text-lg leading-tight font-semibold text-brand-900 sm:text-3xl dark:text-brand-50">
              {t("greeting", { name: teacher.name })}
            </h1>
            <p className="mt-1 text-sm text-brand-900/70 sm:text-base dark:text-brand-100/70">{t("subtitle")}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <StatCard icon={Share2Icon} value={shared} label={t("statShared")} tint="bg-blue-50 text-blue-600" />
        <StatCard icon={CheckCircle2Icon} value={approved} label={t("statApproved")} tint="bg-green-50 text-green-600" />
        <StatCard icon={FileEditIcon} value={drafts} label={t("statDrafts")} tint="bg-amber-50 text-amber-600" />
        <StatCard icon={BookOpenIcon} value={total} label={t("statTotal")} tint="bg-secondary text-secondary-foreground" />
      </div>

      <LessonsExplorer
        lessons={lessons}
        folders={folders}
        title={t("explorerTitle")}
        description={t("explorerDescription")}
        initialFolder={folder}
      />
    </div>
  );
}
