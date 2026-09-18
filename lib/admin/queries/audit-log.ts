import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, users } from "@/database/schema";

export type AuditLogListItem = {
  id: string;
  userId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues: unknown;
  newValues: unknown;
  createdAt: Date;
};

// Audit logs can grow unboundedly (unlike the small admin tables elsewhere
// in this app) — cap at 200 rows, newest first, as a deliberate simple bound
// rather than a full pagination system.
export async function getAuditLogs(): Promise<AuditLogListItem[]> {
  const rows = await db
    .select({
      id: auditLogs.id,
      userId: auditLogs.userId,
      actorName: users.name,
      actorEmail: users.email,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      oldValues: auditLogs.oldValues,
      newValues: auditLogs.newValues,
      createdAt: auditLogs.createdAt,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(200);

  return rows;
}
