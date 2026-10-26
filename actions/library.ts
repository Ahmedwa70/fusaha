"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { db } from "@/lib/db";
import { libraryBooks } from "@/database/schema";
import { Permissions } from "@/constants/permissions";
import { requirePermission } from "@/lib/auth/dal";
import { recordAuditLog } from "@/lib/admin/audit-log";
import { createLibraryBookSchema, publishLibraryBookSchema, type CreateLibraryBookValues } from "@/validation/library-books";

export type LibraryActionState = { success: true; id?: string } | { error: string };

type LibraryBookInput = CreateLibraryBookValues;

const libraryPath = "/admin/library";

async function errorMessage(key: "invalidData" | "notFound" | "duplicateSlug" | "cannotPublish" | "cannotArchive" | "cannotUnpublish" | "cannotDelete" | "unexpected") {
  const t = await getTranslations("admin.library.errors");
  return t(key);
}

function auditValues(values: Record<string, unknown>) {
  return {
    slug: values.slug,
    originalTitle: values.originalTitle,
    publicationYear: values.publicationYear,
    category: values.category,
    publicationStatus: values.publicationStatus,
    reviewStatus: values.reviewStatus,
  };
}

export async function createLibraryBook(data: LibraryBookInput): Promise<LibraryActionState> {
  const admin = await requirePermission(Permissions.libraryCreate);
  const parsed = createLibraryBookSchema.safeParse(data);
  if (!parsed.success) return { error: await errorMessage("invalidData") };

  try {
    const [created] = await db.insert(libraryBooks).values({ ...parsed.data, createdBy: admin.id, updatedBy: admin.id }).returning({ id: libraryBooks.id });
    await recordAuditLog({ userId: admin.id, action: Permissions.libraryCreate, resourceType: "library-book", resourceId: created.id, newValues: auditValues(parsed.data as unknown as Record<string, unknown>) });
    revalidatePath(libraryPath);
    revalidatePath(`${libraryPath}/new`);
    return { success: true, id: created.id };
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) return { error: await errorMessage("duplicateSlug") };
    console.error("[v0] Failed to create library book", error);
    return { error: await errorMessage("unexpected") };
  }
}

export async function updateLibraryBook(id: string, data: LibraryBookInput): Promise<LibraryActionState> {
  const admin = await requirePermission(Permissions.libraryUpdate);
  const parsed = createLibraryBookSchema.safeParse(data);
  if (!parsed.success) return { error: await errorMessage("invalidData") };

  const [existing] = await db.select().from(libraryBooks).where(eq(libraryBooks.id, id)).limit(1);
  if (!existing) return { error: await errorMessage("notFound") };
  if (existing.publicationStatus === "archived") return { error: await errorMessage("cannotArchive") };

  try {
    const [updated] = await db.update(libraryBooks).set({ ...parsed.data, updatedBy: admin.id, updatedAt: new Date() }).where(and(eq(libraryBooks.id, id), eq(libraryBooks.updatedAt, existing.updatedAt))).returning({ id: libraryBooks.id });
    if (!updated) return { error: await errorMessage("unexpected") };
    await recordAuditLog({ userId: admin.id, action: Permissions.libraryUpdate, resourceType: "library-book", resourceId: id, oldValues: auditValues(existing as unknown as Record<string, unknown>), newValues: auditValues(parsed.data as unknown as Record<string, unknown>) });
    revalidatePath(libraryPath);
    revalidatePath(`${libraryPath}/${id}`);
    return { success: true, id };
  } catch (error) {
    if (error instanceof Error && /unique/i.test(error.message)) return { error: await errorMessage("duplicateSlug") };
    console.error("[v0] Failed to update library book", error);
    return { error: await errorMessage("unexpected") };
  }
}

