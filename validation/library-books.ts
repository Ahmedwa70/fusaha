import { z } from "zod";
import { locales, type Locale } from "@/i18n/config";

const urlSchema = z.string().trim().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}, "Only HTTP and HTTPS URLs are allowed");

type LocalizedInput = Record<Locale, string>;

function localizedShape() {
  return z.object(
    Object.fromEntries(locales.map((locale) => [locale, z.string().trim()])) as Record<Locale, z.ZodString>
  );
}

function requiredLocalizedText(message: string) {
  return localizedShape().superRefine((value, ctx) => {
    for (const locale of locales) {
      if (!value[locale]) ctx.addIssue({ code: "custom", path: [locale], message });
    }
  });
}

function optionalLocalizedText() {
  return z.record(z.enum(locales), z.string().trim().min(1, "Must not be blank")).optional();
}

const sharedFields = {
  slug: z.string().trim().min(1).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase kebab-case"),
  originalTitle: z.string().trim().min(1).max(300),
  authors: z.string().trim().min(1).max(500),
  publisher: z.string().trim().max(300).optional(),
  publicationYear: z.coerce.number().int().min(1000).max(3000).optional(),
  originalLanguage: z.string().trim().min(2).max(20).default("ar"),
  isbn: z.string().trim().max(32).optional(),
  category: z.string().trim().min(1).max(120),
  audience: z.string().trim().min(1).max(120),
  level: z.string().trim().min(1).max(120),
  skills: z.array(z.string().trim().min(1).max(120)).max(30).default([]),
  displayTitle: requiredLocalizedText("Required in every locale"),
  description: requiredLocalizedText("Required in every locale"),
  longDescription: optionalLocalizedText(),
  sourceName: z.string().trim().min(1).max(300),
  sourceUrl: urlSchema,
  destinationType: z.enum(["publisher", "author", "institution", "library", "other"]),
  accessStatus: z.enum(["free_reading", "preview", "purchase", "institutional_access", "unknown"]).default("unknown"),
  accessNotes: optionalLocalizedText(),
  coverUrl: urlSchema.optional(),
  coverAlt: optionalLocalizedText(),
};

export const createLibraryBookSchema = z.object(sharedFields);

const publicationStatusSchema = z.enum(["draft", "pending_review", "published", "unpublished", "archived"]);
const reviewStatusSchema = z.enum(["needs_review", "verified"]);

const lifecycleSchema = z.object({
  publicationStatus: publicationStatusSchema,
  reviewStatus: reviewStatusSchema,
}).superRefine((value, ctx) => {
  if (value.publicationStatus === "published" && value.reviewStatus !== "verified") {
    ctx.addIssue({
      code: "custom",
      path: ["reviewStatus"],
      message: "Published books must be verified",
    });
  }
});

export const updateLibraryBookSchema = z.object({
  ...sharedFields,
  ...lifecycleSchema.shape,
}).superRefine((value, ctx) => {
  if (value.publicationStatus === "published" && value.reviewStatus !== "verified") {
    ctx.addIssue({
      code: "custom",
      path: ["reviewStatus"],
      message: "Published books must be verified",
    });
  }
});

export const publishLibraryBookSchema = z.object({
  ...sharedFields,
  publicationStatus: z.literal("published"),
  reviewStatus: z.literal("verified"),
});

export type CreateLibraryBookValues = z.infer<typeof createLibraryBookSchema>;
export type UpdateLibraryBookValues = z.infer<typeof updateLibraryBookSchema>;
