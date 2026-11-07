import { getLibraryObject, getLibraryObjectRange } from "@/lib/library/storage/r2-client";
import { resolveLibraryBookAccess } from "@/lib/library/viewer";
import { parseByteRange } from "@/lib/library/http-range";

// In-platform PDF stream for the embedded reader. The browser only ever
// sees this same-origin route; the R2 hostname, bucket, and object key are
// resolved and signed server-side and never leave the server. Auth is
// enforced on EVERY request — including direct links and Range requests —
// before a single byte is touched.
export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await resolveLibraryBookAccess(slug);
  if (!access.bundle) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  if (!access.read.allowed) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const fileName = encodeURIComponent(access.bundle.file.originalFilename);
  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename*=UTF-8''${fileName}`,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Accept-Ranges": "bytes",
  };

  try {
    const range = parseByteRange(request.headers.get("range"));
    if (range) {
      const object = await getLibraryObjectRange(access.bundle.file.storageKey, range.header);
      if (object.status === 416) {
        return new Response(null, { status: 416, headers: { ...baseHeaders, "Content-Range": `bytes */${object.total}` } });
      }
      return new Response(object.body, {
        status: 206,
        headers: {
          ...baseHeaders,
          "Content-Range": `bytes ${object.start}-${object.end}/${object.total}`,
          "Content-Length": String(object.end - object.start + 1),
        },
      });
    }

    const object = await getLibraryObject(access.bundle.file.storageKey);
    const headers: Record<string, string> = { ...baseHeaders };
    if (object.contentLength != null) headers["Content-Length"] = String(object.contentLength);
    return new Response(object.body, { headers });
  } catch {
    return Response.json({ error: "storage_unavailable" }, { status: 502 });
  }
}
