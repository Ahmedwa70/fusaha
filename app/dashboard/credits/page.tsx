import { getTranslations } from "next-intl/server";
import { CoinsIcon, HistoryIcon, PackageIcon, XCircleIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { requireTeacher } from "@/lib/auth/dal";
import { getAutoPaymentEnabled, getWhatsappContactNumber } from "@/lib/admin/settings";
import { getActiveCreditPackages } from "@/lib/dashboard/queries/credit-package";
import { getCreditsLedger } from "@/lib/dashboard/queries/purchase";
import { dateFormatter } from "@/lib/dashboard/format";
import { CreditPackageCard } from "./_components/credit-package-card";
import { PurchaseBalancePoller } from "./_components/purchase-balance-poller";

export default async function CreditsPage({
  searchParams,
}: {
  searchParams: Promise<{ purchase?: string }>;
}) {
  const t = await getTranslations("dashboard.credits");
  const teacher = await requireTeacher();
  const [packages, ledger, { purchase }, autoPaymentEnabled, whatsappContactNumber] = await Promise.all([
    getActiveCreditPackages(),
    getCreditsLedger(teacher.id),
    searchParams,
    getAutoPaymentEnabled(),
    getWhatsappContactNumber(),
  ]);

  // "Best value" and the per-package savings % are both derived from the
  // real numbers (cost per credit), not admin-set — with 0-1 packages
  // there's nothing to compare against, and the savings baseline is the
  // package with the worst (highest) per-credit price.
  const pricePerCredit = (pkg: (typeof packages)[number]) => pkg.price / pkg.creditsAmount;
  const bestValueId =
    packages.length > 1 ? packages.reduce((best, pkg) => (pricePerCredit(pkg) < pricePerCredit(best) ? pkg : best)).id : null;
  const worstPricePerCredit =
    packages.length > 1 ? Math.max(...packages.map(pricePerCredit)) : (packages[0]?.price ?? 0) / (packages[0]?.creditsAmount || 1);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">{t("pageTitle")}</h1>
        <p className="text-sm text-muted-foreground sm:text-base">{t("pageDescription")}</p>
      </div>

      {purchase === "success" && <PurchaseBalancePoller creditsBalance={teacher.creditsBalance} />}
      {purchase === "cancelled" && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <XCircleIcon className="size-4 shrink-0" />
          {t("purchaseCancelled")}
        </div>
      )}

      <Card>
        <CardContent className="flex items-center gap-3 sm:gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700 sm:size-12">
            <CoinsIcon className="size-5 sm:size-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">{t("currentBalance")}</p>
            <p className="text-2xl font-bold tabular-nums sm:text-3xl">
              {teacher.creditsBalance} {t("creditsUnit")}
            </p>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 font-semibold">{t("packagesTitle")}</h2>
        {packages.length === 0 ? (
          <Card>
            <CardContent>
              <Empty>
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <PackageIcon />
                  </EmptyMedia>
                  <EmptyTitle>{t("noPackagesTitle")}</EmptyTitle>
                  <EmptyDescription>{t("noPackagesDescription")}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">
            {packages.map((pkg) => {
              const isBestValue = pkg.id === bestValueId;
              const pkgPricePerCredit = pricePerCredit(pkg);
              const savingsPercent =
                worstPricePerCredit > 0 ? Math.round((1 - pkgPricePerCredit / worstPricePerCredit) * 100) : 0;
              return (
                <CreditPackageCard
                  key={pkg.id}
                  pkg={pkg}
                  isBestValue={isBestValue}
                  pricePerHundredCents={(pkg.price * 100) / pkg.creditsAmount}
                  savingsPercent={savingsPercent}
                  autoPaymentEnabled={autoPaymentEnabled}
                  whatsappContactNumber={whatsappContactNumber}
                />
              );
            })}
          </div>
        )}
      </div>

      <Card>
        <CardContent>
          {ledger.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HistoryIcon />
                </EmptyMedia>
                <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnDate")}</TableHead>
                  <TableHead>{t("columnReason")}</TableHead>
                  <TableHead className="text-end">{t("columnAmount")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledger.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">{dateFormatter.format(entry.createdAt)}</TableCell>
                    <TableCell>{t(`ledgerReason.${entry.reason}`)}</TableCell>
                    <TableCell
                      className={cn(
                        "text-end font-medium tabular-nums",
                        entry.delta >= 0 ? "text-green-700" : "text-destructive"
                      )}
                    >
                      {entry.delta >= 0 ? "+" : ""}
                      {entry.delta}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
