"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const POLL_INTERVAL_MS = 4000;

// Lesson generation now runs in a Trigger.dev background task (outside
// Vercel's function timeout), so this page can render before it finishes.
// Poll for the state change instead of the user having to refresh by hand.
export function GenerationPoller() {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => router.refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [router]);

  return null;
}
