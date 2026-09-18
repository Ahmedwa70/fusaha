import { getTranslations } from "next-intl/server";
import { requireTeacher } from "@/lib/auth/dal";
import { getTeacherFolders } from "@/lib/dashboard/queries/folder";
import { NewFolderButton } from "./_components/new-folder-button";
import { FoldersGrid } from "./_components/folders-grid";

export default async function FoldersPage() {
  const t = await getTranslations("dashboard.folders");
  const teacher = await requireTeacher();
  const folders = await getTeacherFolders(teacher.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
          <p className="text-muted-foreground">{t("pageDescription")}</p>
        </div>
        <NewFolderButton />
      </div>

      <FoldersGrid folders={folders} />
    </div>
  );
}