export async function publishLibraryBook(id: string): Promise<LibraryActionState> {
  const admin = await requirePermission(Permissions.libraryPublish);
  const [existing] = await db.select().from(libraryBooks).where(eq(libraryBooks.id, id)).limit(1);
  if (!existing) return { error: await errorMessage("notFound") };
  const parsed = publishLibraryBookSchema.safeParse({
    ...existing,
    publisher: existing.publisher ?? undefined,
    publicationYear: existing.publicationYear ?? undefined,
    isbn: existing.isbn ?? undefined,
    longDescription: existing.longDescription ?? undefined,
    accessNotes: existing.accessNotes ?? undefined,
    coverUrl: existing.coverUrl ?? undefined,
    coverAlt: existing.coverAlt ?? undefined,
  });
  if (!parsed.success || parsed.data.accessStatus === "unknown") return { error: await errorMessage("cannotPublish") };

  const now = new Date();
  const [published] = await db.update(libraryBooks).set({ publicationStatus: "published", reviewStatus: "verified", publishedAt: now, updatedBy: admin.id, updatedAt: now }).where(and(eq(libraryBooks.id, id), eq(libraryBooks.updatedAt, existing.updatedAt))).returning({ id: libraryBooks.id });
  if (!published) return { error: await errorMessage("unexpected") };
  await recordAuditLog({ userId: admin.id, action: Permissions.libraryPublish, resourceType: "library-book", resourceId: id, oldValues: auditValues(existing as unknown as Record<string, unknown>), newValues: { publicationStatus: "published", reviewStatus: "verified", publishedAt: now.toISOString() } });
  revalidatePath(libraryPath);
  revalidatePath(`${libraryPath}/${id}`);
  return { success: true, id };
}

export async function unpublishLibraryBook(id: string): Promise<LibraryActionState> {
  const admin = await requirePermission(Permissions.libraryUnpublish);
  const [existing] = await db.select({ publicationStatus: libraryBooks.publicationStatus, reviewStatus: libraryBooks.reviewStatus, publishedAt: libraryBooks.publishedAt }).from(libraryBooks).where(eq(libraryBooks.id, id)).limit(1);
  if (!existing) return { error: await errorMessage("notFound") };
  const [updated] = await db.update(libraryBooks).set({ publicationStatus: "unpublished", updatedBy: admin.id, updatedAt: new Date() }).where(and(eq(libraryBooks.id, id), eq(libraryBooks.publicationStatus, "published"))).returning({ id: libraryBooks.id });
  if (!updated) return { error: await errorMessage("cannotUnpublish") };
  await recordAuditLog({ userId: admin.id, action: Permissions.libraryUnpublish, resourceType: "library-book", resourceId: id, oldValues: auditValues(existing as unknown as Record<string, unknown>), newValues: { publicationStatus: "unpublished" } });
  revalidatePath(libraryPath);
  revalidatePath(`${libraryPath}/${id}`);
  return { success: true, id };
}

export async function archiveLibraryBook(id: string): Promise<LibraryActionState> {
  const admin = await requirePermission(Permissions.libraryUpdate);
  const [existing] = await db.select({ publicationStatus: libraryBooks.publicationStatus, reviewStatus: libraryBooks.reviewStatus }).from(libraryBooks).where(eq(libraryBooks.id, id)).limit(1);
  if (!existing) return { error: await errorMessage("notFound") };
  const [updated] = await db.update(libraryBooks).set({ publicationStatus: "archived", updatedBy: admin.id, updatedAt: new Date() }).where(and(eq(libraryBooks.id, id), eq(libraryBooks.publicationStatus, "unpublished"))).returning({ id: libraryBooks.id });
  if (!updated) return { error: await errorMessage("cannotArchive") };
  await recordAuditLog({ userId: admin.id, action: Permissions.libraryUpdate, resourceType: "library-book", resourceId: id, oldValues: auditValues(existing as unknown as Record<string, unknown>), newValues: { publicationStatus: "archived" } });
  revalidatePath(libraryPath);
  revalidatePath(`${libraryPath}/${id}`);
  return { success: true, id };
}

export async function deleteLibraryBook(id: string): Promise<LibraryActionState> {
  const admin = await requirePermission(Permissions.libraryDelete);
  const [existing] = await db.select({ slug: libraryBooks.slug, publicationStatus: libraryBooks.publicationStatus }).from(libraryBooks).where(eq(libraryBooks.id, id)).limit(1);
  if (!existing) return { error: await errorMessage("notFound") };
  if (existing.publicationStatus !== "archived") return { error: await errorMessage("cannotDelete") };
  await db.delete(libraryBooks).where(eq(libraryBooks.id, id));
  await recordAuditLog({ userId: admin.id, action: Permissions.libraryDelete, resourceType: "library-book", resourceId: id, oldValues: existing });
  revalidatePath(libraryPath);
  return { success: true, id };
}
