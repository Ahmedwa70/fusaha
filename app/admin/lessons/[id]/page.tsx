import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoField } from "@/components/shared/info-field";
import { dateFormatter } from "@/lib/dashboard/format";
import { getAdminLessonById } from "@/lib/admin/queries/lesson";
import { LessonStatusBadge } from "@/app/admin/lessons/_components/lesson-status-badge";
import { RestoreLessonButton } from "./_components/restore-lesson-button";
import { HardDeleteLessonButton } from "./_components/hard-delete-lesson-button";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";

export default async function AdminLessonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(Permissions.lessonsList);
  const { id } = await params;
  const lesson = await getAdminLessonById(id);

  if (!lesson) notFound();

  const t = await getTranslations("admin.lessons");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{lesson.name}</h1>
            <LessonStatusBadge state={lesson.state} deletedAt={lesson.deletedAt} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {lesson.deletedAt && <RestoreLessonButton id={lesson.id} name={lesson.name} />}
          <HardDeleteLessonButton id={lesson.id} name={lesson.name} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("detailsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <InfoField label={t("fieldOwner")} value={`${lesson.ownerName} (${lesson.ownerEmail})`} />
            <InfoField label={t("fieldLevel")} value={lesson.level ?? "—"} />
            <InfoField label={t("fieldFolder")} value={lesson.folderName} />
            <InfoField label={t("fieldVersionCount")} value={lesson.versionCount} />
            <InfoField label={t("fieldCreatedAt")} value={dateFormatter.format(lesson.createdAt)} />
            <InfoField label={t("fieldUpdatedAt")} value={dateFormatter.format(lesson.updatedAt)} />
            {lesson.deletedAt && (
              <InfoField label={t("fieldDeletedAt")} value={dateFormatter.format(lesson.deletedAt)} />
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
