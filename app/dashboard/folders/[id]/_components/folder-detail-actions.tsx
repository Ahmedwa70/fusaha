"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FolderInputIcon, FolderPlusIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { ROUTES } from "@/constants/routes";
import { deleteFolder } from "@/actions/folders";
import type { FolderItem } from "@/lib/dashboard/queries/folder";
import type { LessonListItem } from "@/lib/dashboard/queries/lesson";
import { FolderFormDialog } from "../../_components/folder-form-dialog";
import { LessonPickerDialog } from "./lesson-picker-dialog";

export function FolderDetailActions({
  folder,
  unfiledLessons,
  otherFolderLessons,
}: {
  folder: FolderItem;
  unfiledLessons: LessonListItem[];
  otherFolderLessons: LessonListItem[];
}) {
  const t = useTranslations("dashboard.folders");
  const tActions = useTranslations("common.actions");
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => setAddOpen(true)}>
          <FolderPlusIcon data-icon="inline-start" />
          {t("addLesson")}
        </Button>
        <Button variant="outline" onClick={() => setMoveOpen(true)}>
          <FolderInputIcon data-icon="inline-start" />
          {t("moveLesson")}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline">{tActions("menu")}</Button>} />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <PencilIcon data-icon="inline-start" />
              {tActions("edit")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2Icon data-icon="inline-start" />
              {tActions("delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <FolderFormDialog mode="edit" folder={folder} open={editOpen} onOpenChange={setEditOpen} />

      <LessonPickerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        title={t("addLessonDialogTitle")}
        description={t("addLessonDialogDescription")}
        emptyMessage={t("noUnfiledLessons")}
        lessons={unfiledLessons}
        targetFolderId={folder.id}
      />

      <LessonPickerDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        title={t("moveLessonDialogTitle")}
        description={t("moveLessonDialogDescription")}
        emptyMessage={t("noOtherFolderLessons")}
        lessons={otherFolderLessons}
        targetFolderId={folder.id}
        showFolderName
      />

      <DeleteConfirmationDialog
        open={deleteOpen}
        onOpenChange={(open) => {
          setDeleteOpen(open);
          if (!open) setDeleteError(null);
        }}
        title={t("deleteDialogTitle")}
        description={t("deleteDialogDescription", { name: folder.name })}
        cancelLabel={t("cancel")}
        confirmLabel={tActions("delete")}
        confirmingLabel={t("deleting")}
        isLoading={isDeleting}
        onConfirm={() => {
          startDeleting(async () => {
            const result = await deleteFolder(folder.id);
            if ("error" in result) {
              setDeleteError(result.error);
              return;
            }
            router.push(ROUTES.dashboardFolders);
          });
        }}
      />
      {deleteError && <p className="mt-2 text-sm text-destructive">{deleteError}</p>}
    </>
  );
}
