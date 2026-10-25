"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ active }: { active: boolean }) {
  const t = useTranslations("common.status");
  return (
    <Badge className={active ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"}>
      {active ? t("active") : t("inactive")}
    </Badge>
  );
}
