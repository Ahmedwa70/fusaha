"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BookOpenIcon, PlusIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import { DashboardFilterSelect } from "@/components/dashboard/filter-select";
import { LessonsTable } from "@/components/dashboard/lessons-table";
import { lessonStateLabelKey } from "@/components/dashboard/lesson-state-badge";
import { LessonState } from "@/database/schema";
import type { LessonListItem } from "@/lib/dashboard/queries/lesson";

const GENERATING_POLL_INTERVAL_MS = 4000;

export function LessonsExplorer({
  lessons,
  folders,
  icon = <BookOpenIcon className="size-5 text-primary" />,
  title,
  description,
  initialFolder,
}: {
  lessons: LessonListItem[];
  folders: { id: string; name: string }[];
  icon?: React.ReactNode;
  title: string;
  description: string;
  /** Folder id to pre-select, e.g. when arriving from the Folders page. */
  initialFolder?: string;
}) {
  const t = useTranslations("dashboard.explorer");
  const tStates = useTranslations("dashboard.lessonStates");
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("all");
  const [state, setState] = useState("all");
  const [folder, setFolder] = useState(initialFolder ?? "all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilterCount = [level, state, folder].filter((v) => v !== "all").length;

  const hasGeneratingLesson = lessons.some((l) => l.state === LessonState.Generating);

  // Lessons generate in a Trigger.dev background task, so a lesson can flip
  // from Generating to Draft/Failed while this list is open — poll for that
  // instead of the user having to refresh by hand.
  useEffect(() => {
    if (!hasGeneratingLesson) return;
    const interval = setInterval(() => router.refresh(), GENERATING_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [hasGeneratingLesson, router]);

  const levels = useMemo(
    () => Array.from(new Set(lessons.map((l) => l.level).filter((l): l is string => l != null))).sort(),
    [lessons]
  );

  const filtered = lessons.filter((lesson) => {
    if (search.trim() && !lesson.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (level !== "all" && String(lesson.level) !== level) return false;
    if (state !== "all" && String(lesson.state) !== state) return false;
    if (folder !== "all" && lesson.folderName !== folders.find((f) => f.id === folder)?.name) return false;
    return true;
  });

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {icon}
            <div className="min-w-0">
              <p className="truncate font-semibold">{title}</p>
              <p className="truncate text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Link
            href={ROUTES.dashboardCreate}
            aria-label={t("createNew")}
            className={cn(buttonVariants(), "shrink-0 justify-center gap-1.5 px-3 sm:px-4")}
          >
            <PlusIcon />
            <span className="hidden sm:inline">{t("createNew")}</span>
          </Link>
        </div>

        {lessons.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {/* Desktop / tablet: filters shown inline */}
            <div className="hidden flex-wrap gap-3 sm:flex">
              <DashboardFilterSelect
                value={level}
                onValueChange={setLevel}
                options={[
                  { value: "all", label: t("allLevels") },
                  ...levels.map((l) => ({ value: l, label: l })),
                ]}
              />
              <DashboardFilterSelect
                value={state}
                onValueChange={setState}
                options={[
                  { value: "all", label: t("allStates") },
                  ...Object.entries(lessonStateLabelKey).map(([value, key]) => ({ value, label: tStates(key) })),
                ]}
              />
              <DashboardFilterSelect
                value={folder}
                onValueChange={setFolder}
                options={[
                  { value: "all", label: t("allFolders") },
                  ...folders.map((f) => ({ value: f.id, label: f.name })),
                ]}
              />
            </div>

            <div className="flex w-full min-w-0 gap-2 sm:ms-auto sm:w-auto">
              <div className="relative min-w-0 flex-1 sm:min-w-56 md:flex-none">
                <SearchIcon className="pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("searchPlaceholder")}
                  className="ps-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {/* Mobile: filters collapsed behind a filter button + bottom sheet */}
              <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="relative shrink-0 sm:hidden"
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontalIcon />
                  <span className="sr-only">{t("filters")}</span>
                  {activeFilterCount > 0 && (
                    <Badge className="absolute -top-1.5 -inset-e-1.5 size-4 justify-center p-0 text-[10px]">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
                <SheetContent side="bottom" className="sm:hidden">
                  <SheetHeader>
                    <SheetTitle>{t("filters")}</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-3 px-4 pb-4">
                    <DashboardFilterSelect
                      className="w-full"
                      value={level}
                      onValueChange={setLevel}
                      options={[
                        { value: "all", label: t("allLevels") },
                        ...levels.map((l) => ({ value: l, label: l })),
                      ]}
                    />
                    <DashboardFilterSelect
                      className="w-full"
                      value={state}
                      onValueChange={setState}
                      options={[
                        { value: "all", label: t("allStates") },
                        ...Object.entries(lessonStateLabelKey).map(([value, key]) => ({
                          value,
                          label: tStates(key),
                        })),
                      ]}
                    />
                    <DashboardFilterSelect
                      className="w-full"
                      value={folder}
                      onValueChange={setFolder}
                      options={[
                        { value: "all", label: t("allFolders") },
                        ...folders.map((f) => ({ value: f.id, label: f.name })),
                      ]}
                    />
                    <SheetClose render={<Button type="button" />}>{t("applyFilters")}</SheetClose>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        )}

        <LessonsTable lessons={filtered} />
      </CardContent>
    </Card>
  );
}
