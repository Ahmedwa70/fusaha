import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookOpenIcon, LinkIcon, Share2Icon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LessonStateBadge, lessonStateLabelKey } from "@/components/dashboard/lesson-state-badge";
import { ROUTES } from "@/constants/routes";
import { dateFormatter } from "@/lib/dashboard/format";
import { requireTeacher } from "@/lib/auth/dal";
import { getSharedLessons } from "@/lib/dashboard/queries/share-link";
import { CopyLinkButton } from "./_components/copy-link-button";

export default async function SharedLessonsPage() {
  const t = await getTranslations("dashboard.shared");
  const tStates = await getTranslations("dashboard.lessonStates");
  const teacher = await requireTeacher();
  const lessons = await getSharedLessons(teacher.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageDescription")}</p>
      </div>

      <Card>
        <CardContent>
          {lessons.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Share2Icon />
                </EmptyMedia>
                <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnName")}</TableHead>
                  <TableHead>{t("columnStatus")}</TableHead>
                  <TableHead>{t("columnUpdatedAt")}</TableHead>
                  <TableHead>{t("columnShareLink")}</TableHead>
                  <TableHead className="text-end">{t("columnActions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`${ROUTES.dashboard}/lessons/${lesson.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <BookOpenIcon className="size-4 text-muted-foreground" />
                        {lesson.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <LessonStateBadge state={lesson.state} label={tStates(lessonStateLabelKey[lesson.state])} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{dateFormatter.format(lesson.updatedAt)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        <LinkIcon className="size-3.5" />/l/{lesson.shareToken.slice(0, 10)}…
                      </span>
                    </TableCell>
                    <TableCell className="text-end">
                      <CopyLinkButton token={lesson.shareToken} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
