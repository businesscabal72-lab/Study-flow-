"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "./env";

let client: SupabaseClient | null = null;

/** Singleton browser client. RLS scopes every query to the signed-in user. */
export function getSupabaseBrowser(): SupabaseClient {
  if (client) return client;
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  client = createBrowserClient(env.url, env.anonKey);
  return client;
}
