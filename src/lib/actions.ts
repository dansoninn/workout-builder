import "server-only";

import { z } from "zod";

import type { Role } from "@/lib/permissions";
import { getGym, type GymMembership } from "@/lib/session";

/** Result of a Server Action called directly (not from a form). */
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export const uuidSchema = z.uuid();

/**
 * The gym for a Server Action, if the signed-in user belongs to it with a role
 * that `allowed` accepts. Actions are public endpoints, so each one checks
 * again; RLS enforces the same rules underneath.
 */
export async function gymForAction(slug: string, allowed: (role: Role) => boolean): Promise<GymMembership | null> {
  const gym = await getGym(slug);
  return gym && allowed(gym.role) ? gym : null;
}

export const NOT_ALLOWED = "You don't have permission to do that in this gym.";
