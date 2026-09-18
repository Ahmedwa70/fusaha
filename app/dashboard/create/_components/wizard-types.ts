import type { useTranslations } from "next-intl";

export type SourceType = "text" | "images";
export type TextMode = "write" | "upload";
export type UploadedFile = { name: string; sizeLabel: string; file: File };
export type UploadedImage = { id: string; name: string; url: string; file: File };
export type Translator = ReturnType<typeof useTranslations>;
export type LevelOption = { id: string; level: string };
