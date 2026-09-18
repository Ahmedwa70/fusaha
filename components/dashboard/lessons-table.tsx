"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { BookOpenIcon, FolderOpenIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LessonStateBadge, lessonStateLabelKey } from "@/components/dashboard/lesson-state-badge";
import { dateFormatter } from "@/lib/dashboard/format";
import type { LessonListItem } from "@/lib/dashboard/queries/lesson";

export function LessonsTable({ lessons }: { lessons: LessonListItem[] }) {
  const t = useTranslations("dashboard.explorer");
  const tStates = useTranslations("dashboard.lessonStates");

  if (lessons.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderOpenIcon />
          </EmptyMedia>
          <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
          <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href={ROUTES.dashboardCreate} className={cn(buttonVariants(), "gap-1.5")}>
            <PlusIcon data-icon="inline-start" />
            {t("createNew")}
          </Link>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("columnName")}</TableHead>
          <TableHead>{t("columnLevel")}</TableHead>
          <TableHead>{t("columnStatus")}</TableHead>
          <TableHead>{t("columnUpdatedAt")}</TableHead>
          <TableHead>{t("columnFolder")}</TableHead>
          <TableHead className="text-end">{t("columnActions")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {lessons.map((lesson) => (
          <TableRow key={lesson.id}>
            <TableCell className="font-medium">
              <Link href={`${ROUTES.dashboard}/lessons/${lesson.id}`} className="flex items-center gap-2 hover:underline">
                <BookOpenIcon className="size-4 text-muted-foreground" />
                {lesson.name}
              </Link>
            </TableCell>
            <TableCell>{lesson.level != null && <Badge variant="secondary">{lesson.level}</Badge>}</TableCell>
            <TableCell>
              <LessonStateBadge state={lesson.state} label={tStates(lessonStateLabelKey[lesson.state])} />
            </TableCell>
            <TableCell className="text-muted-foreground">{dateFormatter.format(lesson.updatedAt)}</TableCell>
            <TableCell className="text-muted-foreground">
              {lesson.folderName && (
                <span className="inline-flex items-center gap-1">
                  <FolderOpenIcon className="size-3.5" />
                  {lesson.folderName}
                </span>
              )}
            </TableCell>
            <TableCell className="text-end">
              <Link
                href={`${ROUTES.dashboard}/lessons/${lesson.id}`}
                className={cn(buttonVariants({ size: "sm", variant: "ghost" }))}
              >
                {t("open")}
              </Link>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
