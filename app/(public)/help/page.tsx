import type { Metadata } from "next";
import { HelpBrowser } from "@/app/(public)/help/_components/help-browser";

export const metadata: Metadata = {
  title: "مركز المساعدة | فُصحاء",
  description: "إجابات وأدلة مختصرة لاستخدام أدوات فُصحاء وحل المشكلات الشائعة.",
};

export default function HelpPage() {
  return (
    <div dir="rtl" className="min-h-full bg-background text-foreground">
            <main className="mx-auto flex max-w-6xl flex-col gap-5 px-5 pb-16 pt-6 sm:px-8 lg:gap-6 lg:pb-24 lg:pt-10">
        <HelpBrowser />
      </main>
    </div>
  );
}
