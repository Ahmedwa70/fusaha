"use client";

import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { dateFormatter } from "@/lib/dashboard/format";
import { PERMISSION_TRANSLATION_KEYS } from "@/constants/permissions";
import type { AuditLogListItem } from "@/lib/admin/queries/audit-log";
import { InfoField } from "@/components/shared/info-field";

type DiffRow = { field: string; before: unknown; after: unknown };

// The "id" key is redundant here — resourceType + the actor/timestamp fields
// above already identify the row, and raw ids aren't meaningful to a reader.
function buildDiffRows(
  oldValues: Record<string, unknown> | null,
  newValues: Record<string, unknown> | null
): DiffRow[] {
  const keys = new Set([...Object.keys(oldValues ?? {}), ...Object.keys(newValues ?? {})]);
  keys.delete("id");
  return Array.from(keys).map((field) => ({
    field,
    before: oldValues?.[field],
    after: newValues?.[field],
  }));
}

function formatDiffValue(value: unknown, emptyValue: string): string {
  if (value === null || value === undefined) return emptyValue;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AuditLogViewDialog({
  auditLog,
  onOpenChange,
}: {
  auditLog: AuditLogListItem | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("admin.auditLogs");
  const tPermissions = useTranslations("admin.permissions");

  const translationKey = auditLog ? PERMISSION_TRANSLATION_KEYS[auditLog.action] : undefined;
  const actionLabel = auditLog ? (translationKey ? tPermissions(translationKey) : auditLog.action) : "";

  const oldValues = (auditLog?.oldValues as Record<string, unknown> | null) ?? null;
  const newValues = (auditLog?.newValues as Record<string, unknown> | null) ?? null;
  const isUpdate = oldValues !== null && newValues !== null;
  const rows = auditLog ? buildDiffRows(oldValues, newValues) : [];

  return (
    <Dialog open={!!auditLog} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("viewDialogTitle")}</DialogTitle>
        </DialogHeader>

        {auditLog && (
          <>
            <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
              <InfoField label={t("fieldAction")} value={actionLabel} />
              <InfoField label={t("fieldResourceType")} value={auditLog.resourceType} />
              <InfoField
                label={t("fieldActor")}
                value={auditLog.userId === null ? t("systemActor") : `${auditLog.actorName} · ${auditLog.actorEmail}`}
              />
              <InfoField label={t("fieldCreatedAt")} value={dateFormatter.format(auditLog.createdAt)} />
            </div>

            {rows.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                  {isUpdate ? t("changesTitle") : newValues ? t("fieldNewValues") : t("fieldOldValues")}
                </p>
                <div className="rounded-md border">
                  <Table className="table-fixed">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%] whitespace-normal">{t("columnField")}</TableHead>
                        {isUpdate ? (
                          <>
                            <TableHead className="w-[35%] whitespace-normal">{t("columnBefore")}</TableHead>
                            <TableHead className="w-[35%] whitespace-normal">{t("columnAfter")}</TableHead>
                          </>
                        ) : (
                          <TableHead className="w-[70%] whitespace-normal">{t("columnValue")}</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => {
                        const changed = isUpdate && JSON.stringify(row.before) !== JSON.stringify(row.after);
                        return (
                          <TableRow key={row.field} className={changed ? "bg-primary/5" : undefined}>
                            <TableCell className="whitespace-normal wrap-break-word font-medium">
                              {row.field}
                            </TableCell>
                            {isUpdate ? (
                              <>
                                <TableCell className="whitespace-normal wrap-break-word text-muted-foreground">
                                  {formatDiffValue(row.before, t("emptyValue"))}
                                </TableCell>
                                <TableCell className="whitespace-normal wrap-break-word">
                                  {formatDiffValue(row.after, t("emptyValue"))}
                                </TableCell>
                              </>
                            ) : (
                              <TableCell className="whitespace-normal wrap-break-word">
                                {formatDiffValue(row.before ?? row.after, t("emptyValue"))}
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
