// Parses a single "bytes=start-end" Range request header into a normalized
// "bytes=start-end" header for the storage fetch. Returns null when the
// header is missing or malformed — callers then fall back to a full 200
// response (auth has already been enforced before this runs).
//
// The returned object carries `totalHint` (end may be open: "bytes=0-").
export type ParsedByteRange = { header: string; start: number; end?: number };

export function parseByteRange(rangeHeader: string | null): ParsedByteRange | null {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d+)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) return null;
  const start = Number(match[1]);
  if (match[2] === "") {
    if (start < 0) return null;
    return { header: `bytes=${start}-`, start };
  }
  const end = Number(match[2]);
  if (end < start) return null;
  return { header: `bytes=${start}-${end}`, start, end };
}
