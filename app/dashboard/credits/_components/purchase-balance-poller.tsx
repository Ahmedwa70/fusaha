"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2Icon, Loader2Icon, ClockAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 5;

// The Paddle webhook credits the purchase asynchronously, so the redirect
// back to ?purchase=success can beat it. Poll a few times via router.refresh()
// until the server-rendered balance actually changes. Owns its own banner
// (rather than page.tsx rendering a static "success" message) so the
// teacher sees "processing" while we're still waiting, "success" once the
// balance actually moved, and a "delayed" fallback if it never does within
// the polling window — never a premature success claim.
export function PurchaseBalancePoller({ creditsBalance }: { creditsBalance: number }) {
  const t = useTranslations("dashboard.credits");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [initialBalance] = useState(creditsBalance);
  const [attempt, setAttempt] = useState(0);

  const showBanner = searchParams.get("purchase") === "success";
  const credited = creditsBalance !== initialBalance;
  const exhausted = attempt >= MAX_ATTEMPTS;
  const isPolling = showBanner && !credited && !exhausted;

  useEffect(() => {
    if (!isPolling) return;
    const timer = setTimeout(() => {
      router.refresh();
      setAttempt((a) => a + 1);
    }, POLL_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [isPolling, router]);

  if (!showBanner) return null;

  if (credited) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
        <CheckCircle2Icon className="size-4 shrink-0" />
        {t("purchaseSuccess")}
      </div>
    );
  }

  if (exhausted) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <ClockAlertIcon className="size-4 shrink-0" />
        {t("purchaseDelayed")}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
      <Loader2Icon className="size-4 shrink-0 animate-spin" />
      {t("purchaseProcessing")}
    </div>
  );
}
