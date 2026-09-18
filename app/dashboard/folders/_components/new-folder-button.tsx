"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FolderPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FolderFormDialog } from "./folder-form-dialog";

export function NewFolderButton() {
  const t = useTranslations("dashboard.folders");
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" className="gap-1.5" onClick={() => setOpen(true)}>
        <FolderPlusIcon data-icon="inline-start" />
        {t("newFolder")}
      </Button>

      <FolderFormDialog mode="create" open={open} onOpenChange={setOpen} />
    </>
  );
}
