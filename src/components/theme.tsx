"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";

/** Light, dark or the device's setting; remembered in the browser. */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}

export const THEMES = [
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
  { value: "system", label: "System", icon: MonitorIcon },
] as const;

const subscribe = () => () => {};
/** True after hydration; the stored theme is unknown on the server. */
export function useMounted(): boolean {
  return useSyncExternalStore(subscribe, () => true, () => false);
}

/** Cycles light → dark → system. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const index = Math.max(0, THEMES.findIndex((t) => t.value === theme));
  const current = THEMES[index] ?? THEMES[2];
  const next = THEMES[(index + 1) % THEMES.length] ?? THEMES[0];
  const Icon = mounted ? current.icon : MonitorIcon;
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={() => setTheme(next.value)}
      aria-label={mounted ? `Theme: ${current.label}. Switch to ${next.label}` : "Switch theme"}
      title={mounted ? `Theme: ${current.label}` : undefined}
    >
      <Icon />
    </Button>
  );
}
