import type { ReactNode } from "react";

export function InfoField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <div className="text-sm font-medium text-foreground wrap-break-word">{value ?? "—"}</div>
    </div>
  );
}
