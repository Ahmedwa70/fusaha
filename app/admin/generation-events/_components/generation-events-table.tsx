"use client";

import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { DataTable } from "@/components/shared/data-table/data-table";
import { dateFormatter, timeFormatter } from "@/lib/dashboard/format";
import { SourceType } from "@/database/schema";
import type { GenerationEventListItem } from "@/lib/admin/queries/generation-event";

export function GenerationEventsTable({ generationEvents }: { generationEvents: GenerationEventListItem[] }) {
  const t = useTranslations("admin.generationEvents");

  const columns = useMemo<ColumnDef<GenerationEventListItem, unknown>[]>(() => {
    const sourceTypeLabel: Record<SourceType, string> = {
      [SourceType.Images]: t("sourceTypeImages"),
      [SourceType.TextDirect]: t("sourceTypeTextDirect"),
      [SourceType.TextPasted]: t("sourceTypeTextPasted"),
      [SourceType.Pdf]: t("sourceTypePdf"),
      [SourceType.Docx]: t("sourceTypeDocx"),
    };

    return [
      {
        id: "teacher",
        accessorFn: (row) => `${row.teacherName ?? ""} ${row.teacherEmail ?? ""}`,
        header: t("columnTeacher"),
        cell: ({ row }) =>
          row.original.teacherId === null ? (
            <span className="text-muted-foreground">{t("unknownTeacher")}</span>
          ) : (
            <div className="flex flex-col">
              <span>{row.original.teacherName}</span>
              <span className="text-sm text-muted-foreground">{row.original.teacherEmail}</span>
            </div>
          ),
      },
      {
        id: "lesson",
        accessorFn: (row) => row.lessonName ?? "",
        header: t("columnLesson"),
        cell: ({ row }) => row.original.lessonName ?? <span className="text-muted-foreground">{t("noLesson")}</span>,
      },
      {
        id: "sourceType",
        accessorFn: (row) => row.sourceType,
        header: t("columnSourceType"),
        cell: ({ row }) => {
          const value = row.original.sourceType;
          return value !== null && value in sourceTypeLabel ? sourceTypeLabel[value] : t("sourceTypeUnknown");
        },
      },
      {
        id: "status",
        accessorFn: (row) => row.success,
        header: t("columnStatus"),
        cell: ({ row }) =>
          row.original.success ? (
            <Badge className="bg-green-100 text-green-800">{t("statusSuccess")}</Badge>
          ) : (
            <Badge variant="destructive">{t("statusFailed")}</Badge>
          ),
      },
      {
        id: "duration",
        accessorFn: (row) => row.durationMs ?? 0,
        header: t("columnDuration"),
        cell: ({ row }) =>
          row.original.durationMs === null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            `${(row.original.durationMs / 1000).toFixed(1)}s`
          ),
      },
      {
        id: "tokens",
        accessorFn: (row) => row.totalTokens ?? 0,
        header: t("columnTokens"),
        cell: ({ row }) => {
          const { promptTokens, completionTokens, totalTokens } = row.original;
          if (totalTokens === null) return <span className="text-muted-foreground">—</span>;
          return (
            <div className="flex flex-col">
              <span className="font-medium">{totalTokens.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground">
                {t("tokensBreakdown", { prompt: promptTokens ?? 0, completion: completionTokens ?? 0 })}
              </span>
            </div>
          );
        },
      },
      {
        id: "createdDate",
        accessorFn: (row) => row.createdAt,
        header: t("columnCreatedAt"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{dateFormatter.format(row.original.createdAt)}</span>
        ),
      },
      {
        id: "createdTime",
        accessorFn: (row) => row.createdAt,
        header: t("columnTime"),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{timeFormatter.format(row.original.createdAt)}</span>
        ),
      },
    ];
  }, [t]);

  return (
    <DataTable
      columns={columns}
      data={generationEvents}
      showSearch={false}
      emptyMessage={t("emptyTitle")}
      emptyDescription={t("emptyDescription")}
    />
  );
}
