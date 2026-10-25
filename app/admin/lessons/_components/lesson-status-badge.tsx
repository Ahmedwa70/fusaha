"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { LessonState } from "@/database/schema";

const stateBadge: Record<LessonState, { labelKey: string; className: string }> = {
  [LessonState.Approved]: { labelKey: "statusApproved", className: "bg-success text-success-foreground" },
  [LessonState.Draft]: { labelKey: "statusDraft", className: "bg-warning text-warning-foreground" },
  [LessonState.Generating]: { labelKey: "statusGenerating", className: "bg-info text-info-foreground" },
  [LessonState.GenerationFailed]: { labelKey: "statusGenerationFailed", className: "bg-destructive text-destructive-foreground" },
};

// Deleted-ness (`deletedAt`) is orthogonal to `state` — a lesson can be
// Approved and soft-deleted at the same time — so it's an overlay checked
// first, not another `state` value.
export function LessonStatusBadge({ state, deletedAt }: { state: LessonState; deletedAt: Date | null }) {
  const t = useTranslations("admin.lessons");

  if (deletedAt) {
    return <Badge className="bg-muted text-muted-foreground">{t("statusDeleted")}</Badge>;
  }

  const info = stateBadge[state];
  return <Badge className={info.className}>{t(info.labelKey)}</Badge>;
}
