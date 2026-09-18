"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpenIcon, FolderOpenIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { moveLessonToFolder } from "@/actions/lessons";
import type { LessonListItem } from "@/lib/dashboard/queries/lesson";

export function LessonPickerDialog({
  open,
  onOpenChange,
  title,
  description,
  emptyMessage,
  lessons,
  targetFolderId,
  showFolderName = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  emptyMessage: string;
  lessons: LessonListItem[];
  targetFolderId: string;
  showFolderName?: boolean;
}) {
  const t = useTranslations("dashboard.folders");
  const router = useRouter();
  const [movedIds, setMovedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const remaining = lessons.filter((lesson) => !movedIds.has(lesson.id));

  function handleSelect(lessonId: string) {
    setError(null);
    setPendingId(lessonId);
    startTransition(async () => {
      const result = await moveLessonToFolder(lessonId, targetFolderId);
      setPendingId(null);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setMovedIds((prev) => new Set(prev).add(lessonId));
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setMovedIds(new Set());
          setError(null);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {remaining.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderOpenIcon />
              </EmptyMedia>
              <EmptyTitle>{emptyMessage}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
            {remaining.map((lesson) => (
              <div key={lesson.id} className="flex items-center justify-between gap-2 rounded-lg border p-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <BookOpenIcon className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{lesson.name}</p>
                    {showFolderName && lesson.folderName && (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FolderOpenIcon className="size-3" />
                        {lesson.folderName}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={pendingId === lesson.id}
                  onClick={() => handleSelect(lesson.id)}
                >
                  {pendingId === lesson.id && <Loader2Icon data-icon="inline-start" className="animate-spin" />}
                  {t("pick")}
                </Button>
              </div>
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </DialogContent>
    </Dialog>
  );
}
