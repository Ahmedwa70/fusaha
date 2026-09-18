import { getTranslations } from "next-intl/server";
import { requireTeacher } from "@/lib/auth/dal";
import { ProfileForm } from "./_components/profile-form";

export default async function TeacherProfilePage() {
  const t = await getTranslations("dashboard.profile");
  const teacher = await requireTeacher();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageDescription")}</p>
      </div>

      <ProfileForm name={teacher.name} email={teacher.email} />
    </div>
  );
}
