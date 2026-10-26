"use client";

import { useMemo, useState } from "react";
import { useForm, type FieldErrors, type Path, type UseFormRegister } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { locales, localeLabels } from "@/i18n/config";
import { createLibraryBookSchema, type CreateLibraryBookValues } from "@/validation/library-books";
import { LibraryPreview } from "./library-preview";

const emptyLocalized = () => ({ ar: "", en: "", zh: "" });
const defaults = { slug: "", originalTitle: "", authors: "", publisher: "", publicationYear: undefined, originalLanguage: "ar", isbn: "", category: "", audience: "", level: "", skills: [] as string[], displayTitle: emptyLocalized(), description: emptyLocalized(), longDescription: undefined, sourceName: "", sourceUrl: "", destinationType: "publisher" as const, accessStatus: "unknown" as const, accessNotes: undefined, coverUrl: "", coverAlt: undefined };

function LocalizedFields({ name, label, multiline, register, errors }: { name: "displayTitle" | "description" | "longDescription" | "accessNotes" | "coverAlt"; label: string; multiline?: boolean; register: UseFormRegister<CreateLibraryBookValues>; errors: FieldErrors<CreateLibraryBookValues>[typeof name] }) {
  const errorMap = errors as Record<string, { message?: string } | undefined> | undefined;
  return <div className="grid gap-3 rounded-xl border p-4"><div><h3 className="font-medium">{label}</h3><p className="text-xs text-muted-foreground">{locales.map((locale) => localeLabels[locale]).join(" · ")}</p></div>{locales.map((locale) => <Field key={locale} data-invalid={!!errorMap?.[locale]}><FieldLabel htmlFor={`${name}-${locale}`}>{localeLabels[locale]}</FieldLabel>{multiline ? <Textarea id={`${name}-${locale}`} dir="auto" rows={3} {...register(`${name}.${locale}` as Path<CreateLibraryBookValues>)} /> : <Input id={`${name}-${locale}`} dir="auto" {...register(`${name}.${locale}` as Path<CreateLibraryBookValues>)} />}<FieldError errors={[errorMap?.[locale]]} /></Field>)}</div>;
}

