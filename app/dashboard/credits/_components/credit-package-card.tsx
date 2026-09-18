import type { CSSProperties } from "react";
import { CheckIcon, CoinsIcon, SparklesIcon, ZapIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatPrice } from "@/lib/dashboard/format";
import type { CreditPackageOption } from "@/lib/dashboard/queries/credit-package";
import { BuyButton } from "./buy-button";
import { WhatsappContactButton } from "./whatsapp-contact-button";

// A package's own color (a single admin-set hex code) takes priority over
// the automatic "best value" gold styling — see credit-packages
// schema/validation. Every pale background tint (card, icon, the per-100
// box) is derived from this one strong/accent color via CSS color-mix
// rather than stored separately, so they always stay in the same hue
// family. --pkg-card-bg mixes with the theme's own card background (so it
// still adapts to light/dark mode); --pkg-tint-bg mixes with transparent so
// it layers over whatever it sits on (icon circle, the per-100 box).
function packageCssVars(pkg: CreditPackageOption): CSSProperties {
  const vars: Record<string, string> = {};
  if (pkg.colorDark) {
    vars["--pkg-strong"] = pkg.colorDark;
    vars["--pkg-card-bg"] = `color-mix(in srgb, ${pkg.colorDark} 4%, var(--card))`;
    vars["--pkg-tint-bg"] = `color-mix(in srgb, ${pkg.colorDark} 12%, transparent)`;
  }
  return vars as CSSProperties;
}

export async function CreditPackageCard({
  pkg,
  isBestValue,
  pricePerHundredCents,
  savingsPercent,
  autoPaymentEnabled,
  whatsappContactNumber,
}: {
  pkg: CreditPackageOption;
  isBestValue: boolean;
  pricePerHundredCents: number;
  savingsPercent: number;
  autoPaymentEnabled: boolean;
  whatsappContactNumber: string;
}) {
  const t = await getTranslations("dashboard.credits");
  const hasAccent = !!pkg.colorDark;
  const showAutoBadge = isBestValue && !pkg.badgeLabel;
  const showCustomBadge = !!pkg.badgeLabel;
  const cardStyle: CSSProperties = {
    ...packageCssVars(pkg),
    ...(hasAccent ? { backgroundColor: "var(--pkg-card-bg)" } : {}),
  };

  return (
    <Card
      style={cardStyle}
      className={cn(
        "relative overflow-visible py-3 transition-shadow hover:shadow-md",
        hasAccent && "border-(--pkg-strong) shadow-sm ring-1 ring-(--pkg-strong)",
        !hasAccent && isBestValue && "border-gold-400 shadow-sm ring-1 ring-gold-400"
      )}
    >
      {showCustomBadge && (
        <Badge
          style={hasAccent ? { backgroundColor: "var(--pkg-strong)", color: "white" } : undefined}
          className={cn(
            "absolute -top-2.5 inset-s-1/2 -translate-x-1/2 gap-1 text-[10px] sm:-top-3 sm:text-xs rtl:translate-x-1/2",
            !hasAccent && "bg-blue-500 text-white"
          )}
        >
          <SparklesIcon data-icon="inline-start" />
          {pkg.badgeLabel}
        </Badge>
      )}
      {showAutoBadge && (
        <Badge className="absolute -top-2.5 inset-s-1/2 -translate-x-1/2 gap-1 bg-gold-500 text-[10px] text-gold-900 sm:-top-3 sm:text-xs rtl:translate-x-1/2">
          <SparklesIcon data-icon="inline-start" />
          {t("bestValue")}
        </Badge>
      )}

      <CardContent className="flex flex-col items-center gap-3 text-center">
        <div
          className={cn(
            "flex size-9 items-center justify-center rounded-full sm:size-11",
            hasAccent ? "bg-(--pkg-tint-bg) text-(--pkg-strong)" : "bg-gold-100 text-gold-700"
          )}
        >
          <ZapIcon className="size-4 sm:size-5" />
        </div>

        <div>
          <p className="text-2xl font-bold tabular-nums sm:text-3xl">{pkg.creditsAmount}</p>
          <p className="text-sm font-semibold text-muted-foreground sm:text-base">{t("creditsUnit")}</p>
        </div>

        <p
          className={cn(
            "text-lg font-bold tabular-nums sm:text-2xl",
            hasAccent ? "text-(--pkg-strong)" : "text-gold-700"
          )}
        >
          {formatPrice(pkg.price, pkg.currency)}
        </p>

        <Separator className="w-10" />

        <div>
          <p className={cn("text-base font-bold sm:text-lg", hasAccent ? "text-(--pkg-strong)" : "text-gold-700")}>
            {pkg.name}
          </p>
          {pkg.subtitle && <p className="text-xs font-semibold text-muted-foreground sm:text-sm">{pkg.subtitle}</p>}
        </div>

        {pkg.features.length > 0 && (
          <ul className="w-full space-y-2.5 rounded-lg border border-black/10 p-3 text-start text-sm font-semibold sm:text-base">
            {pkg.features.map((feature, index) => (
              <li key={index} className="flex items-center gap-2.5">
                <span
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full",
                    hasAccent ? "bg-(--pkg-strong) text-white" : "bg-gold-600 text-white"
                  )}
                >
                  <CheckIcon className="size-3.5" />
                </span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        )}

        <div
          className={cn(
            "flex w-full items-stretch overflow-hidden rounded-lg text-base",
            hasAccent ? "bg-(--pkg-tint-bg)" : "bg-muted/50"
          )}
        >
          <div className="flex flex-1 items-center justify-center gap-2 px-2.5 py-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full",
                hasAccent ? "bg-(--pkg-strong)/15 text-(--pkg-strong)" : "bg-gold-200 text-gold-700"
              )}
            >
              <CoinsIcon className="size-4" />
            </span>
            <div className="text-start">
              <p className="font-bold tabular-nums">{formatPrice(pricePerHundredCents, pkg.currency)}</p>
              <p className="text-xs text-muted-foreground">{t("perHundredUnit")}</p>
            </div>
          </div>

          {savingsPercent > 0 && (
            <>
              <Separator orientation="vertical" className={hasAccent ? "bg-(--pkg-strong)/20" : undefined} />
              <div className="flex flex-1 flex-col items-center justify-center px-2.5 py-2">
                <p className={cn("font-bold tabular-nums", hasAccent ? "text-(--pkg-strong)" : "text-gold-700")}>
                  {t("savingsPercent", { percent: savingsPercent })}
                </p>
                <p className="text-xs text-muted-foreground">{t("savingsCompare")}</p>
              </div>
            </>
          )}
        </div>

        {autoPaymentEnabled ? (
          <BuyButton packageId={pkg.id} isBestValue={isBestValue} hasAccent={hasAccent} />
        ) : (
          <WhatsappContactButton
            whatsappNumber={whatsappContactNumber}
            packageName={pkg.name}
            isBestValue={isBestValue}
            hasAccent={hasAccent}
          />
        )}

        {pkg.footerText && <p className="text-sm font-semibold text-muted-foreground">{pkg.footerText}</p>}
      </CardContent>
    </Card>
  );
}
