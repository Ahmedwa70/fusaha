import { useId } from "react";
import { CheckIcon, InfoIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SourceType, TextMode, UploadedFile, UploadedImage, LevelOption, Translator } from "./wizard-types";

export function WizardReviewStep({
  t,
  sourceType,
  text,
  textMode,
  file,
  images,
  levelOptions,
  schemaDefinitionId,
  lessonName,
  setLessonName,
  submitting,
  submitted,
  error,
  generationCost,
  onGenerate,
}: {
  t: Translator;
  sourceType: SourceType | null;
  text: string;
  textMode: TextMode;
  file: UploadedFile | null;
  images: UploadedImage[];
  levelOptions: LevelOption[];
  schemaDefinitionId: string | null;
  lessonName: string;
  setLessonName: (v: string) => void;
  submitting: boolean;
  submitted: boolean;
  error: string | null;
  generationCost: number;
  onGenerate: () => void;
}) {
  const nameId = useId();
  const levelTitle = levelOptions.find((o) => o.id === schemaDefinitionId)?.level;

  if (submitted) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckIcon className="size-7" />
        </div>
        <h2 className="text-lg font-semibold">{t("successTitle")}</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{t("successDescription")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-center text-lg font-semibold">{t("reviewStepTitle")}</h2>

      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <SummaryRow
          label={t("summarySource")}
          value={
            sourceType === "images"
              ? t("sourceImagesCount", { count: images.length })
              : textMode === "write"
                ? t("sourceWrittenText", { count: text.trim() === "" ? 0 : text.trim().split(/\s+/).length })
                : (file?.name ?? "—")
          }
        />
        <SummaryRow label={t("summaryLevel")} value={levelTitle ?? "—"} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={nameId}>{t("lessonNameLabel")}</Label>
        <Input
          id={nameId}
          value={lessonName}
          onChange={(e) => setLessonName(e.target.value)}
          placeholder={t("lessonNamePlaceholder")}
        />
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">
        <InfoIcon className="mt-0.5 size-4 shrink-0" />
        <p>{t.rich("creditsWarning", { cost: generationCost, strong: (chunks) => <strong>{chunks}</strong> })}</p>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Button type="button" size="lg" disabled={submitting} onClick={onGenerate} className="gap-1.5">
        {submitting ? (
          <>
            <Loader2Icon data-icon="inline-start" className="animate-spin" />
            {t("generating")}
          </>
        ) : (
          t("generateButton")
        )}
      </Button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
