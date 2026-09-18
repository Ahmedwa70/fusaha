import "server-only";
import mammoth from "mammoth";
import { MAX_TEXT_WORDS, MAX_PDF_PAGES } from "@/constants/lesson-source-limits";

export type ExtractedFileText =
  | { ok: true; kind: "pdf" | "docx"; text: string }
  | { ok: false; error: "unsupportedFileType" | "pdfTooLong" | "fileTooLong" | "fileExtractionFailed" };

export async function extractTextFromFile(file: File): Promise<ExtractedFileText> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = file.name.toLowerCase();

  if (name.endsWith(".pdf") || file.type === "application/pdf") return extractPdfText(buffer);
  if (name.endsWith(".docx") || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractDocxText(buffer);
  }
  return { ok: false, error: "unsupportedFileType" };
}

async function extractPdfText(buffer: Buffer): Promise<ExtractedFileText> {
  // Loaded lazily: pdf-parse pulls in pdfjs-dist, which references browser-only
  // APIs (DOMMatrix) at module-evaluation time. A static top-level import would
  // make that failure crash every submission, including ones with no PDF at all.
  // Kept inside the try so a broken pdfjs-dist load still fails gracefully.
  let parser: InstanceType<Awaited<typeof import("pdf-parse")>["PDFParse"]> | undefined;
  try {
    const { PDFParse } = await import("pdf-parse");
    parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    if (result.total > MAX_PDF_PAGES) return { ok: false, error: "pdfTooLong" };
    const text = result.pages.map((p) => p.text).join("\n\n").trim();
    return { ok: true, kind: "pdf", text };
  } catch {
    return { ok: false, error: "fileExtractionFailed" };
  } finally {
    await parser?.destroy();
  }
}

async function extractDocxText(buffer: Buffer): Promise<ExtractedFileText> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    if (wordCount > MAX_TEXT_WORDS) return { ok: false, error: "fileTooLong" };
    return { ok: true, kind: "docx", text };
  } catch {
    return { ok: false, error: "fileExtractionFailed" };
  }
}
