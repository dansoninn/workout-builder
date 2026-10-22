"use client";

import { createContext, use, useEffect, useMemo, useState } from "react";

/** An action the current page offers in the command palette (e.g. "Save workout"). */
export type PageCommand = { id: string; label: string; keys?: string[]; run: () => void };

type Shell = {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (open: boolean) => void;
  pageCommands: PageCommand[];
  setPageCommands: (commands: PageCommand[]) => void;
};

const ShellContext = createContext<Shell | null>(null);

/** Open/closed state shared by the sidebar, the page headers and the command palette. */
export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [pageCommands, setPageCommands] = useState<PageCommand[]>([]);
  const value = useMemo(
    () => ({ navOpen, setNavOpen, paletteOpen, setPaletteOpen, shortcutsOpen, setShortcutsOpen, pageCommands, setPageCommands }),
    [navOpen, paletteOpen, shortcutsOpen, pageCommands],
  );
  return <ShellContext value={value}>{children}</ShellContext>;
}

export function useShell(): Shell {
  const shell = use(ShellContext);
  if (!shell) throw new Error("useShell must be used inside ShellProvider");
  return shell;
}

/** Offers the page's commands in the palette while the page is open. */
export function usePageCommands(commands: PageCommand[]) {
  const { setPageCommands } = useShell();
  useEffect(() => {
    setPageCommands(commands);
    return () => setPageCommands([]);
  }, [commands, setPageCommands]);
}
