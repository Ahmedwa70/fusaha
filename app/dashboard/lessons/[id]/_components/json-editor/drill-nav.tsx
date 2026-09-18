"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type DrillEntry = {
  name: string;
  label: string;
  value: unknown;
};

type DrillNavValue = {
  stack: DrillEntry[];
  push: (entry: DrillEntry) => void;
  pop: () => void;
  close: () => void;
};

const DrillNavContext = createContext<DrillNavValue | null>(null);

// Small screens can't afford to show every nesting level inline (each level
// compounds its own border/padding, and text can only shrink so far) — so on
// mobile, tapping into a nested object/array pushes a full-screen view
// instead of expanding an accordion in place. Desktop keeps the inline
// accordion and never touches this stack.
export function DrillNavProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<DrillEntry[]>([]);

  const push = useCallback((entry: DrillEntry) => setStack((prev) => [...prev, entry]), []);
  const pop = useCallback(() => setStack((prev) => prev.slice(0, -1)), []);
  const close = useCallback(() => setStack([]), []);

  const value = useMemo(() => ({ stack, push, pop, close }), [stack, push, pop, close]);

  return <DrillNavContext.Provider value={value}>{children}</DrillNavContext.Provider>;
}

export function useDrillNav() {
  const ctx = useContext(DrillNavContext);
  if (!ctx) throw new Error("useDrillNav must be used within a DrillNavProvider");
  return ctx;
}
