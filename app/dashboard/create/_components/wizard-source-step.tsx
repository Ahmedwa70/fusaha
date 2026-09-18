import { FileTextIcon, ImageIcon, InfoIcon, PlusIcon, UploadIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_IMAGES } from "@/constants/lesson-source-limits";
import type { SourceType, TextMode, UploadedFile, UploadedImage, Translator } from "./wizard-types";

export function WizardSourceStep({
  t,
  sourceType,
  setSourceType,
  textMode,
  setTextMode,
  text,
  setText,
  wordCount,
  textTooLong,
  file,
  onPickFile,
  onClearFile,
  images,
  onPickImages,
  onRemoveImage,
}: {
  t: Translator;
  sourceType: SourceType | null;
  setSourceType: (v: SourceType) => void;
  textMode: TextMode;
  setTextMode: (v: TextMode) => void;
  text: string;
  setText: (v: string) => void;
  wordCount: number;
  textTooLong: boolean;
  file: UploadedFile | null;
  onPickFile: () => void;
  onClearFile: () => void;
  images: UploadedImage[];
  onPickImages: () => void;
  onRemoveImage: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-center text-lg font-semibold">{t("chooseSourceTitle")}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        <SourceCard
          icon={FileTextIcon}
          title={t("textSourceTitle")}
          description={t("textSourceDescription")}
          selected={sourceType === "text"}
          onClick={() => setSourceType("text")}
        />
        <SourceCard
          icon={ImageIcon}
          title={t("imageSourceTitle")}
          description={t("imageSourceDescription")}
          selected={sourceType === "images"}
          onClick={() => setSourceType("images")}
        />
      </div>

      {sourceType === "text" && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={textMode === "write" ? "default" : "outline"} onClick={() => setTextMode("write")}>
              {t("writeText")}
            </Button>
            <Button type="button" size="sm" variant={textMode === "upload" ? "default" : "outline"} onClick={() => setTextMode("upload")}>
              {t("uploadFile")}
            </Button>
          </div>

          {textMode === "write" ? (
            <div className="flex flex-col gap-1.5">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder={t("textPlaceholder")}
                className={cn(
                  "w-full resize-y rounded-lg border bg-transparent p-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  textTooLong ? "border-destructive" : "border-input"
                )}
              />
              <p className={cn("text-xs", textTooLong ? "text-destructive" : "text-muted-foreground")}>
                {t("wordCount", { count: wordCount })} {textTooLong && t("textTooLong")}
              </p>
            </div>
          ) : file ? (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center gap-2">
                <FileTextIcon className="size-5 text-primary" />
                <div>
                  <p className="text-sm font-medium">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{file.sizeLabel}</p>
                </div>
              </div>
              <Button type="button" size="icon" variant="ghost" onClick={onClearFile}>
                <XIcon />
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onPickFile}
              className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-muted-foreground transition-colors hover:border-primary hover:text-primary"
            >
              <UploadIcon className="size-6" />
              <span className="text-sm">{t("uploadPrompt")}</span>
            </button>
          )}
        </div>
      )}

      {sourceType === "images" && (
        <div className="flex flex-col gap-3 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {images.map((img) => (
              <div key={img.id} className="group relative aspect-square overflow-hidden rounded-lg border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => onRemoveImage(img.id)}
                  className="absolute inset-e-1 top-1 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow"
                >
                  <XIcon className="size-3.5" />
                </button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={onPickImages}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
              >
                <PlusIcon className="size-5" />
                <span className="text-xs">{t("addImage")}</span>
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{t("imagesCount", { count: images.length, max: MAX_IMAGES })}</p>
        </div>
      )}

      <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-4">
        <p className="flex items-center gap-1.5 font-semibold text-primary">
          <InfoIcon className="size-4" />
          {t("reminderTitle")}
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          <li>{t("reminderText1")}</li>
          <li>{t("reminderText2")}</li>
          <li>{t("reminderText3")}</li>
        </ul>
      </div>
    </div>
  );
}

function SourceCard({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border-2 p-6 text-center transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      )}
    >
      <Icon className={cn("size-8", selected ? "text-primary" : "text-muted-foreground")} />
      <span className="font-semibold">{title}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}
