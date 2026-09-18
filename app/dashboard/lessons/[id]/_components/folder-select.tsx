"use client";

import { useState, useTransition } from "react";
import { FolderOpenIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { moveLessonToFolder } from "@/actions/lessons";

const UNFILED = "none";

export function FolderSelect({
  lessonId,
  folderId,
  folders,
}: {
  lessonId: string;
  folderId: string | null;
  folders: { id: string; name: string }[];
}) {
  const t = useTranslations("dashboard.lessonDetail");
  const [value, setValue] = useState(folderId ?? UNFILED);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const labelByValue: Record<string, string> = {
    [UNFILED]: t("noFolder"),
    ...Object.fromEntries(folders.map((f) => [f.id, f.name])),
  };

  function handleChange(next: string | null) {
    const target = next ?? UNFILED;
    const previous = value;
    setValue(target);
    setError(null);
    startTransition(async () => {
      const result = await moveLessonToFolder(lessonId, target === UNFILED ? null : target);
      if ("error" in result) {
        setError(result.error);
        setValue(previous);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={value} onValueChange={handleChange} disabled={isPending}>
        <SelectTrigger size="sm" className="h-auto gap-1 border-none bg-transparent p-0 text-sm text-muted-foreground hover:text-foreground">
          <FolderOpenIcon className="size-3.5" />
          <SelectValue>{(v: string) => labelByValue[v]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value={UNFILED}>{t("noFolder")}</SelectItem>
            {folders.map((folder) => (
              <SelectItem key={folder.id} value={folder.id}>
                {folder.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
