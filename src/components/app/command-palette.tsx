"use client";

import {
  ArrowRightLeftIcon,
  KeyboardIcon,
  LogOutIcon,
  PlusIcon,
  SettingsIcon,
  UserPlusIcon,
  ZapIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useTransition } from "react";

import { signOut } from "@/app/(auth)/actions";
import { THEMES } from "@/components/theme";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import { Kbd } from "@/components/ui/kbd";
import { gymHref, SECTIONS, SETTINGS_PAGES } from "@/lib/navigation";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";

import { useShell } from "./shell-context";

function Keys({ keys }: { keys: string[] }) {
  return (
    <CommandShortcut>
      {keys.map((k) => (
        <Kbd key={k}>{k}</Kbd>
      ))}
    </CommandShortcut>
  );
}

/** ⌘K: every page and action, by keyboard. */
export function CommandPalette({ gyms, current }: { gyms: GymMembership[]; current: GymMembership | null }) {
  const { paletteOpen, setPaletteOpen, setShortcutsOpen, pageCommands } = useShell();
  const router = useRouter();
  const { setTheme } = useTheme();
  const [, startTransition] = useTransition();

  const run = (action: () => void) => {
    setPaletteOpen(false);
    action();
  };
  const go = (href: string) => run(() => router.push(href));

  return (
    <CommandDialog
      open={paletteOpen}
      onOpenChange={setPaletteOpen}
      title="Command palette"
      description="Go to a page or run an action. Type to filter, Enter to choose."
    >
      <Command loop>
        <CommandInput placeholder="Go to or do…" aria-label="Search pages and actions" />
        <CommandList>
          <CommandEmpty>Nothing matches.</CommandEmpty>

          {pageCommands.length > 0 && (
            <CommandGroup heading="This page">
              {pageCommands.map((c) => (
                <CommandItem key={c.id} value={c.label} onSelect={() => run(c.run)}>
                  <ZapIcon />
                  {c.label}
                  {c.keys && <Keys keys={c.keys} />}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {current && (
            <CommandGroup heading="Go to">
              {SECTIONS.filter((s) => s.key !== "settings").map((s) => (
                <CommandItem key={s.key} value={`Go to ${s.label}`} onSelect={() => go(gymHref(current.slug, s.path))}>
                  <s.icon />
                  {s.label}
                  <Keys keys={["G", s.shortcut.toUpperCase()]} />
                </CommandItem>
              ))}
              {SETTINGS_PAGES.map((p) => (
                <CommandItem
                  key={p.key}
                  value={`Settings ${p.label}`}
                  onSelect={() => go(gymHref(current.slug, p.path))}
                >
                  <SettingsIcon />
                  Settings: {p.label}
                  {p.shortcut && <Keys keys={["G", p.shortcut.toUpperCase()]} />}
                  {p.key === "gym" && <Keys keys={["G", "S"]} />}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {current && (can.manageMembers(current.role) || can.manageTracks(current.role)) && (
            <CommandGroup heading="Actions">
              {can.manageMembers(current.role) && (
                <CommandItem value="Invite a member" onSelect={() => go(`${gymHref(current.slug, "settings/members")}?invite=1`)}>
                  <UserPlusIcon />
                  Invite a member
                </CommandItem>
              )}
              {can.manageTracks(current.role) && (
                <CommandItem value="New track" onSelect={() => go(`${gymHref(current.slug, "settings/tracks")}?new=1`)}>
                  <PlusIcon />
                  New track
                </CommandItem>
              )}
            </CommandGroup>
          )}

          <CommandGroup heading="Gyms">
            {gyms
              .filter((g) => g.slug !== current?.slug)
              .map((g) => (
                <CommandItem key={g.id} value={`Switch to ${g.name}`} onSelect={() => go(gymHref(g.slug, "builder"))}>
                  <ArrowRightLeftIcon />
                  Switch to {g.name}
                </CommandItem>
              ))}
            <CommandItem value="Create a gym" onSelect={() => go("/onboarding")}>
              <PlusIcon />
              Create a gym
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Preferences">
            {THEMES.map((t) => (
              <CommandItem key={t.value} value={`Theme ${t.label}`} onSelect={() => run(() => setTheme(t.value))}>
                <t.icon />
                Theme: {t.label}
              </CommandItem>
            ))}
            <CommandItem value="Keyboard shortcuts" onSelect={() => run(() => setShortcutsOpen(true))}>
              <KeyboardIcon />
              Keyboard shortcuts
              <Keys keys={["?"]} />
            </CommandItem>
          </CommandGroup>

          <CommandGroup heading="Account">
            <CommandItem value="Sign out" onSelect={() => run(() => startTransition(() => signOut()))}>
              <LogOutIcon />
              Sign out
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
