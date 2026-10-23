/**
 * Program colours (programs are stored as `tracks`): mid-tone hues that read
 * on light and dark surfaces. Always shown next to the program's name, never
 * as the only way to tell programs apart.
 */
export const TRACK_COLORS: readonly { value: string; label: string }[] = [
  { value: "#5B5FD6", label: "Indigo" },
  { value: "#2F7FD8", label: "Blue" },
  { value: "#12917F", label: "Teal" },
  { value: "#3B9B47", label: "Green" },
  { value: "#C98A0E", label: "Amber" },
  { value: "#E0611A", label: "Orange" },
  { value: "#D6455B", label: "Red" },
  { value: "#8C55D8", label: "Violet" },
  { value: "#7A7F8A", label: "Grey" },
];

export function trackColorLabel(color: string | null): string {
  return TRACK_COLORS.find((c) => c.value.toLowerCase() === color?.toLowerCase())?.label ?? "No colour";
}

/** What a page shows: one program (each program is its own space), or all of them, by the coach's explicit choice. */
export type ProgramView = { all: true } | { all: false; programId: string };

/** ?program=<id> or ?program=all in the address (?track=<id> from links made before the rename). */
export function programViewParam(query: Record<string, string | string[] | undefined>): string | null {
  const value = query.program ?? query.track;
  return typeof value === "string" && (value === "all" || /^[0-9a-f-]{36}$/.test(value)) ? value : null;
}

/**
 * The calendar's program (decision 3, 2026-10-23): the one in the address,
 * else the person's last choice, else the gym's first active program. "All
 * programs" only when asked for. A remembered program that was archived
 * since falls back to the first active one.
 */
export function calendarProgramView(
  asked: string | null,
  remembered: { programId: string | null; all: boolean } | null,
  programs: readonly { id: string; archived: boolean }[],
): ProgramView {
  if (asked === "all") return { all: true };
  if (asked && programs.some((p) => p.id === asked)) return { all: false, programId: asked };
  if (remembered?.all) return { all: true };
  const kept = programs.find((p) => p.id === remembered?.programId && !p.archived);
  const first = kept ?? programs.find((p) => !p.archived);
  return first ? { all: false, programId: first.id } : { all: true };
}
