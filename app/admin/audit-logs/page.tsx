import { getTranslations } from "next-intl/server";
import { getAuditLogs } from "@/lib/admin/queries/audit-log";
import { AuditLogsTable } from "@/app/admin/audit-logs/_components/audit-logs-table";
import { requirePermission } from "@/lib/auth/dal";
import { Permissions } from "@/constants/permissions";

export default async function AdminAuditLogsPage() {
  await requirePermission(Permissions.auditLogsList);
  const t = await getTranslations("admin.auditLogs");
  const auditLogs = await getAuditLogs();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("sectionTitle")}</h1>
        <p className="text-muted-foreground">{t("sectionDescription")}</p>
      </div>

      <AuditLogsTable auditLogs={auditLogs} />
    </div>
  );
}
