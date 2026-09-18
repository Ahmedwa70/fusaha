import { CheckCircle2Icon, CircleIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { SourceType, TextMode, UploadedFile, UploadedImage, LevelOption, Translator } from "./wizard-types";

export function WizardSummaryPanel({
  t,
  step,
  sourceType,
  textMode,
  text,
  file,
  images,
  levelOptions,
  schemaDefinitionId,
  lessonName,
  generationCost,
}: {
  t: Translator;
  step: number;
  sourceType: SourceType | null;
  textMode: TextMode;
  text: string;
  file: UploadedFile | null;
  images: UploadedImage[];
  levelOptions: LevelOption[];
  schemaDefinitionId: string | null;
  lessonName: string;
  generationCost: number;
}) {
  const levelTitle = levelOptions.find((o) => o.id === schemaDefinitionId)?.level;

  const sourceSummary =
    sourceType === "images"
      ? images.length > 0
        ? t("sourceImagesCount", { count: images.length })
        : null
      : sourceType === "text"
        ? textMode === "write"
          ? text.trim()
            ? t("sourceWrittenText", { count: text.trim().split(/\s+/).length })
            : null
          : (file?.name ?? null)
        : null;

  return (
    <Card className="bg-muted/30 lg:sticky lg:top-6">
      <CardContent className="flex flex-col gap-5">
        <div>
          <p className="text-sm font-semibold">{t("summaryTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("summarySubtitle")}</p>
        </div>

        <ul className="flex flex-col gap-3">
          <SummaryItem active={step === 1} label={t("summarySource")} value={sourceSummary} />
          <SummaryItem active={step === 2} label={t("summaryLevel")} value={levelTitle ?? null} />
          <SummaryItem active={step === 3} label={t("lessonNameLabel")} value={lessonName.trim() || null} />
        </ul>

        <div className="flex items-center justify-between rounded-lg bg-gold-100 px-3 py-2 text-gold-900 dark:bg-gold-900/30 dark:text-gold-200">
          <span className="text-sm font-medium">{t("summaryCreditsLabel")}</span>
          <span className="text-sm font-semibold tabular-nums">{t("summaryCredits", { cost: generationCost })}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryItem({ active, label, value }: { active: boolean; label: string; value: string | null }) {
  const done = value !== null;
  return (
    <li className="flex items-start gap-2.5">
      {done ? (
        <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      ) : (
        <CircleIcon className={cn("mt-0.5 size-4 shrink-0", active ? "text-primary" : "text-muted-foreground/40")} />
      )}
      <div className="flex min-w-0 flex-col">
        <span className={cn("text-sm", active && !done ? "font-medium text-foreground" : "text-muted-foreground")}>
          {label}
        </span>
        {done && <span className="truncate text-sm font-medium text-foreground">{value}</span>}
      </div>
    </li>
  );
}
