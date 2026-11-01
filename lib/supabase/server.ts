import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

export async function getSupabaseServer(): Promise<SupabaseClient> {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured.");
  const cookieStore = await cookies();
  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component — the proxy refreshes the session instead.
        }
      },
    },
  });
}

/**
 * Verifies the session with Supabase Auth (getUser hits the auth server,
 * unlike getSession which only decodes the cookie). Use for every
 * server-side authorization decision.
 */
export async function requireUser(): Promise<{ supabase: SupabaseClient; user: User } | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}
