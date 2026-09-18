import { getTranslations } from "next-intl/server";
import { getGenerationEvents } from "@/lib/admin/queries/generation-event";
import { GenerationEventsTable } from "@/app/admin/generation-events/_components/generation-events-table";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";

export default async function AdminGenerationEventsPage() {
  await requirePermission(Permissions.generationEventsList);
  const t = await getTranslations("admin.generationEvents");
  const generationEvents = await getGenerationEvents();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("sectionTitle")}</h1>
        <p className="text-muted-foreground">{t("sectionDescription")}</p>
      </div>

      <GenerationEventsTable generationEvents={generationEvents} />
    </div>
  );
}
