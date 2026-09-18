import "server-only";
import { db } from "@/lib/db";
import { auditLogs } from "@/database/schema";

// Records one admin audit-log entry. Never throws — a failure here must
// never break the primary admin action that triggered it.
export async function recordAuditLog(params: {
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  try {
    await db.insert(auditLogs).values({
      userId: params.userId,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      oldValues: params.oldValues ?? null,
      newValues: params.newValues ?? null,
    });
  } catch (error) {
    console.error("Failed to record audit log", error);
  }
}
