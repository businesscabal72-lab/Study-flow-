import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AINotConfiguredError, AIProviderError, type AIProvider } from "./provider";
import { getAIProvider } from "./index";

const HOURLY = Number(process.env.AI_HOURLY_LIMIT || 40);
const DAILY = Number(process.env.AI_DAILY_LIMIT || 200);

export const jsonError = (message: string, status: number) => NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Every AI route goes through here: verifies the session server-side,
 * confirms a provider is configured, enforces per-user request limits and
 * records usage. Returns a Response on failure.
 */
export async function guardAI(feature: string): Promise<{ supabase: SupabaseClient; user: User; ai: AIProvider } | Response> {
  if (!isSupabaseConfigured()) return jsonError("The app isn't connected to a database yet.", 503);
  const auth = await requireUser();
  if (!auth) return jsonError("Please log in again.", 401);

  let ai: AIProvider;
  try {
    ai = getAIProvider();
  } catch (e) {
    if (e instanceof AINotConfiguredError) return jsonError(e.message, 503);
    throw e;
  }

  const { supabase, user } = auth;
  const hourAgo = new Date(Date.now() - 3600_000).toISOString();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const [h, d] = await Promise.all([
    supabase.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", hourAgo),
    supabase.from("ai_usage").select("id", { count: "exact", head: true }).gte("created_at", dayAgo),
  ]);
  if (h.error || d.error) return jsonError("Couldn't check your AI usage. Please try again.", 500);
  if ((h.count ?? 0) >= HOURLY) return jsonError(`You've reached the limit of ${HOURLY} AI requests per hour. Take a short break and try again soon.`, 429);
  if ((d.count ?? 0) >= DAILY) return jsonError(`You've reached today's limit of ${DAILY} AI requests. It resets within 24 hours.`, 429);

  const ins = await supabase.from("ai_usage").insert({ feature });
  if (ins.error) return jsonError("Couldn't record AI usage. Please try again.", 500);

  return { supabase, user, ai };
}

export async function parseBody<T>(req: Request, parse: (v: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } }) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { error: jsonError("Invalid request body.", 400) };
  }
  const r = parse(raw);
  if (!r.success) return { error: jsonError(r.error.issues[0]?.message ?? "Invalid request.", 400) };
  return { data: r.data };
}

export function providerErrorResponse(e: unknown) {
  if (e instanceof AIProviderError) return jsonError(e.message, e.status);
  console.error("[ai] unexpected error", e);
  return jsonError("Something went wrong with the AI request. Please try again.", 500);
}

const SENTINEL = "\n[[STUDYFLOW_ERROR]]";

/** Stream provider output as plain text; mid-stream failures send a sentinel the client understands. */
export function streamText(source: AsyncIterable<string>, onDone?: (full: string) => Promise<void>, headers: Record<string, string> = {}) {
  const encoder = new TextEncoder();
  const iterator = source[Symbol.asyncIterator]();
  return (async () => {
    // Pull the first chunk before responding so setup errors return a proper status code.
    let first: IteratorResult<string>;
    try {
      first = await iterator.next();
    } catch (e) {
      return providerErrorResponse(e);
    }
    let full = first.done ? "" : first.value;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        if (full) controller.enqueue(encoder.encode(full));
      },
      async pull(controller) {
        try {
          const { value, done } = await iterator.next();
          if (done) {
            if (onDone) await onDone(full).catch((err) => console.error("[ai] save failed", err));
            controller.close();
            return;
          }
          full += value;
          controller.enqueue(encoder.encode(value));
        } catch (e) {
          const msg = e instanceof AIProviderError ? e.message : "The AI response was interrupted.";
          controller.enqueue(encoder.encode(`${SENTINEL}${msg}`));
          controller.close();
        }
      },
      cancel() {
        void iterator.return?.();
      },
    });
    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", ...headers } });
  })();
}
