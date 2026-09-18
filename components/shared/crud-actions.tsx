"use client";

import { MoreVerticalIcon, EyeIcon, PencilIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CrudActions({
  onShow,
  onEdit,
  onDelete,
}: {
  onShow: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("common.actions");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon-sm">
            <span className="sr-only">{t("menu")}</span>
            <MoreVerticalIcon />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onShow}>
          <EyeIcon data-icon="inline-start" />
          {t("view")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onEdit}>
          <PencilIcon data-icon="inline-start" />
          {t("edit")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          <Trash2Icon data-icon="inline-start" />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
