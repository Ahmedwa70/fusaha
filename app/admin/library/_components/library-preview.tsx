"use client";

import { useLocale, useTranslations } from "next-intl";
import { BookOpenIcon, ExternalLinkIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { resolveLocalizedText } from "@/lib/localized-text";
import type { Locale } from "@/i18n/config";
import type { CreateLibraryBookValues } from "@/validation/library-books";

export function LibraryPreview({ values }: { values: Partial<CreateLibraryBookValues> }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("admin.library");
  const title = resolveLocalizedText(values.displayTitle, locale) || t("previewUntitled");
  const description = resolveLocalizedText(values.description, locale) || t("previewDescription");
  return (
    <Card className="overflow-hidden border-dashed">
      <CardHeader><CardTitle className="text-base">{t("previewTitle")}</CardTitle></CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-[220px_1fr]">
        <div className="flex min-h-56 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {values.coverUrl ? <img src={values.coverUrl} alt={resolveLocalizedText(values.coverAlt, locale) || title} className="h-56 w-full rounded-xl object-cover" /> : <BookOpenIcon className="size-12" aria-hidden="true" />}
        </div>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2"><Badge variant="secondary">{values.level || t("previewLevel")}</Badge><Badge variant="outline">{values.category || t("previewCategory")}</Badge></div>
          <div><h3 className="text-xl font-semibold">{title}</h3><p className="text-sm text-muted-foreground">{t("previewBy")} {values.authors || t("previewAuthor")}</p></div>
          <p className="line-clamp-4 text-sm text-muted-foreground">{description}</p>
          <Button type="button" variant="outline" size="sm" disabled={!values.sourceUrl} render={values.sourceUrl ? <a href={values.sourceUrl} target="_blank" rel="noreferrer" /> : undefined}>
            <ExternalLinkIcon data-icon="inline-start" />{t("previewSource")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
