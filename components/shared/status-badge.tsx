"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";

export function StatusBadge({ active }: { active: boolean }) {
  const t = useTranslations("common.status");
  return (
    <Badge className={active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
      {active ? t("active") : t("inactive")}
    </Badge>
  );
}
