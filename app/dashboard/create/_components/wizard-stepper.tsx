import { CheckIcon } from "lucide-react";
import { useDirection } from "@/components/ui/direction";
import { cn } from "@/lib/utils";
import type { Translator } from "./wizard-types";

const STEP_IDS = [1, 2, 3] as const;

export function WizardStepper({ current, t }: { current: number; t: Translator }) {
  const direction = useDirection();
  const steps = STEP_IDS.map((id) => ({ id, label: t(`step${id}` as "step1" | "step2" | "step3") }));

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-6" dir={direction}>
      {steps.map((s, i, arr) => (
        <div key={s.id} className="flex items-center gap-3 sm:gap-6">
          <div className="flex flex-col items-center gap-2">
            <div
              className={cn(
                "flex size-10 items-center justify-center rounded-full border-2 text-sm font-semibold",
                s.id === current
                  ? "border-primary bg-primary text-primary-foreground"
                  : s.id < current
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {s.id < current ? <CheckIcon className="size-4" /> : s.id}
            </div>
            <span className={cn("text-sm", s.id === current ? "font-semibold text-foreground" : "text-muted-foreground")}>
              {s.label}
            </span>
          </div>
          {i < arr.length - 1 && (
            <div className={cn("h-0.5 w-10 sm:w-24", s.id < current ? "bg-primary" : "bg-muted-foreground/20")} />
          )}
        </div>
      ))}
    </div>
  );
}
