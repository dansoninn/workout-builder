"use client";

import { createContext, use, useMemo, useState } from "react";

type Shell = {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
};

const ShellContext = createContext<Shell | null>(null);

/** Open/closed state shared by the sidebar, the page headers and the command palette. */
export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const value = useMemo(
    () => ({ navOpen, setNavOpen, paletteOpen, setPaletteOpen, shortcutsOpen, setShortcutsOpen }),
    [navOpen, paletteOpen, shortcutsOpen],
  );
  return <ShellContext value={value}>{children}</ShellContext>;
}

export function useShell(): Shell {
  const shell = use(ShellContext);
  if (!shell) throw new Error("useShell must be used inside ShellProvider");
  return shell;
}
