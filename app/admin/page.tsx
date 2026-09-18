import { UsersIcon, BookOpenIcon, Loader2Icon, WalletIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { getTeachers } from "@/lib/admin/queries/teacher";

export default async function AdminPage() {
  const t = await getTranslations("admin.teachers");
  const teachers = await getTeachers();
  const totalTeachers = teachers.length;
  // Lessons/jobs/revenue aren't wired to real data yet — out of scope for
  // the teacher-management feature this overview currently serves.
  const totalLessons = 0;
  const pendingJobs = 0;
  const revenueThisMonth = 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageDescription")}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={UsersIcon} value={totalTeachers} label={t("statTeachers")} tint="bg-blue-50 text-blue-600" />
        <StatCard
          icon={BookOpenIcon}
          value={totalLessons}
          label={t("statLessons")}
          tint="bg-secondary text-secondary-foreground"
        />
        <StatCard
          icon={Loader2Icon}
          value={pendingJobs}
          label={t("statPendingJobs")}
          tint="bg-amber-50 text-amber-600"
        />
        <StatCard
          icon={WalletIcon}
          value={revenueThisMonth}
          label={t("statRevenue")}
          tint="bg-green-50 text-green-600"
          suffix=" ج.م"
        />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
  tint,
  suffix,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  tint: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
        <div className={`flex size-10 items-center justify-center rounded-full ${tint}`}>
          <Icon className="size-5" />
        </div>
        <p className="text-2xl font-bold">
          {value}
          {suffix}
        </p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
