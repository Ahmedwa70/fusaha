import { Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LessonState } from "@/database/schema";

export const lessonStateClassName: Record<LessonState, string> = {
  [LessonState.Approved]: "bg-success text-success-foreground",
  [LessonState.Draft]: "bg-warning text-warning-foreground",
  [LessonState.Generating]: "bg-info text-info-foreground",
  [LessonState.GenerationFailed]: "bg-destructive text-destructive-foreground",
};

// Maps a lesson state to its "dashboard.lessonStates" translation key, so
// callers can translate with either useTranslations (client) or
// getTranslations (server) and pass the resolved label down — keeps this
// component a plain presentational leaf usable from both.
export const lessonStateLabelKey: Record<LessonState, string> = {
  [LessonState.Approved]: "approved",
  [LessonState.Draft]: "draft",
  [LessonState.Generating]: "generating",
  [LessonState.GenerationFailed]: "generationFailed",
};

export function LessonStateBadge({ state, label }: { state: LessonState; label: string }) {
  return (
    <Badge className={lessonStateClassName[state]}>
      {state === LessonState.Generating && <Loader2Icon className="size-3 animate-spin" data-icon="inline-start" />}
      {label}
    </Badge>
  );
}
