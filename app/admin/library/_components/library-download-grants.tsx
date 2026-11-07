"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { grantLibraryDownload, revokeLibraryDownload } from "@/actions/library-files";

export type DownloadGrantItem = {
  id: string;
  userEmail: string;
  createdAt: string;
};

export function LibraryDownloadGrantsPanel({ bookId, grants }: { bookId: string; grants: DownloadGrantItem[] }) {
  const t = useTranslations("admin.library");
  const [email, setEmail] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = (operation: () => Promise<{ success: true } | { error: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await operation();
      if ("error" in result) setError(result.error);
      else window.location.reload();
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("grantsSection")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input dir="ltr" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("grantEmailLabel")} className="max-w-xs" />
          <Button type="button" variant="outline" disabled={pending || !email.trim()} onClick={() => run(() => grantLibraryDownload(bookId, email))}>
            {pending ? t("granting") : t("grant")}
          </Button>
        </div>
        {grants.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {grants.map((grant) => (
              <li key={grant.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="break-all" dir="ltr">{grant.userEmail}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{new Date(grant.createdAt).toLocaleDateString()}</span>
                  <Button type="button" variant="destructive" size="sm" disabled={pending} onClick={() => {
                    if (window.confirm(t("grantConfirmRevoke"))) run(() => revokeLibraryDownload(bookId, grant.id));
                  }}>
                    {t("grantRevoke")}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("grantsEmpty")}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
