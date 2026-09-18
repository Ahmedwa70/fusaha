import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ClockIcon, PlayIcon, FileTextIcon, Loader2Icon, AlertTriangleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  LessonStateBadge,
  lessonStateLabelKey,
} from "@/components/dashboard/lesson-state-badge";
import { dateFormatter } from "@/lib/dashboard/format";
import { requireTeacher } from "@/lib/auth/dal";
import { getLessonDetail } from "@/lib/dashboard/queries/lesson";
import { getTeacherFolders } from "@/lib/dashboard/queries/folder";
import { LessonState, VersionStatus } from "@/database/schema";
import { DeleteLessonButton } from "./_components/delete-lesson-button";
import { ShareLinkCard } from "./_components/share-link-card";
import { FolderSelect } from "./_components/folder-select";
import { ApproveLessonButton } from "./_components/approve-lesson-button";
import { RestoreVersionButton } from "./_components/restore-version-button";
import { GenerationPoller } from "./_components/generation-poller";
import { LessonContentEditor } from "./_components/lesson-content-editor";

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const t = await getTranslations("dashboard.lessonDetail");
  const tStates = await getTranslations("dashboard.lessonStates");
  const teacher = await requireTeacher();
  const { id } = await params;
  const [lesson, folders] = await Promise.all([
    getLessonDetail(teacher.id, id),
    getTeacherFolders(teacher.id),
  ]);

  if (!lesson) notFound();

  const versionStatusBadge: Record<
    VersionStatus,
    { label: string; className: string }
  > = {
    [VersionStatus.Approved]: {
      label: tStates("approved"),
      className: "bg-green-100 text-green-800",
    },
    [VersionStatus.Draft]: {
      label: tStates("draft"),
      className: "bg-amber-100 text-amber-800",
    },
  };

  const latestVersion = lesson.versions[0];

  // The manual editor only applies to an editable draft with real content —
  // a lesson still generating or one that failed leaves the latest
  // version's content as `{}`, and an already-approved version is a locked
  // snapshot (out of scope here, see updateLessonVersionContent).
  const editableContent =
    latestVersion &&
    latestVersion.status === VersionStatus.Draft &&
    latestVersion.content !== null &&
    typeof latestVersion.content === "object" &&
    !Array.isArray(latestVersion.content) &&
    Object.keys(latestVersion.content as Record<string, unknown>).length > 0
      ? (latestVersion.content as Record<string, unknown>)
      : null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      {lesson.state === LessonState.Generating && <GenerationPoller />}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{lesson.name}</h1>
            <LessonStateBadge
              state={lesson.state}
              label={tStates(lessonStateLabelKey[lesson.state])}
            />
            {latestVersion && (
              <Badge variant="secondary">
                {t("levelBadge", { level: latestVersion.level })}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <FolderSelect
              lessonId={lesson.id}
              folderId={lesson.folderId}
              folders={folders}
            />
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="size-3.5" />
              {t("lastUpdated", {
                date: dateFormatter.format(lesson.updatedAt),
              })}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {lesson.state === LessonState.Approved ? (
            <Button
              variant="outline"
              className="gap-1.5"
              nativeButton={false}
              render={<Link href={`/dashboard/lessons/${lesson.id}/run`} />}
            >
              <PlayIcon data-icon="inline-start" />
              {t("playLesson")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5"
              disabled
            >
              <PlayIcon data-icon="inline-start" />
              {t("playLesson")}
            </Button>
          )}
          {lesson.state === LessonState.Draft && (
            <ApproveLessonButton lessonId={lesson.id} />
          )}
          <DeleteLessonButton id={lesson.id} name={lesson.name} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileTextIcon className="size-4" />
            {t("contentTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {lesson.state === LessonState.Generating ? (
            <Empty className="mx-auto max-w-sm border-none p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Loader2Icon className="animate-spin text-primary" />
                </EmptyMedia>
                <EmptyTitle>{t("generatingTitle")}</EmptyTitle>
                <EmptyDescription>{t("generatingDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : lesson.state === LessonState.GenerationFailed ? (
            <Empty className="mx-auto max-w-sm border-none p-0">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <AlertTriangleIcon className="text-destructive" />
                </EmptyMedia>
                <EmptyTitle>{t("generationFailedTitle")}</EmptyTitle>
                <EmptyDescription>{t("generationFailedDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : editableContent && latestVersion ? (
            <LessonContentEditor
              lessonId={lesson.id}
              versionId={latestVersion.id}
              content={editableContent}
            />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>{t("approvedContentLockedTitle")}</EmptyTitle>
                <EmptyDescription>
                  {t("approvedContentLockedDescription")}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("versionHistoryTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columnVersion")}</TableHead>
                <TableHead>{t("columnStatus")}</TableHead>
                <TableHead>{t("columnLevel")}</TableHead>
                <TableHead>{t("columnCreatedAt")}</TableHead>
                <TableHead>{t("columnApprovedAt")}</TableHead>
                <TableHead className="text-end">{t("columnActions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lesson.versions.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">
                    v{v.versionNumber}
                  </TableCell>
                  <TableCell>
                    <Badge className={versionStatusBadge[v.status].className}>
                      {versionStatusBadge[v.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{v.level}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {dateFormatter.format(v.createdAt)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {v.approvedAt ? dateFormatter.format(v.approvedAt) : "—"}
                  </TableCell>
                  <TableCell className="text-end">
                    <RestoreVersionButton
                      lessonId={lesson.id}
                      versionId={v.id}
                      disabled={v.id === latestVersion?.id}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ShareLinkCard
        lessonId={lesson.id}
        lessonState={lesson.state}
        shareLink={lesson.shareLink}
      />
    </div>
  );
}
