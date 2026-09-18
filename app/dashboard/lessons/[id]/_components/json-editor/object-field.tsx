"use client";

import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useDirection } from "@/components/ui/direction";
import { humanizeLabel } from "./humanize-label";
import { JsonField } from "./json-field";
import { useDrillNav } from "./drill-nav";
import { useNarrowViewport } from "./use-narrow-viewport";

export function ObjectField({
  name,
  label,
  value,
  depth = 0,
}: {
  name: string;
  label: string;
  value: Record<string, unknown>;
  depth?: number;
}) {
  const isNarrow = useNarrowViewport();
  const { push } = useDrillNav();
  const direction = useDirection();
  const entries = Object.entries(value);

  const children = (
    <div className="flex min-w-0 flex-col gap-4">
      {entries.map(([key, entryValue]) => (
        <JsonField
          key={key}
          name={name ? `${name}.${key}` : key}
          label={humanizeLabel(key)}
          value={entryValue}
          depth={depth + 1}
        />
      ))}
    </div>
  );

  // The root content object renders inline (it's already inside the
  // editor's card) — collapsible chrome only kicks in for nested objects.
  if (depth === 0) return children;

  // On narrow screens, nested objects don't expand in place — every level
  // of inline chrome (border, padding, its own nested boxes) compounds until
  // there's no room left to actually edit anything. Drilling into a
  // dedicated full-screen view instead gives each level the whole screen.
  if (isNarrow) {
    const ForwardIcon = direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;
    return (
      <button
        type="button"
        onClick={() => push({ name, label, value })}
        className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-start text-sm font-medium hover:bg-muted/50"
      >
        <span className="min-w-0 truncate">{label}</span>
        <ForwardIcon className="size-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  return (
    <Collapsible defaultOpen className="min-w-0 rounded-lg border">
      <CollapsibleTrigger className="group/collapsible-trigger flex w-full min-w-0 items-center justify-between gap-2 px-2 py-1.5 text-start text-sm font-medium hover:bg-muted/50 sm:px-3 sm:py-2">
        <span className="min-w-0 truncate">{label}</span>
        <ChevronDownIcon className="size-4 shrink-0 transition-transform group-data-[panel-open]/collapsible-trigger:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="min-w-0 border-t px-2 py-2 sm:px-3 sm:py-3">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
