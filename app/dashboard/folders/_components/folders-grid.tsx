"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { FolderIcon, BookOpenIcon, MoreVerticalIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { DeleteConfirmationDialog } from "@/components/shared/delete-confirmation-dialog";
import { ROUTES } from "@/constants/routes";
import { deleteFolder } from "@/actions/folders";
import type { FolderListItem } from "@/lib/dashboard/queries/folder";
import { FolderFormDialog } from "./folder-form-dialog";

export function FoldersGrid({ folders }: { folders: FolderListItem[] }) {
  const t = useTranslations("dashboard.folders");
  const tActions = useTranslations("common.actions");
  const [folderToEdit, setFolderToEdit] = useState<FolderListItem | null>(null);
  const [folderToDelete, setFolderToDelete] = useState<FolderListItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleting, startDeleting] = useTransition();

  if (folders.length === 0) {
    return (
      <Card>
        <CardContent>
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FolderIcon />
              </EmptyMedia>
              <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
              <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    );
  }

  function closeDeleteDialog() {
    setFolderToDelete(null);
    setDeleteError(null);
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {folders.map((folder) => (
          <Card key={folder.id} className="group relative transition-colors hover:ring-primary/40">
            <div className="absolute top-2 end-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <span className="sr-only">{tActions("menu")}</span>
                      <MoreVerticalIcon />
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setFolderToEdit(folder)}>
                    <PencilIcon data-icon="inline-start" />
                    {tActions("edit")}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" onClick={() => setFolderToDelete(folder)}>
                    <Trash2Icon data-icon="inline-start" />
                    {tActions("delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Link href={`${ROUTES.dashboardFolders}/${folder.id}`}>
              <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                  <FolderIcon className="size-6" />
                </div>
                <p className="font-semibold">{folder.name}</p>
                <p className="flex items-center gap-1 text-sm text-muted-foreground">
                  <BookOpenIcon className="size-3.5" />
                  {t("lessonCount", { count: folder.lessonCount })}
                </p>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>

      {folderToEdit && (
        <FolderFormDialog
          mode="edit"
          folder={folderToEdit}
          open={!!folderToEdit}
          onOpenChange={(open) => !open && setFolderToEdit(null)}
        />
      )}

      <DeleteConfirmationDialog
        open={!!folderToDelete}
        onOpenChange={(open) => !open && closeDeleteDialog()}
        title={t("deleteDialogTitle")}
        description={folderToDelete ? t("deleteDialogDescription", { name: folderToDelete.name }) : ""}
        cancelLabel={t("cancel")}
        confirmLabel={tActions("delete")}
        confirmingLabel={t("deleting")}
        isLoading={isDeleting}
        onConfirm={() => {
          if (!folderToDelete) return;
          startDeleting(async () => {
            const result = await deleteFolder(folderToDelete.id);
            if ("error" in result) {
              setDeleteError(result.error);
              return;
            }
            closeDeleteDialog();
          });
        }}
      />
      {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
    </>
  );
}
