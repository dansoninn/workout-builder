/** Where to go after signing in: only paths inside this app, never another site. */
export function safeNext(next: unknown, fallback = "/"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}

/** `/sign-in?next=…` (or sign-up), keeping where the user was going. */
export function authPath(page: "/sign-in" | "/sign-up", next?: string | null): string {
  const target = safeNext(next, "");
  return target && target !== "/" ? `${page}?next=${encodeURIComponent(target)}` : page;
}

/** Pages that work without signing in. Everything else needs a session. */
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up", "/forgot-password", "/auth", "/invite", "/design", "/api/version"];

export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** The last gym a user had open, so `/` can take them back to it. Holds a slug only. */
export const LAST_GYM_COOKIE = "wb_gym";

/**
 * Gym addresses that would collide with the app's own pages. Must match the
 * `organizations_slug_not_reserved` check in the database (a test compares them).
 */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "about", "account", "admin", "api", "app", "assets", "auth", "billing", "blog",
  "dashboard", "design", "docs", "forgot-password", "gyms", "help", "invite", "join",
  "login", "logout", "new", "onboarding", "pricing", "privacy", "public", "reset-password",
  "settings", "sign-in", "sign-out", "sign-up", "signin", "signup", "static", "status",
  "support", "terms", "www",
]);

function isGymSlug(segment: string | undefined): segment is string {
  return Boolean(segment) && !RESERVED_SLUGS.has(segment!) && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(segment!);
}

/** The gym slug if this path is inside a gym (`/afrek/builder` → "afrek"). */
export function gymSlugOf(pathname: string): string | null {
  const [first, second] = pathname.split("/").filter(Boolean);
  return second && isGymSlug(first) ? first : null;
}

/** Index addresses that have no page of their own: `/afrek` → builder, `/afrek/settings` → gym settings. */
export function gymIndexRedirect(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  const [first, second] = segments;
  if (!isGymSlug(first)) return null;
  if (segments.length === 1) return `/${first}/builder`;
  if (segments.length === 2 && second === "settings") return `/${first}/settings/gym`;
  return null;
}
