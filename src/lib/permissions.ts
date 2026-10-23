import type { Database } from "@/lib/database.types";

export type Role = Database["public"]["Enums"]["org_role"];

export const ROLES: readonly { value: Role; label: string; description: string }[] = [
  { value: "owner", label: "Owner", description: "Everything, including members and gym settings" },
  { value: "head_coach", label: "Head coach", description: "Programs workouts, manages the gym's programs and exercises" },
  { value: "coach", label: "Coach", description: "Programs workouts" },
  { value: "viewer", label: "Viewer", description: "Sees everything, changes nothing" },
];

export function roleLabel(role: Role): string {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

/**
 * What each role may do, mirroring the database's role matrix
 * (SPEC-data-model §3). The UI uses this to hide controls; the database
 * enforces the same rules with RLS whatever the UI shows.
 */
export const can = {
  manageMembers: (role: Role) => role === "owner",
  editGym: (role: Role) => role === "owner",
  manageTracks: (role: Role) => role === "owner" || role === "head_coach",
  editExerciseBank: (role: Role) => role === "owner" || role === "head_coach",
  program: (role: Role) => role !== "viewer",
};
