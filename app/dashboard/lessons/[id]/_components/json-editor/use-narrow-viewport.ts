import { useSyncExternalStore } from "react";

// Matches Tailwind's `sm` breakpoint (640px) — the same cutoff the rest of
// the dashboard uses to switch between mobile and desktop layouts, so the
// JSON editor's drill-down navigation kicks in exactly where other
// mobile-only UI in this app does.
const NARROW_QUERY = "(max-width: 639px)";

function subscribe(callback: () => void) {
  const mql = window.matchMedia(NARROW_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(NARROW_QUERY).matches;
}

function getServerSnapshot() {
  return false;
}

export function useNarrowViewport() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
