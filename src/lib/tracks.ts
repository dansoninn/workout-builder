/**
 * Track colours: mid-tone hues that read on light and dark surfaces. Always
 * shown next to the track's name, never as the only way to tell tracks apart.
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
