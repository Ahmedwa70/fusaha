import { getTranslations } from "next-intl/server";
import { getSchemaDefinitions } from "@/lib/admin/queries/schema-definition";
import { getActiveTemplates } from "@/lib/admin/queries/template";
import { SchemaDefinitionsTable } from "@/app/admin/schema/_components/schema-definitions-table";
import { NewSchemaDefinitionButton } from "@/app/admin/schema/_components/new-schema-definition-button";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";

export default async function AdminSchemaPage() {
  await requirePermission(Permissions.schemaList);
  const t = await getTranslations("admin.schema");
  const schemaDefinitions = await getSchemaDefinitions();
  const templates = await getActiveTemplates();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{t("sectionTitle")}</h1>
          <p className="text-muted-foreground">{t("sectionDescription")}</p>
        </div>

        <NewSchemaDefinitionButton templates={templates} />
      </div>

      <SchemaDefinitionsTable schemaDefinitions={schemaDefinitions} templates={templates} />
    </div>
  );
}
