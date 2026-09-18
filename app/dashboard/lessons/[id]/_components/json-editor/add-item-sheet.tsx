"use client";

import { useTranslations } from "next-intl";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useDirection } from "@/components/ui/direction";
import { JsonField } from "./json-field";

// Fills in a freshly-appended array item's fields before it's considered
// "added" — appending straight to the end of a long list left the user
// hunting for what they just added (or unsure the button did anything);
// this puts the new item's fields in front of them immediately instead.
// Used on both mobile and desktop.
export function AddItemSheet({
  open,
  name,
  label,
  value,
  onCancel,
  onDone,
}: {
  open: boolean;
  name: string;
  label: string;
  value: unknown;
  onCancel: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("dashboard.lessonDetail.editor");
  const direction = useDirection();

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onCancel()}>
      <SheetContent
        side={direction === "rtl" ? "left" : "right"}
        showCloseButton={false}
        className="flex w-full sm:max-w-sm"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle className="truncate">{label}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4">
          <JsonField name={name} label={label} value={value} depth={0} />
        </div>
        <SheetFooter className="flex-row border-t border-border">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            {t("cancel")}
          </Button>
          <Button type="button" className="flex-1" onClick={onDone}>
            {t("addItemDone")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
