import { Card, CardContent } from "@/components/ui/card";

export function StatCard({
  icon: Icon,
  value,
  label,
  tint,
  suffix,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: number;
  label: string;
  tint: string;
  suffix?: string;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1.5 py-1 text-center sm:gap-2 sm:py-6">
        <div className={`flex size-8 items-center justify-center rounded-full sm:size-10 ${tint}`}>
          <Icon className="size-4 sm:size-5" />
        </div>
        <p className="text-xl font-bold sm:text-2xl">
          {value}
          {suffix}
        </p>
        <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      </CardContent>
    </Card>
  );
}
