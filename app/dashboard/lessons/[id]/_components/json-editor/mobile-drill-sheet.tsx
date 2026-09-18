"use client";

import { useTranslations } from "next-intl";
import { ArrowLeftIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useDirection } from "@/components/ui/direction";
import { JsonField } from "./json-field";
import { useDrillNav } from "./drill-nav";

// Renders the top of the drill stack as a full-screen mobile view — every
// nested object/array pushed here gets the whole screen to itself instead of
// competing for width with its ancestors' borders and padding.
export function MobileDrillSheet() {
  const t = useTranslations("dashboard.lessonDetail.editor");
  const direction = useDirection();
  const { stack, pop, close } = useDrillNav();

  const current = stack[stack.length - 1];

  return (
    <Sheet open={stack.length > 0} onOpenChange={(open) => !open && close()}>
      <SheetContent side={direction === "rtl" ? "left" : "right"} showCloseButton={false} className="w-full sm:hidden">
        {current && (
          <>
            <SheetHeader className="flex-row items-center gap-2 space-y-0 border-b border-border">
              <Button type="button" variant="ghost" size="icon-sm" className="-ms-1.5 shrink-0" onClick={pop}>
                <ArrowLeftIcon className="rtl:rotate-180" />
                <span className="sr-only">{t("back")}</span>
              </Button>
              <SheetTitle className="min-w-0 flex-1 truncate">{current.label}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <JsonField name={current.name} label={current.label} value={current.value} depth={0} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
