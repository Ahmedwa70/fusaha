"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { LessonState } from "@/database/schema";

const stateBadge: Record<LessonState, { labelKey: string; className: string }> = {
  [LessonState.Approved]: { labelKey: "statusApproved", className: "bg-green-100 text-green-800" },
  [LessonState.Draft]: { labelKey: "statusDraft", className: "bg-amber-100 text-amber-800" },
  [LessonState.Generating]: { labelKey: "statusGenerating", className: "bg-blue-100 text-blue-800" },
  [LessonState.GenerationFailed]: { labelKey: "statusGenerationFailed", className: "bg-red-100 text-red-800" },
};

// Deleted-ness (`deletedAt`) is orthogonal to `state` — a lesson can be
// Approved and soft-deleted at the same time — so it's an overlay checked
// first, not another `state` value.
export function LessonStatusBadge({ state, deletedAt }: { state: LessonState; deletedAt: Date | null }) {
  const t = useTranslations("admin.lessons");

  if (deletedAt) {
    return <Badge className="bg-gray-200 text-gray-800">{t("statusDeleted")}</Badge>;
  }

  const info = stateBadge[state];
  return <Badge className={info.className}>{t(info.labelKey)}</Badge>;
}
