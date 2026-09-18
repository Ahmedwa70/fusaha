import { getTranslations } from "next-intl/server";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { getDeepSeekApiKeyStatus, getGenerationCostSetting, getPaymentSettings } from "@/lib/admin/queries/settings";
import { SettingsForm } from "./_components/settings-form";
import { GenerationCostForm } from "./_components/generation-cost-form";
import { PaymentSettingsForm } from "./_components/payment-settings-form";

export default async function AdminSettingsPage() {
  await requirePermission(Permissions.settingsList);
  const t = await getTranslations("admin.settings");
  const [deepSeekStatus, generationCost, paymentSettings] = await Promise.all([
    getDeepSeekApiKeyStatus(),
    getGenerationCostSetting(),
    getPaymentSettings(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("sectionTitle")}</h1>
        <p className="text-muted-foreground">{t("sectionDescription")}</p>
      </div>

      <GenerationCostForm generationCost={generationCost} />
      <PaymentSettingsForm paymentSettings={paymentSettings} />
      <SettingsForm deepSeekStatus={deepSeekStatus} />
    </div>
  );
}
