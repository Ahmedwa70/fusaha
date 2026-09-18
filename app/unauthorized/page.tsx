import Link from "next/link";
import { ShieldAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";

export default async function UnauthorizedPage() {
  const t = await getTranslations("unauthorized");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlertIcon className="size-12 text-destructive" />
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="max-w-md text-muted-foreground">{t("description")}</p>
      <Link href={ROUTES.admin} className={buttonVariants()}>
        {t("backLink")}
      </Link>
    </main>
  );
}
