"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLessonWizard } from "@/app/dashboard/create/_hooks/use-lesson-wizard";
import { WizardStepper } from "./wizard-stepper";
import { WizardSourceStep } from "./wizard-source-step";
import { WizardLevelStep } from "./wizard-level-step";
import { WizardReviewStep } from "./wizard-review-step";
import { WizardSummaryPanel } from "./wizard-summary-panel";
import type { LevelOption } from "./wizard-types";

export function CreateLessonWizard({
  levelOptions,
  generationCost,
}: {
  levelOptions: LevelOption[];
  generationCost: number;
}) {
  const {
    t,
    step,
    setStep,
    sourceType,
    setSourceType,
    textMode,
    setTextMode,
    text,
    setText,
    file,
    setFile,
    images,
    schemaDefinitionId,
    setSchemaDefinitionId,
    lessonName,
    setLessonName,
    submitting,
    submitted,
    error,
    fileInputRef,
    imageInputRef,
    wordCount,
    textTooLong,
    step1Valid,
    step2Valid,
    handleFileChange,
    handleImagesChange,
    removeImage,
    handleGenerate,
  } = useLessonWizard();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <WizardStepper current={step} t={t} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <Card>
          <CardContent className="flex flex-col gap-6">
            {step === 1 && (
              <WizardSourceStep
                t={t}
                sourceType={sourceType}
                setSourceType={setSourceType}
                textMode={textMode}
                setTextMode={setTextMode}
                text={text}
                setText={setText}
                wordCount={wordCount}
                textTooLong={textTooLong}
                file={file}
                onPickFile={() => fileInputRef.current?.click()}
                onClearFile={() => setFile(null)}
                images={images}
                onPickImages={() => imageInputRef.current?.click()}
                onRemoveImage={removeImage}
              />
            )}

            {step === 2 && (
              <WizardLevelStep
                t={t}
                levelOptions={levelOptions}
                schemaDefinitionId={schemaDefinitionId}
                setSchemaDefinitionId={setSchemaDefinitionId}
              />
            )}

            {step === 3 && (
              <WizardReviewStep
                t={t}
                sourceType={sourceType}
                text={text}
                textMode={textMode}
                file={file}
                images={images}
                levelOptions={levelOptions}
                schemaDefinitionId={schemaDefinitionId}
                lessonName={lessonName}
                setLessonName={setLessonName}
                submitting={submitting}
                submitted={submitted}
                error={error}
                generationCost={generationCost}
                onGenerate={handleGenerate}
              />
            )}

            <input ref={fileInputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={handleFileChange} />
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImagesChange}
            />

            {!submitted && (
              <div className="flex items-center justify-between border-t pt-4">
                <Button
                  type="button"
                  variant="outline"
                  disabled={step === 1}
                  onClick={() => setStep((s) => Math.max(1, s - 1))}
                >
                  {t("back")}
                </Button>
                {step < 3 ? (
                  <Button
                    type="button"
                    disabled={(step === 1 && !step1Valid) || (step === 2 && !step2Valid)}
                    onClick={() => setStep((s) => Math.min(3, s + 1))}
                  >
                    {t("next")}
                  </Button>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>

        {!submitted && (
          <WizardSummaryPanel
            t={t}
            step={step}
            sourceType={sourceType}
            textMode={textMode}
            text={text}
            file={file}
            images={images}
            levelOptions={levelOptions}
            schemaDefinitionId={schemaDefinitionId}
            lessonName={lessonName}
            generationCost={generationCost}
          />
        )}
      </div>
    </div>
  );
}
