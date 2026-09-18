import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { InfoField } from "@/components/shared/info-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { dateFormatter } from "@/lib/dashboard/format";
import { getSchemaDefinitionById } from "@/lib/admin/queries/schema-definition";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";
import { resolveLevelLabel } from "@/lib/schema-definitions";
import type { Locale } from "@/i18n/config";

export default async function AdminSchemaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission(Permissions.schemaList);
  const { id } = await params;
  const schemaDefinition = await getSchemaDefinitionById(id);

  if (!schemaDefinition) notFound();

  const t = await getTranslations("admin.schema");
  const locale = (await getLocale()) as Locale;
  const levelLabel = resolveLevelLabel(schemaDefinition.level, locale);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("detailTitle", { level: levelLabel, version: schemaDefinition.version })}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("detailsTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <InfoField label={t("fieldLevel")} value={levelLabel} />
            <InfoField label={t("fieldVersion")} value={schemaDefinition.version} />
            <InfoField label={t("fieldActive")} value={<StatusBadge active={schemaDefinition.active} />} />
            <InfoField label={t("fieldCreatedAt")} value={dateFormatter.format(schemaDefinition.createdAt)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("fieldContent")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="preview">
            <TabsList>
              <TabsTrigger value="preview">{t("tabPreview")}</TabsTrigger>
              <TabsTrigger value="raw">{t("tabRaw")}</TabsTrigger>
            </TabsList>
            <TabsContent value="preview">
              <div className="prose dark:prose-invert max-w-none max-h-[70vh] overflow-auto rounded-md bg-muted p-4">
                <Markdown remarkPlugins={[remarkGfm]}>{schemaDefinition.content}</Markdown>
              </div>
            </TabsContent>
            <TabsContent value="raw">
              <pre className="max-h-[70vh] overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
                {schemaDefinition.content}
              </pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
