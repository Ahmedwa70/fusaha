import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { CoinsIcon } from "lucide-react";
import { CreateLessonWizard } from "@/app/dashboard/create/_components/create-lesson-wizard";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription, EmptyContent } from "@/components/ui/empty";
import { buttonVariants } from "@/components/ui/button";
import { getActiveSchemaDefinitions } from "@/lib/admin/queries/schema-definition";
import { getGenerationCost } from "@/lib/admin/settings";
import { resolveLevelLabel } from "@/lib/schema-definitions";
import { requireTeacher } from "@/lib/auth/dal";
import { ROUTES } from "@/constants/routes";
import type { Locale } from "@/i18n/config";

export default async function CreateLessonPage() {
  const t = await getTranslations("dashboard.create");
  const locale = (await getLocale()) as Locale;
  const teacher = await requireTeacher();
  const generationCost = await getGenerationCost();
  const hasEnoughCredits = teacher.creditsBalance >= generationCost;
  const schemaDefinitions = hasEnoughCredits ? await getActiveSchemaDefinitions() : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageDescription")}</p>
      </div>

      {hasEnoughCredits ? (
        <CreateLessonWizard
          levelOptions={schemaDefinitions.map((s) => ({ id: s.id, level: resolveLevelLabel(s.level, locale) }))}
          generationCost={generationCost}
        />
      ) : (
        <Card className="mx-auto max-w-md">
          <CardContent>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CoinsIcon />
                </EmptyMedia>
                <EmptyTitle className="text-lg">{t("insufficientCreditsTitle")}</EmptyTitle>
                <EmptyDescription className="text-base/relaxed">
                  {t("insufficientCreditsDescription", { balance: teacher.creditsBalance, cost: generationCost })}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Link href={ROUTES.dashboardCredits} className={buttonVariants()}>
                  {t("insufficientCreditsCta")}
                </Link>
              </EmptyContent>
            </Empty>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
