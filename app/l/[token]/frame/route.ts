import { NextResponse } from "next/server";
import { getApprovedLessonByShareToken } from "@/lib/dashboard/queries/lesson";
import { composePlayerHtml } from "@/lib/templates/compose-player-html";

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lesson = await getApprovedLessonByShareToken(token);
  if (!lesson) return new NextResponse(null, { status: 404 });

  const html = composePlayerHtml(lesson.htmlPlayer, lesson.content);
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
