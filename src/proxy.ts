import { type NextRequest, NextResponse } from "next/server";

import { homePath } from "@/lib/home";
import { authPath, gymIndexRedirect, gymSlugOf, isPublicPath, LAST_GYM_COOKIE, safeNext } from "@/lib/paths";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Keeps the Supabase session fresh, sends `/` to where the user belongs, and
 * sends signed-out visitors to sign in. Redirects here are for convenience
 * only: every page and action checks the user again on the server, and RLS
 * guards the data.
 */
export async function proxy(request: NextRequest) {
  const { supabase, userId, getResponse } = await updateSession(request);
  const { pathname, search, searchParams } = request.nextUrl;
  const signedIn = userId !== null;

  let destination: string | null = null;
  if (pathname === "/") {
    destination = signedIn ? await homePath(supabase, userId, request.cookies.get(LAST_GYM_COOKIE)?.value) : "/sign-in";
  } else if (!signedIn && !isPublicPath(pathname)) {
    destination = authPath("/sign-in", pathname + search);
  } else if (signedIn && (pathname === "/sign-in" || pathname === "/sign-up")) {
    destination = safeNext(searchParams.get("next"));
  } else if (signedIn) {
    destination = gymIndexRedirect(pathname);
  }

  const response = getResponse();
  if (!destination) {
    // Remember the gym in view so `/` can return to it (a slug, checked against membership there).
    const gym = signedIn ? gymSlugOf(pathname) : null;
    if (gym && request.cookies.get(LAST_GYM_COOKIE)?.value !== gym) {
      response.cookies.set(LAST_GYM_COOKIE, gym, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        httpOnly: true,
        secure: request.nextUrl.protocol === "https:",
      });
    }
    return response;
  }

  const redirect = NextResponse.redirect(new URL(destination, request.url));
  for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = response.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}


export const config = {
  // Pages, actions and route handlers only: not Next.js internals (static files,
  // images, the dev server's hot-reload socket) and not public files.
  matcher: ["/((?!_next/|__nextjs|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|woff2?)$).*)"],
};
