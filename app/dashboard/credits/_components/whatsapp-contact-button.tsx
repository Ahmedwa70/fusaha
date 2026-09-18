import { MessageCircleIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export async function WhatsappContactButton({
  whatsappNumber,
  packageName,
  isBestValue,
  hasAccent = false,
}: {
  whatsappNumber: string;
  packageName: string;
  isBestValue: boolean;
  hasAccent?: boolean;
}) {
  const t = await getTranslations("dashboard.credits");
  const digits = whatsappNumber.replace(/[^0-9]/g, "");
  const message = `Hi, I'd like to purchase the "${packageName}" package.`;
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
