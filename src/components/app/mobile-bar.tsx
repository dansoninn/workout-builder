"use client";

import { MenuIcon, SearchIcon } from "lucide-react";

import { Logo } from "@/components/app/logo";
import { Button } from "@/components/ui/button";

import { useShell } from "./shell-context";

/** Top bar below the large-screen breakpoint, where the sidebar becomes a sheet. */
export function MobileBar() {
  const { setNavOpen, setPaletteOpen } = useShell();
  return (
    <div className="sticky top-0 z-30 flex h-12 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-2 backdrop-blur lg:hidden">
      <Button variant="ghost" size="icon" onClick={() => setNavOpen(true)} aria-label="Open navigation">
        <MenuIcon />
      </Button>
      <Logo className="flex-1" />
      <Button variant="ghost" size="icon" onClick={() => setPaletteOpen(true)} aria-label="Go to or do (Command K)">
        <SearchIcon />
      </Button>
    </div>
  );
}
