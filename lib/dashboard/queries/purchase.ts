import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { creditsLedgerEntries } from "@/database/schema";

export type LedgerEntryItem = {
  id: string;
  delta: number;
  reason: (typeof creditsLedgerEntries.$inferSelect)["reason"];
  createdAt: Date;
};

export async function getCreditsLedger(userId: string): Promise<LedgerEntryItem[]> {
  const rows = await db
    .select({
      id: creditsLedgerEntries.id,
      delta: creditsLedgerEntries.delta,
      reason: creditsLedgerEntries.reason,
      createdAt: creditsLedgerEntries.createdAt,
    })
    .from(creditsLedgerEntries)
    .where(eq(creditsLedgerEntries.userId, userId))
    .orderBy(desc(creditsLedgerEntries.createdAt))
    .limit(100);

  return rows;
}
