import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";

import type { Database } from "@/lib/database.types";

import { supabaseEnv } from "./env";

/**
 * Refreshes the session cookie on every request (run from the proxy) and says
 * who is signed in. Not an authorization check: pages and actions check again
 * on the server, and RLS is the real guard.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, anonKey } = supabaseEnv();

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  // Must run before anything else so a refreshed token is written to the response.
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims.sub ?? null;
  // `response` is reassigned when cookies are refreshed, so hand it out through a getter.
  return { supabase, userId, getResponse: () => response };
}
