import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/dal";
import { getApprovedLessonForPlay } from "@/lib/dashboard/queries/lesson";
import { composePlayerHtml } from "@/lib/templates/compose-player-html";

// Not requireTeacher(): that redirects unauthenticated/wrong-role requests to
// /login, which would load the login page's HTML inside this iframe — a
// route handler serving an iframe src should just fail closed instead.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.roleName !== "teacher") return new NextResponse(null, { status: 401 });

  const { id } = await params;
  const lesson = await getApprovedLessonForPlay(user.id, id);
  if (!lesson) return new NextResponse(null, { status: 404 });

  const html = composePlayerHtml(lesson.htmlPlayer, lesson.content);
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
