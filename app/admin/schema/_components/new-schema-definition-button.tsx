"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { SchemaDefinitionFormDialog } from "@/app/admin/schema/_components/schema-definition-form-dialog";

export function NewSchemaDefinitionButton({ templates }: { templates: { id: string; name: string }[] }) {
  const t = useTranslations("admin.schema");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <PlusIcon data-icon="inline-start" />
        {t("newVersion")}
      </Button>

      <SchemaDefinitionFormDialog
        open={open}
        onOpenChange={setOpen}
        initialLevel={{}}
        initialContent=""
        templates={templates}
      />
    </>
  );
}
