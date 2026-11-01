import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseEnv } from "./env";

const PUBLIC_PATHS = ["/", "/login", "/signup", "/forgot-password", "/auth", "/offline", "/setup"];
const AUTH_PAGES = ["/login", "/signup", "/forgot-password"];

const isPublic = (path: string) =>
  PUBLIC_PATHS.some((p) => (p === "/" ? path === "/" : path === p || path.startsWith(p + "/")));

/** Refreshes the Supabase session cookie and enforces protected routes. */
export async function updateSession(request: NextRequest) {
  const env = getSupabaseEnv();
  const path = request.nextUrl.pathname;

  if (!env) {
    // Not configured: send every app route to the setup screen instead of crashing.
    if (path === "/setup" || path.startsWith("/api")) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/setup";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();

  if (path.startsWith("/api")) return response; // API routes do their own auth checks

  if (!user && !isPublic(path)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (user && (AUTH_PAGES.includes(path) || path === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
