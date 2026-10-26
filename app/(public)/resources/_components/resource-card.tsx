import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import type { ResourceItem } from "@/content/resources";

export async function ResourceCard({ resource }: { resource: ResourceItem }) {
  const t = await getTranslations("resourcesPage");
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/85 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-48 overflow-hidden bg-brand-50 dark:bg-secondary">
        <Image src={resource.image} alt={t(`items.${resource.id}.imageAlt`)} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute inset-e-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-xs font-bold text-card-foreground shadow-sm">
          <CheckCircle2Icon className="size-3.5 text-gold-600" aria-hidden="true" />
          {t("availableNow")}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5 text-start">
        <h3 className="font-heading text-xl font-bold text-foreground dark:text-card-foreground">{t(`items.${resource.id}.title`)}</h3>
        <p className="mt-3 flex-1 text-sm leading-7 text-foreground/75 dark:text-brand-100/70">{t(`items.${resource.id}.description`)}</p>
        <Link href={resource.href} className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90 dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {t(`items.${resource.id}.action`)}
          <ArrowLeftIcon data-icon="inline-end" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
