import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LevelOption, Translator } from "./wizard-types";

export function WizardLevelStep({
  t,
  levelOptions,
  schemaDefinitionId,
  setSchemaDefinitionId,
}: {
  t: Translator;
  levelOptions: LevelOption[];
  schemaDefinitionId: string | null;
  setSchemaDefinitionId: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-center text-lg font-semibold">{t("levelStepTitle")}</h2>
      <div className="flex flex-col gap-3">
        {levelOptions.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setSchemaDefinitionId(option.id)}
            aria-pressed={schemaDefinitionId === option.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border-2 p-4 text-start transition-colors",
              schemaDefinitionId === option.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
            )}
          >
            <div
              className={cn(
                "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                schemaDefinitionId === option.id
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-muted-foreground/30"
              )}
            >
              {schemaDefinitionId === option.id && <CheckIcon className="size-3.5" />}
            </div>
            <p className="font-semibold">{option.level}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
