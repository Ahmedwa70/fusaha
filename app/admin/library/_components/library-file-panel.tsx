"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { uploadLibraryBookFile } from "@/actions/library-files";

export type AttachedLibraryFile = {
  originalFilename: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
};

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  const units = ["KB", "MB", "GB"];
  let value = size / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit]}`;
}

export function LibraryFilePanel({ bookId, file }: { bookId: string; file: AttachedLibraryFile | null }) {
  const t = useTranslations("admin.library");
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const onSubmit = () => {
    const selected = inputRef.current?.files?.[0];
    setError(null);
    setNotice(null);
    if (!selected) {
      setError(t("errors.invalidFile"));
      return;
    }
    const formData = new FormData();
    formData.set("file", selected);
    startTransition(async () => {
      const result = await uploadLibraryBookFile(bookId, formData);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setNotice(result.deduplicated ? t("deduplicatedNotice") : t("saved"));
      window.location.reload();
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("fileSection")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {file ? (
          <dl className="grid gap-2 rounded-xl border p-4 text-sm sm:grid-cols-2">
            <div><dt className="font-bold">{t("fileName")}</dt><dd className="break-all text-muted-foreground">{file.originalFilename}</dd></div>
            <div><dt className="font-bold">{t("fileSize")}</dt><dd className="text-muted-foreground">{formatBytes(file.sizeBytes)}</dd></div>
            <div><dt className="font-bold">{t("fileSha")}</dt><dd className="break-all text-muted-foreground" dir="ltr">{file.sha256.slice(0, 16)}…</dd></div>
            <div><dt className="font-bold">{t("fileUploadedAt")}</dt><dd className="text-muted-foreground">{new Date(file.createdAt).toLocaleString()}</dd></div>
          </dl>
        ) : (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("fileNone")}</p>
        )}
        <p className="text-xs text-muted-foreground">{t("uploadReplaceHint")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <input ref={inputRef} type="file" accept="application/pdf" className="text-sm" />
          <Button type="button" disabled={pending} onClick={onSubmit}>{pending ? t("uploading") : t("upload")}</Button>
        </div>
        {notice && <p className="text-sm text-emerald-600">{notice}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
