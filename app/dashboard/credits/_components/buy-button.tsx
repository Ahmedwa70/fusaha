"use client";

import { useState, useTransition } from "react";
import { Loader2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/actions/purchases";
import { loadPaddle } from "@/lib/paddle-client";
import { cn } from "@/lib/utils";

export function BuyButton({
  packageId,
  isBestValue,
  hasAccent = false,
}: {
  packageId: string;
  isBestValue: boolean;
  // When true, the package has an admin-configured strong accent color (set
  // as the --pkg-strong CSS var on the ancestor Card) that overrides the
  // default gold/outline styling — see credit-package-card.tsx.
  hasAccent?: boolean;
}) {
  const t = useTranslations("dashboard.credits");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex w-full flex-col gap-1">
      <Button
        size="sm"
        className={cn(
          "w-full gap-1.5 text-base font-bold",
          hasAccent && "border-0 bg-(--pkg-strong) text-white hover:bg-(--pkg-strong)",
          !hasAccent && isBestValue && "hover:bg-primary",
          !hasAccent && !isBestValue && "hover:bg-background hover:text-foreground dark:hover:bg-input/30"
        )}
        variant={hasAccent ? "default" : isBestValue ? "default" : "outline"}
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            const result = await createCheckoutSession(packageId);
            if ("error" in result) {
              setError(result.error);
              return;
            }
            try {
              await loadPaddle();
              window.Paddle?.Checkout.open({
                transactionId: result.transactionId,
                settings: { successUrl: `${window.location.origin}${window.location.pathname}?purchase=success` },
              });
            } catch {
              setError(t("errors.checkoutFailed"));
            }
          });
        }}
      >
        {isPending && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
        {t("buy")}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
