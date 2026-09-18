"use client";

import { useState, useTransition } from "react";
import { CheckIcon, Share2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createShareLink, setShareLinkActive } from "@/actions/lessons";
import { LessonState } from "@/database/schema";

export function ShareLinkCard({
  lessonId,
  lessonState,
  shareLink,
}: {
  lessonId: string;
  lessonState: LessonState;
  shareLink: { token: string; active: boolean } | null;
}) {
  const t = useTranslations("dashboard.lessonDetail");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleCopy() {
    if (!shareLink) return;
    const shareUrl = `${window.location.origin}/l/${shareLink.token}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const result = await createShareLink(lessonId);
      if ("error" in result) setError(result.error);
    });
  }

  function handleToggle(active: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setShareLinkActive(lessonId, active);
      if ("error" in result) setError(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Share2Icon className="size-4" />
          {t("shareTitle")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {shareLink ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
            <span className="font-mono text-xs text-muted-foreground">/l/{shareLink.token}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={handleCopy}>
                {copied ? <CheckIcon data-icon="inline-start" /> : null}
                {copied ? t("linkCopied") : t("copyLink")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => handleToggle(!shareLink.active)} disabled={isPending}>
                {shareLink.active ? t("stopSharing") : t("startSharing")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">{t("noShareLink")}</p>
            <Button size="sm" onClick={handleCreate} disabled={lessonState !== LessonState.Approved || isPending}>
              {t("createShareLink")}
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
