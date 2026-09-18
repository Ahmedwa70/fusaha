"use client";

import { PencilIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { dateFormatter } from "@/lib/dashboard/format";
import { InfoField } from "@/components/shared/info-field";
import { StatusBadge } from "@/components/shared/status-badge";
import type { templates } from "@/database/schema";

type TemplateRow = typeof templates.$inferSelect;

export function TemplateViewDialog({
  template,
  onOpenChange,
  onEdit,
}: {
  template: TemplateRow | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (template: TemplateRow) => void;
}) {
  const t = useTranslations("admin.templates");

  return (
    <Dialog open={!!template} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("viewDialogTitle")}</DialogTitle>
        </DialogHeader>

        {template && (
          <>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <InfoField label={t("fieldName")} value={template.name} />
              <InfoField label={t("fieldActive")} value={<StatusBadge active={template.active} />} />
              <InfoField label={t("fieldCreatedAt")} value={dateFormatter.format(template.createdAt)} />
              <InfoField label={t("fieldUpdatedAt")} value={dateFormatter.format(template.updatedAt)} />
            </div>

            {template.previewImage && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {t("fieldPreviewImage")}
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, next/image doesn't support it */}
                <img src={template.previewImage} alt={template.name} className="max-h-64 rounded-md border" />
              </div>
            )}

            <Tabs defaultValue="htmlPlayer">
              <TabsList>
                <TabsTrigger value="htmlPlayer">{t("fieldHtmlPlayer")}</TabsTrigger>
                <TabsTrigger value="blueprint">{t("fieldBlueprint")}</TabsTrigger>
                <TabsTrigger value="validationScript">{t("fieldValidationScript")}</TabsTrigger>
              </TabsList>
              <TabsContent value="htmlPlayer">
                <pre className="max-h-[50vh] overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
                  {template.htmlPlayer}
                </pre>
              </TabsContent>
              <TabsContent value="blueprint">
                <pre className="max-h-[50vh] overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
                  {template.blueprint}
                </pre>
              </TabsContent>
              <TabsContent value="validationScript">
                <pre className="max-h-[50vh] overflow-auto rounded-md bg-muted p-4 text-sm whitespace-pre-wrap">
                  {template.validationScript}
                </pre>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button variant="outline" onClick={() => onEdit(template)}>
                <PencilIcon data-icon="inline-start" />
                {t("actionEdit")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
