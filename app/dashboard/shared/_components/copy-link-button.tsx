"use client";

import { useState } from "react";
import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ token }: { token: string }) {
  const t = useTranslations("dashboard.shared");
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const shareUrl = `${window.location.origin}/l/${token}`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button size="sm" variant="ghost" className="gap-1.5" onClick={handleCopy}>
      {copied ? <CheckIcon data-icon="inline-start" /> : null}
      {copied ? t("linkCopied") : t("copyLink")}
    </Button>
  );
}
