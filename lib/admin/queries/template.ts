import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { templates } from "@/database/schema";

export async function getTemplates() {
  return db.select().from(templates).orderBy(desc(templates.createdAt));
}

export async function getTemplateById(id: string) {
  const [row] = await db.select().from(templates).where(eq(templates.id, id)).limit(1);
  return row ?? null;
}

export async function getActiveTemplates() {
  return db.select().from(templates).where(eq(templates.active, true)).orderBy(templates.name);
}
