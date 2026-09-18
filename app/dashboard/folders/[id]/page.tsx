import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { requireTeacher } from "@/lib/auth/dal";
import { getFolderById } from "@/lib/dashboard/queries/folder";
import { getTeacherLessons, getLessonsInOtherFolders } from "@/lib/dashboard/queries/lesson";
import { LessonsTable } from "@/components/dashboard/lessons-table";
import { FolderDetailActions } from "./_components/folder-detail-actions";

export default async function FolderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getTranslations("dashboard.folders");
  const teacher = await requireTeacher();
  const { id } = await params;

  const folder = await getFolderById(teacher.id, id);
  if (!folder) notFound();

  const [lessons, unfiledLessons, otherFolderLessons] = await Promise.all([
    getTeacherLessons(teacher.id, id),
    getTeacherLessons(teacher.id, null),
    getLessonsInOtherFolders(teacher.id, id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href={ROUTES.dashboardFolders} />}>{t("pageTitle")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{folder.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{folder.name}</h1>
            <p className="text-muted-foreground">{t("lessonCount", { count: lessons.length })}</p>
          </div>
          <FolderDetailActions folder={folder} unfiledLessons={unfiledLessons} otherFolderLessons={otherFolderLessons} />
        </div>
      </div>

      <Card>
        <CardContent>
          <LessonsTable lessons={lessons} />
        </CardContent>
      </Card>
    </div>
  );
}
