"use client";

import { PencilIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { dateFormatter, formatPrice } from "@/lib/dashboard/format";
import { resolveLocalizedText } from "@/lib/localized-text";
import type { Locale } from "@/i18n/config";
import type { CreditPackageListItem } from "@/lib/admin/queries/credit-package";
import { InfoField } from "@/components/shared/info-field";
import { StatusBadge } from "@/components/shared/status-badge";

export function CreditPackageViewDialog({
  creditPackage,
  onOpenChange,
  onEdit,
}: {
  creditPackage: CreditPackageListItem | null;
  onOpenChange: (open: boolean) => void;
  onEdit: (creditPackage: CreditPackageListItem) => void;
}) {
  const t = useTranslations("admin.creditPackages");
  const locale = useLocale() as Locale;

  return (
    <Dialog open={!!creditPackage} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("viewDialogTitle")}</DialogTitle>
        </DialogHeader>

        {creditPackage && (
          <>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <InfoField label={t("fieldName")} value={resolveLocalizedText(creditPackage.name, locale)} />
              <InfoField label={t("fieldCreditsAmount")} value={creditPackage.creditsAmount} />
              <InfoField label={t("fieldPrice")} value={formatPrice(creditPackage.price, creditPackage.currency)} />
              <InfoField label={t("fieldPaddlePriceId")} value={creditPackage.paddlePriceId ?? "—"} />
              <InfoField label={t("columnStatus")} value={<StatusBadge active={creditPackage.active} />} />
              <InfoField label={t("fieldCreatedAt")} value={dateFormatter.format(creditPackage.createdAt)} />
              <InfoField label={t("fieldBadgeLabel")} value={resolveLocalizedText(creditPackage.badgeLabel, locale) || "—"} />
              <InfoField label={t("fieldSubtitle")} value={resolveLocalizedText(creditPackage.subtitle, locale) || "—"} />
              <InfoField label={t("fieldFooterText")} value={resolveLocalizedText(creditPackage.footerText, locale) || "—"} />
              <InfoField
                label={t("fieldColorDark")}
                value={
                  creditPackage.colorDark ? (
                    <span className="flex items-center gap-2">
                      <span
                        className="size-4 shrink-0 rounded-full border border-border"
                        style={{ backgroundColor: creditPackage.colorDark }}
                      />
                      {creditPackage.colorDark}
                    </span>
                  ) : (
                    "—"
                  )
                }
              />
            </div>

            {creditPackage.features.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium text-muted-foreground">{t("fieldFeatures")}</p>
                <ul className="list-inside list-disc space-y-1 text-sm">
                  {creditPackage.features.map((feature, index) => (
                    <li key={index}>{resolveLocalizedText(feature, locale)}</li>
                  ))}
                </ul>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onEdit(creditPackage)}>
                <PencilIcon data-icon="inline-start" />
                {t("actionEdit")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