export function LibraryBookForm({ mode }: { mode: "create" | "edit" }) {
  const t = useTranslations("admin.library");
  const [submitted, setSubmitted] = useState(false);
  const methods = useForm<CreateLibraryBookValues>({ resolver: zodResolver(createLibraryBookSchema) as never, defaultValues: defaults, mode: "onBlur" });
  const { register, handleSubmit, watch, formState: { errors } } = methods;
  const values = watch();
  const errorCount = useMemo(() => Object.keys(errors).length, [errors]);
  return <form onSubmit={handleSubmit(() => setSubmitted(true))} className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-bold">{mode === "create" ? t("newTitle") : t("editTitle")}</h1><p className="text-muted-foreground">{t("formDescription")}</p></div><div className="flex gap-2"><Badge variant="outline">{t("draftLabel")}</Badge><Button type="submit">{t("saveDraft")}</Button></div></div>
    {submitted && <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-sm">{t("validationReady")}</div>}
    {errorCount > 0 && <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">{t("validationErrors", { count: errorCount })}</div>}
    <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]"><div className="space-y-6">
      <Card><CardHeader><CardTitle>{t("bibliographic")}</CardTitle></CardHeader><CardContent><FieldGroup><Field><FieldLabel>{t("originalTitle")}</FieldLabel><Input {...register("originalTitle")} /><FieldError errors={[errors.originalTitle]} /></Field><Field><FieldLabel>{t("authors")}</FieldLabel><Input {...register("authors")} /><FieldError errors={[errors.authors]} /></Field><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>{t("publisher")}</FieldLabel><Input {...register("publisher")} /></Field><Field><FieldLabel>{t("publicationYear")}</FieldLabel><Input type="number" {...register("publicationYear")} /></Field><Field><FieldLabel>{t("originalLanguage")}</FieldLabel><Input dir="ltr" {...register("originalLanguage")} /></Field><Field><FieldLabel>{t("isbn")}</FieldLabel><Input dir="ltr" {...register("isbn")} /></Field></div><Field><FieldLabel>{t("slug")}</FieldLabel><Input dir="ltr" placeholder="arabic-book-title" {...register("slug")} /><FieldError errors={[errors.slug]} /></Field></FieldGroup></CardContent></Card>
      <Card><CardHeader><CardTitle>{t("classification")}</CardTitle></CardHeader><CardContent><FieldGroup><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>{t("category")}</FieldLabel><Input {...register("category")} /></Field><Field><FieldLabel>{t("audience")}</FieldLabel><Input {...register("audience")} /></Field><Field><FieldLabel>{t("level")}</FieldLabel><Input {...register("level")} /></Field><Field><FieldLabel>{t("skills")}</FieldLabel><Input placeholder={t("skillsPlaceholder")} {...register("skills.0")} /></Field></div></FieldGroup></CardContent></Card>
      <Card><CardHeader><CardTitle>{t("localizedContent")}</CardTitle></CardHeader><CardContent className="space-y-4"><LocalizedFields name="displayTitle" label={t("displayTitle")} register={register} errors={errors.displayTitle} /><LocalizedFields name="description" label={t("description")} multiline register={register} errors={errors.description} /><LocalizedFields name="longDescription" label={t("longDescription")} multiline register={register} errors={errors.longDescription} /><LocalizedFields name="accessNotes" label={t("accessNotes")} multiline register={register} errors={errors.accessNotes} /></CardContent></Card>
      <Card><CardHeader><CardTitle>{t("sourceAccess")}</CardTitle></CardHeader><CardContent><FieldGroup><div className="grid gap-4 sm:grid-cols-2"><Field><FieldLabel>{t("sourceName")}</FieldLabel><Input {...register("sourceName")} /></Field><Field><FieldLabel>{t("destinationType")}</FieldLabel><select className="h-9 rounded-lg border bg-background px-3 text-sm" {...register("destinationType")}><option value="publisher">{t("publisherDestination")}</option><option value="author">{t("authorDestination")}</option><option value="institution">{t("institutionDestination")}</option><option value="library">{t("libraryDestination")}</option><option value="other">{t("otherDestination")}</option></select></Field></div><Field><FieldLabel>{t("sourceUrl")}</FieldLabel><Input dir="ltr" placeholder="https://" {...register("sourceUrl")} /><FieldError errors={[errors.sourceUrl]} /></Field><Field><FieldLabel>{t("accessStatus")}</FieldLabel><select className="h-9 rounded-lg border bg-background px-3 text-sm" {...register("accessStatus")}><option value="unknown">{t("accessUnknown")}</option><option value="free_reading">{t("accessFree")}</option><option value="preview">{t("accessPreview")}</option><option value="purchase">{t("accessPurchase")}</option><option value="institutional_access">{t("accessInstitutional")}</option></select></Field></FieldGroup></CardContent></Card>
      <Card><CardHeader><CardTitle>{t("cover")}</CardTitle></CardHeader><CardContent><Field><FieldLabel>{t("coverUrl")}</FieldLabel><Input dir="ltr" placeholder="https://" {...register("coverUrl")} /><FieldDescription>{t("coverDescription")}</FieldDescription><FieldError errors={[errors.coverUrl]} /></Field><div className="mt-4"><LocalizedFields name="coverAlt" label={t("coverAlt")} register={register} errors={errors.coverAlt} /></div></CardContent></Card>
    </div><aside className="space-y-6 xl:sticky xl:top-6 xl:self-start"><LibraryPreview values={values} /><Card><CardHeader><CardTitle>{t("workflowTitle")}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">{t("workflowDescription")}</CardContent></Card></aside></div>
  </form>;
}
