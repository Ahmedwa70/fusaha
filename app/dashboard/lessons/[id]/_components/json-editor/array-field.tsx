"use client";

import { useState } from "react";
import { useFieldArray, useFormContext } from "react-hook-form";
import { useTranslations } from "next-intl";
import { PlusIcon, Trash2Icon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDirection } from "@/components/ui/direction";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { cloneDefaultValue } from "./clone-default-value";
import { JsonField } from "./json-field";
import { useDrillNav } from "./drill-nav";
import { useNarrowViewport } from "./use-narrow-viewport";
import { AddItemSheet } from "./add-item-sheet";

function isDrillable(value: unknown): boolean {
  return Array.isArray(value) || (value !== null && typeof value === "object");
}

// RHF's useFieldArray gives every row a stable `id` (independent of array
// index), which is what keeps focus in a text input from being lost mid-
// typing when an earlier row is removed — using the array index itself as
// the React key is the classic bug this sidesteps.
export function ArrayField({ name, label, value }: { name: string; label: string; value: unknown[] }) {
  const t = useTranslations("dashboard.lessonDetail.editor");
  const { control } = useFormContext();
  const { fields, append, remove } = useFieldArray({ control, name });
  const isNarrow = useNarrowViewport();
  const { push } = useDrillNav();
  const direction = useDirection();
  const ForwardIcon = direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;

  // Each array item's *shape* (is it a string? an object with these keys?)
  // is fixed by the generated content and doesn't change as the user edits
  // values — but a freshly-appended row has no shape of its own, so it
  // needs a snapshot to render from. Tracked in parallel with `fields`.
  const [samples, setSamples] = useState<unknown[]>(value);
  // Index of the row currently being filled in via the add sheet — the item
  // already exists in the field array (so its inputs can register normally)
  // but isn't considered "added" until the user confirms, at which point
  // cancelling removes it again instead of leaving a half-filled item behind.
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const templateSample = samples[samples.length - 1] ?? value[0] ?? "";

  const discardPendingItem = () => {
    if (pendingIndex === null) return;
    setSamples((prev) => prev.filter((_, i) => i !== pendingIndex));
    remove(pendingIndex);
    setPendingIndex(null);
  };

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-lg border p-2 sm:gap-3 sm:p-3">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <span className="min-w-0 truncate text-sm font-medium">{label}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={t("addItem")}
          className="shrink-0 gap-1 px-2 sm:px-3"
          onClick={() => {
            const newItem = cloneDefaultValue(templateSample);
            const newIndex = fields.length;
            setSamples((prev) => [...prev, newItem]);
            append(newItem);
            setPendingIndex(newIndex);
          }}
        >
          <PlusIcon />
          <span className="hidden sm:inline">{t("addItem")}</span>
        </Button>
      </div>

      {fields.length > 0 && (
        <div className="flex min-w-0 flex-col gap-2 sm:gap-3">
          {fields.map((field, index) => {
            const itemValue = samples[index] ?? templateSample;
            const itemName = `${name}.${index}`;
            const itemLabel = `${label} ${index + 1}`;

            return (
              <div key={field.id} className="flex min-w-0 items-start gap-1 sm:gap-2">
                <div className="min-w-0 flex-1">
                  {isNarrow && isDrillable(itemValue) ? (
                    <button
                      type="button"
                      onClick={() => push({ name: itemName, label: itemLabel, value: itemValue })}
                      className="flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-start text-sm font-medium hover:bg-muted/50"
                    >
                      <span className="min-w-0 truncate">{itemLabel}</span>
                      <ForwardIcon className="size-4 shrink-0 text-muted-foreground" />
                    </button>
                  ) : (
                    <JsonField name={itemName} label={itemLabel} value={itemValue} depth={1} />
                  )}
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  className="shrink-0"
                  aria-label={t("removeItem")}
                  onClick={() => setDeleteIndex(index)}
                >
                  <Trash2Icon className="text-destructive" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {pendingIndex !== null && (
        <AddItemSheet
          open
          name={`${name}.${pendingIndex}`}
          label={`${label} ${pendingIndex + 1}`}
          value={samples[pendingIndex] ?? templateSample}
          onCancel={discardPendingItem}
          onDone={() => setPendingIndex(null)}
        />
      )}

      <DeleteConfirmationDialog
        open={deleteIndex !== null}
        onOpenChange={(open) => !open && setDeleteIndex(null)}
        title={t("deleteItemTitle")}
        description={t("deleteItemDescription")}
        cancelLabel={t("cancel")}
        confirmLabel={t("deleteItemConfirm")}
        confirmingLabel={t("deleteItemDeleting")}
        onConfirm={() => {
          if (deleteIndex === null) return;
          setSamples((prev) => prev.filter((_, i) => i !== deleteIndex));
          remove(deleteIndex);
          setDeleteIndex(null);
        }}
      />
    </div>
  );
}
