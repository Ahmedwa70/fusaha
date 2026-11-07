// Mutable stub for @/lib/library/storage/r2-client — records every storage
// call so tests can prove that denied requests never touch the bucket.
export const r2State = {
  object: null, // { body, contentLength }
  rangeObject: null, // { status: 206, body, start, end, total } | { status: 416, total }
  calls: [],
};

export async function getLibraryObject(key) {
  r2State.calls.push({ kind: "full", key });
  if (!r2State.object) throw new Error("r2 stub: no full object configured");
  return r2State.object;
}

export async function getLibraryObjectRange(key, rangeHeader) {
  r2State.calls.push({ kind: "range", key, rangeHeader });
  if (!r2State.rangeObject) throw new Error("r2 stub: no range object configured");
  return r2State.rangeObject;
}
