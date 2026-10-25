import Image from "next/image";
import Link from "next/link";
import { ArrowLeftIcon, CheckCircle2Icon } from "lucide-react";
import type { ResourceItem } from "@/content/resources";

export function ResourceCard({ resource }: { resource: ResourceItem }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card/85 shadow-sm transition-transform hover:-translate-y-1 hover:shadow-lg">
      <div className="relative h-48 overflow-hidden bg-brand-50 dark:bg-secondary">
        <Image src={resource.image} alt={resource.imageAlt} fill className="object-cover transition-transform duration-500 group-hover:scale-105" />
        <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 text-xs font-bold text-card-foreground shadow-sm">
          <CheckCircle2Icon className="size-3.5 text-gold-600" aria-hidden="true" />
          متاح الآن
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5 text-right">
        <h3 className="font-heading text-xl font-bold text-brand-950 dark:text-card-foreground">{resource.title}</h3>
        <p className="mt-3 flex-1 text-sm leading-7 text-brand-800 dark:text-brand-100/70">{resource.description}</p>
        <Link href={resource.href} className="mt-5 inline-flex w-fit items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          {resource.action}
          <ArrowLeftIcon data-icon="inline-end" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
