import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { schemaDefinitions } from "@/database/schema";

export async function getSchemaDefinitions() {
  return db.select().from(schemaDefinitions).orderBy(schemaDefinitions.levelKey, desc(schemaDefinitions.createdAt));
}

export async function getSchemaDefinitionById(id: string) {
  const [row] = await db.select().from(schemaDefinitions).where(eq(schemaDefinitions.id, id)).limit(1);
  return row ?? null;
}

export async function getActiveSchemaDefinition(levelKey: string) {
  const [row] = await db
    .select()
    .from(schemaDefinitions)
    .where(and(eq(schemaDefinitions.levelKey, levelKey), eq(schemaDefinitions.active, true)))
    .limit(1);
  return row ?? null;
}

// Powers the "Create Lesson" wizard's level select (§4/§6): one active
// schema per level, unique(levelKey, version) plus this `active` filter
// means at most one row per level — so this list IS the current set of
// levels, with no hardcoded 1/2/3 anywhere. Admin adding a new level's first
// active schema makes it selectable here automatically.
export async function getActiveSchemaDefinitions() {
  return db
    .select()
    .from(schemaDefinitions)
    .where(eq(schemaDefinitions.active, true))
    .orderBy(schemaDefinitions.levelKey);
}
