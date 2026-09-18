import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookOpenIcon, HistoryIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROUTES } from "@/constants/routes";
import { dateFormatter } from "@/lib/dashboard/format";
import { requireTeacher } from "@/lib/auth/dal";
import { getVersionHistory } from "@/lib/dashboard/queries/version";
import { VersionStatus } from "@/database/schema";

export default async function VersionHistoryPage() {
  const t = await getTranslations("dashboard.history");
  const tStates = await getTranslations("dashboard.lessonStates");
  const teacher = await requireTeacher();
  const versions = await getVersionHistory(teacher.id);

  const statusBadge: Record<VersionStatus, { label: string; className: string }> = {
    [VersionStatus.Approved]: { label: tStates("approved"), className: "bg-green-100 text-green-800" },
    [VersionStatus.Draft]: { label: tStates("draft"), className: "bg-amber-100 text-amber-800" },
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitle")}</h1>
        <p className="text-muted-foreground">{t("pageDescription")}</p>
      </div>

      <Card>
        <CardContent>
          {versions.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <HistoryIcon />
                </EmptyMedia>
                <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
                <EmptyDescription>{t("emptyDescription")}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnLesson")}</TableHead>
                  <TableHead>{t("columnVersion")}</TableHead>
                  <TableHead>{t("columnLevel")}</TableHead>
                  <TableHead>{t("columnStatus")}</TableHead>
                  <TableHead>{t("columnCreatedAt")}</TableHead>
                  <TableHead>{t("columnApprovedAt")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`${ROUTES.dashboard}/lessons/${v.lessonId}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <BookOpenIcon className="size-4 text-muted-foreground" />
                        {v.lessonName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">v{v.versionNumber}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{v.level}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusBadge[v.status].className}>{statusBadge[v.status].label}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{dateFormatter.format(v.createdAt)}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.approvedAt ? dateFormatter.format(v.approvedAt) : "—"}
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
