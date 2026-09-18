import { getTranslations } from "next-intl/server";
import { requireAdmin } from "@/lib/auth/dal";
import { ProfileForm } from "./_components/profile-form";

export default async function AdminProfilePage() {
  const t = await getTranslations("admin.profile");
  const admin = await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageDescription")}</p>
      </div>

      <ProfileForm name={admin.name} email={admin.email} />
    </div>
  );
}
