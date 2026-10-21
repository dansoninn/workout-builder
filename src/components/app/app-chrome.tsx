"use client";

import {
  CheckIcon,
  ChevronsUpDownIcon,
  KeyboardIcon,
  LogOutIcon,
  PlusIcon,
  SearchIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useTransition } from "react";

import { signOut } from "@/app/(auth)/actions";
import { THEMES, useMounted } from "@/components/theme";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GO_TO_SHORTCUTS, gymHref, SECTIONS, sectionPathOf } from "@/lib/navigation";
import { roleLabel } from "@/lib/permissions";
import type { CurrentUser, GymMembership } from "@/lib/session";
import { cn } from "@/lib/utils";

import { CommandPalette } from "./command-palette";
import { useShell } from "./shell-context";
import { ShortcutsDialog } from "./shortcuts-dialog";

type Props = { user: CurrentUser; gyms: GymMembership[]; current: GymMembership | null };

/**
 * Everything around the page that needs the user and their gyms: sidebar (a
 * sheet on small screens), command palette, shortcuts dialog and the global
 * keyboard handler.
 */
export function AppChrome(props: Props) {
  const { navOpen, setNavOpen } = useShell();
  useGlobalShortcuts(props.current);

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-border bg-surface-sunken lg:block">
        <SidebarContent {...props} />
      </aside>
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="bg-surface-sunken p-0 data-[side=left]:w-64" showCloseButton={false}>
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>Pages of {props.current?.name ?? "Workout Builder"}</SheetDescription>
          </SheetHeader>
          <SidebarContent {...props} />
        </SheetContent>
      </Sheet>
      <CommandPalette gyms={props.gyms} current={props.current} />
      <ShortcutsDialog />
    </>
  );
}

function SidebarContent({ user, gyms, current }: Props) {
  const { setPaletteOpen, setNavOpen } = useShell();
  const pathname = usePathname();
  const section = sectionPathOf(pathname);

  return (
    <div className="flex h-full flex-col gap-3 p-2">
      <GymSwitcher gyms={gyms} current={current} section={section} />

      <button
        type="button"
        onClick={() => {
          setNavOpen(false);
          setPaletteOpen(true);
        }}
        className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2 text-sm text-muted-foreground transition-colors duration-100 hover:bg-hover hover:text-foreground"
      >
        <SearchIcon className="size-4" aria-hidden />
        <span className="flex-1 text-left">Go to or do…</span>
        <span className="flex gap-0.5" aria-hidden>
          <Kbd>⌘</Kbd>
          <Kbd>K</Kbd>
        </span>
        <span className="sr-only">(Command K)</span>
      </button>

      {current && (
        <nav aria-label="Main" className="grid gap-px">
          {SECTIONS.map((s) => {
            const href = gymHref(current.slug, s.path);
            const active = section.split("/")[0] === s.path.split("/")[0];
            return (
              <Link
                key={s.key}
                href={href}
                aria-current={active ? "page" : undefined}
                onClick={() => setNavOpen(false)}
                className={cn(
                  "group flex h-7 items-center gap-2 rounded-md px-2 text-sm font-medium text-muted-foreground transition-colors duration-100 hover:bg-hover hover:text-foreground",
                  active && "bg-hover text-foreground",
                )}
              >
                <s.icon className="size-4 shrink-0" aria-hidden />
                <span className="flex-1">{s.label}</span>
                <span
                  className="hidden gap-0.5 text-2xs text-muted-foreground group-hover:flex group-focus-visible:flex"
                  aria-hidden
                >
                  <Kbd>G</Kbd>
                  <Kbd>{s.shortcut.toUpperCase()}</Kbd>
                </span>
              </Link>
            );
          })}
        </nav>
      )}

      <div className="mt-auto">
        <UserMenu user={user} current={current} />
      </div>
    </div>
  );
}

function GymMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground",
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function GymSwitcher({ gyms, current, section }: { gyms: GymMembership[]; current: GymMembership | null; section: string }) {
  const router = useRouter();
  const { setNavOpen } = useShell();
  const go = (href: string) => {
    setNavOpen(false);
    router.push(href);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-10 w-full items-center gap-2 rounded-md px-1.5 text-left transition-colors duration-100 hover:bg-hover aria-expanded:bg-hover"
        aria-label={current ? `${current.name}, switch gym` : "Choose a gym"}
      >
        {current ? (
          <>
            <GymMark name={current.name} />
            <span className="grid min-w-0 flex-1 leading-tight">
              <span className="truncate text-sm font-semibold">{current.name}</span>
              <span className="truncate text-xs text-muted-foreground">{roleLabel(current.role)}</span>
            </span>
          </>
        ) : (
          <span className="flex-1 px-1 text-sm font-medium text-muted-foreground">Choose a gym</span>
        )}
        <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Your gyms</DropdownMenuLabel>
          {gyms.map((g) => (
            <DropdownMenuItem key={g.id} onClick={() => go(gymHref(g.slug, current ? section || "builder" : "builder"))}>
              <GymMark name={g.name} className="size-5 text-2xs" />
              <span className="min-w-0 flex-1 truncate">{g.name}</span>
              {g.slug === current?.slug && <CheckIcon className="text-primary-text" aria-label="Current gym" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => go("/onboarding")}>
          <PlusIcon /> Create a gym
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function initials(user: CurrentUser): string {
  const source = user.displayName?.trim() || user.email;
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (user.displayName ? (parts[1]?.[0] ?? "") : "")).toUpperCase() || "?";
}

function UserMenu({ user, current }: { user: CurrentUser; current: GymMembership | null }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();
  const { setShortcutsOpen, setNavOpen } = useShell();
  const [, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 w-full items-center gap-2 rounded-md px-1.5 text-left transition-colors duration-100 hover:bg-hover aria-expanded:bg-hover"
        aria-label={`Account: ${user.displayName ?? user.email}`}
      >
        <span
          aria-hidden
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-border text-2xs font-semibold text-foreground"
        >
          {initials(user)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{user.displayName ?? user.email}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" side="top" align="start">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="grid">
            <span className="truncate font-medium text-foreground">{user.displayName ?? "Your account"}</span>
            <span className="truncate font-normal">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        {current && (
          <DropdownMenuItem
            onClick={() => {
              setNavOpen(false);
              router.push(gymHref(current.slug, "settings/profile"));
            }}
          >
            <UserIcon /> Profile <DropdownMenuShortcut>G P</DropdownMenuShortcut>
          </DropdownMenuItem>
        )}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {(() => {
              const Icon = THEMES.find((t) => t.value === (mounted ? theme : "system"))?.icon ?? THEMES[2].icon;
              return <Icon />;
            })()}
            Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={mounted ? theme : undefined} onValueChange={(v) => setTheme(String(v))}>
              {THEMES.map((t) => (
                <DropdownMenuRadioItem key={t.value} value={t.value}>
                  {t.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onClick={() => setShortcutsOpen(true)}>
          <KeyboardIcon /> Keyboard shortcuts <DropdownMenuShortcut>?</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => startTransition(() => signOut())}>
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
    Boolean(target.closest('[role="dialog"], [role="menu"], [role="listbox"]'))
  );
}

/** ⌘K anywhere; "?" and G-then-letter when not typing. */
function useGlobalShortcuts(current: GymMembership | null) {
  const router = useRouter();
  const { setPaletteOpen, setShortcutsOpen } = useShell();

  useEffect(() => {
    let gPressedAt = 0;
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && key === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        return;
      }
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey || event.isComposing) return;
      if (isTyping(event.target)) return;

      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (key === "g" && !event.shiftKey) {
        gPressedAt = event.timeStamp;
        return;
      }
      if (gPressedAt && event.timeStamp - gPressedAt < 1500) {
        gPressedAt = 0;
        const path = GO_TO_SHORTCUTS[key];
        if (path && current) {
          event.preventDefault();
          router.push(gymHref(current.slug, path));
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [current, router, setPaletteOpen, setShortcutsOpen]);
}
