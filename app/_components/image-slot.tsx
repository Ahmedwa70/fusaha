import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// Placeholder for a real screenshot/photo the client will drop in later.
// Styled as an intentional frame, not an apologetic broken box.
export function ImageSlot({
  label,
  className,
  ratio = "aspect-[4/3]",
}: {
  label: string;
  className?: string;
  ratio?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-300/60 bg-brand-50/60 px-6 text-center dark:border-gold-400/25 dark:bg-white/5",
        ratio,
        className
      )}
    >
      <ImageIcon className="size-6 text-brand-400 dark:text-gold-400/70" strokeWidth={1.5} />
      <p className="max-w-[22ch] text-xs leading-relaxed text-brand-700/70 dark:text-gold-100/60">{label}</p>
    </div>
  );
}
