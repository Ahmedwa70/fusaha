import { Loader2Icon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LessonState } from "@/database/schema";

export const lessonStateClassName: Record<LessonState, string> = {
  [LessonState.Approved]: "bg-green-100 text-green-800",
  [LessonState.Draft]: "bg-amber-100 text-amber-800",
  [LessonState.Generating]: "bg-blue-100 text-blue-800",
  [LessonState.GenerationFailed]: "bg-red-100 text-red-800",
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
