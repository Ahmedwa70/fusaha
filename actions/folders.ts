"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { folders } from "@/database/schema";
import { requireTeacher } from "@/lib/auth/dal";
import { createFolderSchema, type CreateFolderValues } from "@/validation/folders";

export type FolderActionState = { error: string } | { success: true };

export async function createFolder(data: CreateFolderValues): Promise<FolderActionState> {
  const teacher = await requireTeacher();

  const tValidation = await getTranslations("validation.folders");
  const tErrors = await getTranslations("dashboard.folders.errors");
  const parsed = createFolderSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };

  await db.insert(folders).values({ ownerId: teacher.id, name: parsed.data.name });

  revalidatePath("/dashboard/folders");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateFolder(id: string, data: CreateFolderValues): Promise<FolderActionState> {
  const teacher = await requireTeacher();

  const tValidation = await getTranslations("validation.folders");
  const tErrors = await getTranslations("dashboard.folders.errors");
  const parsed = createFolderSchema(tValidation).safeParse(data);
  if (!parsed.success) return { error: tErrors("invalidData") };

  const [existing] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.ownerId, teacher.id)))
    .limit(1);
  if (!existing) return { error: tErrors("notFound") };

  await db.update(folders).set({ name: parsed.data.name }).where(eq(folders.id, id));

  revalidatePath("/dashboard/folders");
  revalidatePath(`/dashboard/folders/${id}`);
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteFolder(id: string): Promise<FolderActionState> {
  const teacher = await requireTeacher();

  const tErrors = await getTranslations("dashboard.folders.errors");
  const [existing] = await db
    .select({ id: folders.id })
    .from(folders)
    .where(and(eq(folders.id, id), eq(folders.ownerId, teacher.id)))
    .limit(1);
  if (!existing) return { error: tErrors("notFound") };

  // lessons.folder_id is ON DELETE SET NULL, so lessons in this folder are
  // kept and simply become unfiled rather than deleted.
  await db.delete(folders).where(eq(folders.id, id));

  revalidatePath("/dashboard/folders");
  revalidatePath("/dashboard");
  return { success: true };
}
