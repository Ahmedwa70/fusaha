"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { archiveLibraryBook, deleteLibraryBook, publishLibraryBook, unpublishLibraryBook } from "@/actions/library";
import { useTranslations } from "next-intl";

export function LibraryLifecycleActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("admin.library");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (operation: () => Promise<{ success: true; id?: string } | { error: string }>, confirmText: string) => {
    if (!window.confirm(confirmText)) return;
    setError(null);
    startTransition(async () => {
      const result = await operation();
      if ("error" in result) setError(result.error);
      else window.location.reload();
    });
  };
  return <div className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">{t("workflowTitle")}</h2><p className="text-sm text-muted-foreground">{t("workflowDescription")}</p>{error && <p className="text-sm text-destructive">{error}</p>}<div className="flex flex-wrap gap-2">{status !== "published" && status !== "archived" && <Button disabled={pending} onClick={() => run(() => publishLibraryBook(id), t("confirmPublish"))}>{t("publish")}</Button>}{status === "published" && <Button variant="outline" disabled={pending} onClick={() => run(() => unpublishLibraryBook(id), t("confirmUnpublish"))}>{t("unpublish")}</Button>}{status === "unpublished" && <Button variant="outline" disabled={pending} onClick={() => run(() => archiveLibraryBook(id), t("confirmArchive"))}>{t("archive")}</Button>}{status === "archived" && <Button variant="destructive" disabled={pending} onClick={() => run(() => deleteLibraryBook(id), t("confirmDelete"))}>{t("delete")}</Button>}</div></div>;
}
