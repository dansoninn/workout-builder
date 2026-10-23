"use client";

import { PlusIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type FocusOption = { id: string; name: string; color: string | null; archived: boolean };
export type GymDay = { date: string; name: string; closed: boolean };

function Dot({ color }: { color: string | null }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block size-2 shrink-0 rounded-full", !color && "border border-border-strong")}
      style={color ? { backgroundColor: color } : undefined}
    />
  );
}

/** A program's focus for a day: a chip, and for coaches a menu to set it. "Focus" shows on hover or focus when the day has none. */
export function DayFocusMenu({
  focus,
  focuses,
  label,
  canEdit,
  onChange,
}: {
  focus: FocusOption | null;
  focuses: FocusOption[];
  /** "Mon 26 Oct, Class": whose focus it is, for screen readers. */
  label: string;
  canEdit: boolean;
  onChange: (focusId: string | null) => void;
}) {
  if (!canEdit) {
    if (!focus) return null;
    return (
      <span className="inline-flex max-w-full items-center gap-1 text-xs font-medium">
        <Dot color={focus.color} />
        <span className="truncate">{focus.name}</span>
        <span className="sr-only"> (day focus)</span>
      </span>
    );
  }
  // An archived focus stays on its days and in the menu while it is the day's; it is not offered for others.
  const offered = focuses.filter((f) => !f.archived || f.id === focus?.id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Day focus for ${label}: ${focus?.name ?? "none"}`}
        className={cn(
          "inline-flex h-6 max-w-full items-center gap-1 rounded-md px-1.5 text-xs transition-colors duration-100 hover:bg-hover aria-expanded:bg-hover focus-visible:opacity-100",
          focus ? "font-medium" : "text-muted-foreground md:opacity-0 md:group-hover/cell:opacity-100 aria-expanded:opacity-100",
        )}
      >
        {focus ? (
          <>
            <Dot color={focus.color} />
            <span className="truncate">{focus.name}</span>
          </>
        ) : (
          <>
            <PlusIcon className="size-3" aria-hidden /> Focus
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Day focus</DropdownMenuLabel>
          {offered.length === 0 ? (
            <p className="px-1.5 py-1 text-xs text-muted-foreground">No day focuses yet: an owner or head coach adds them in Settings → Days.</p>
          ) : (
            <DropdownMenuRadioGroup value={focus?.id ?? "none"} onValueChange={(value) => onChange(value === "none" ? null : String(value))}>
              <DropdownMenuRadioItem value="none">No focus</DropdownMenuRadioItem>
              {offered.map((f) => (
                <DropdownMenuRadioItem key={f.id} value={f.id}>
                  <Dot color={f.color} /> {f.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** A holiday or closed day's name, under the day. */
export function GymDayNote({ day }: { day: GymDay | undefined }) {
  if (!day) return null;
  return (
    <p className={cn("truncate px-0.5 text-xs", day.closed ? "font-medium text-foreground" : "text-muted-foreground")} title={day.name}>
      {day.name}
      {day.closed && " · Closed"}
    </p>
  );
}
