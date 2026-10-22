import {
  CalendarDaysIcon,
  ChartColumnIcon,
  ClipboardCheckIcon,
  DumbbellIcon,
  LayoutListIcon,
  type LucideIcon,
  SettingsIcon,
} from "lucide-react";

/** The app's main sections. `shortcut` is the key after G (G then B = Builder). */
export const SECTIONS: readonly {
  key: string;
  label: string;
  path: string;
  shortcut: string;
  icon: LucideIcon;
}[] = [
  { key: "builder", label: "Builder", path: "builder", shortcut: "b", icon: LayoutListIcon },
  { key: "calendar", label: "Calendar", path: "calendar", shortcut: "c", icon: CalendarDaysIcon },
  { key: "results", label: "Results", path: "results", shortcut: "r", icon: ClipboardCheckIcon },
  { key: "analytics", label: "Analytics", path: "analytics", shortcut: "a", icon: ChartColumnIcon },
  { key: "exercises", label: "Exercises", path: "exercises", shortcut: "e", icon: DumbbellIcon },
  { key: "settings", label: "Settings", path: "settings/gym", shortcut: "s", icon: SettingsIcon },
];

export const SETTINGS_PAGES: readonly { key: string; label: string; path: string; shortcut?: string }[] = [
  { key: "gym", label: "Gym", path: "settings/gym" },
  { key: "members", label: "Members", path: "settings/members" },
  { key: "tracks", label: "Tracks", path: "settings/tracks" },
  { key: "paces", label: "Paces", path: "settings/paces" },
  { key: "guidelines", label: "Guidelines", path: "settings/guidelines" },
  { key: "profile", label: "Profile", path: "settings/profile", shortcut: "p" },
];

/** G-then-key shortcuts → path inside the gym. */
export const GO_TO_SHORTCUTS: Readonly<Record<string, string>> = Object.fromEntries(
  [...SECTIONS, ...SETTINGS_PAGES].flatMap((s) => (s.shortcut ? [[s.shortcut, s.path]] : [])),
);

export function gymHref(slug: string, path: string): string {
  return `/${slug}/${path}`;
}

/** The section part of a gym path: "/afrek/settings/members" → "settings/members". */
export function sectionPathOf(pathname: string): string {
  return pathname.split("/").filter(Boolean).slice(1).join("/");
}

/** Everything in one list for the shortcuts dialog. */
export const SHORTCUT_GROUPS: readonly { title: string; items: readonly { keys: string[]; label: string }[] }[] = [
  {
    title: "Anywhere",
    items: [
      { keys: ["⌘", "K"], label: "Command palette: go anywhere, do anything" },
      { keys: ["?"], label: "Show keyboard shortcuts" },
      { keys: ["Esc"], label: "Close a dialog or menu" },
    ],
  },
  {
    title: "Go to",
    items: [...SECTIONS, ...SETTINGS_PAGES.filter((p) => p.shortcut)].map((s) => ({
      keys: ["G", (s.shortcut ?? "").toUpperCase()],
      label: s.key === "profile" ? "Your profile" : s.label,
    })),
  },
  {
    title: "In the builder",
    items: [
      { keys: ["⌘", "S"], label: "Save the workout" },
      { keys: ["Enter"], label: "New line below" },
      { keys: ["⌘", "Enter"], label: "New block below" },
      { keys: ["⌥", "↑ ↓"], label: "Move the line" },
      { keys: ["⌘", "⌫"], label: "Delete the line" },
    ],
  },
];
