import { getTranslations } from "next-intl/server";
import { getAdminLessons } from "@/lib/admin/queries/lesson";
import { LessonsTable } from "@/app/admin/lessons/_components/lessons-table";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";

export default async function AdminLessonsPage() {
  await requirePermission(Permissions.lessonsList);
  const t = await getTranslations("admin.lessons");
  const lessons = await getAdminLessons();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageDescription")}</p>
      </div>

      <LessonsTable lessons={lessons} />
    </div>
  );
}
