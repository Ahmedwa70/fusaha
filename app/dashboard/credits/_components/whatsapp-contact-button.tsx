import { MessageCircleIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { formatPrice } from "@/lib/dashboard/format";
import type { Locale } from "@/i18n/config";
import { cn } from "@/lib/utils";

// Pre-filled purchase request sent over WhatsApp: package name, credit
// amount and price, so support can match the message to a credit_packages
// row without asking the teacher for details. Credits are only added by the
// admin after payment is confirmed — this link starts a manual conversation.
// Kept as a per-locale template here (rather than in messages/*.json) because
// it is a single fixed operational string; it must stay in sync with the
// sending teacher's UI locale, not the support agent's.
const WHATSAPP_PURCHASE_TEMPLATES: Record<Locale, string> = {
  ar: "مرحبًا، أريد شراء باقة «{name}» ({credits} رصيد بسعر {price}).",
  en: 'Hi, I\'d like to purchase the "{name}" package ({credits} credits for {price}).',
  zh: "你好，我想购买「{name}」套餐（{credits}积分，价格{price}）。",
};

export async function WhatsappContactButton({
  whatsappNumber,
  packageName,
  creditsAmount,
  priceCents,
  currency,
  isBestValue,
  hasAccent = false,
}: {
  whatsappNumber: string;
  packageName: string;
  creditsAmount: number;
  priceCents: number;
  currency: string;
  isBestValue: boolean;
  hasAccent?: boolean;
}) {
  const t = await getTranslations("dashboard.credits");
  const locale = (await getLocale()) as Locale;
  const digits = whatsappNumber.replace(/[^0-9]/g, "");
  const message = WHATSAPP_PURCHASE_TEMPLATES[locale]
    .replace("{name}", packageName)
    .replace("{credits}", String(creditsAmount))
    .replace("{price}", formatPrice(priceCents, currency));
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        buttonVariants({ size: "sm", variant: hasAccent ? "default" : isBestValue ? "default" : "outline" }),
        "w-full gap-1.5 text-base font-bold",
        hasAccent && "border-0 bg-(--pkg-strong) text-white hover:bg-(--pkg-strong)",
        !hasAccent && isBestValue && "hover:bg-primary",
        !hasAccent && !isBestValue && "hover:bg-background hover:text-foreground dark:hover:bg-input/30"
      )}
    >
      <MessageCircleIcon data-icon="inline-start" />
      {t("contactToBuy")}
    </a>
  );
}
