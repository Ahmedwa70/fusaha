import { getTranslations } from "next-intl/server";
import { getCreditPackages } from "@/lib/admin/queries/credit-package";
import { CreditPackagesTable } from "@/app/admin/credit-packages/_components/credit-packages-table";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";

export default async function AdminCreditPackagesPage() {
  await requirePermission(Permissions.creditPackagesList);
  const t = await getTranslations("admin.creditPackages");
  const creditPackages = await getCreditPackages();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("sectionTitle")}</h1>
        <p className="text-muted-foreground">{t("sectionDescription")}</p>
      </div>

      <CreditPackagesTable creditPackages={creditPackages} />
    </div>
  );
}
