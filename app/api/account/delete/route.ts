import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const runtime = "nodejs";

/**
 * Permanently deletes the signed-in user's auth account (all rows cascade).
 * Requires SUPABASE_SERVICE_ROLE_KEY on the server; without it, returns 501.
 */
export async function POST(req: Request) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  let body: { confirm?: string } = {};
  try { body = await req.json(); } catch {}
  if (body.confirm !== "DELETE") return NextResponse.json({ error: "Type DELETE to confirm." }, { status: 400 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const env = getSupabaseEnv();
  if (!serviceKey || !env) {
    return NextResponse.json({ error: "Account deletion isn't enabled on this server. You can still delete all your study data below." }, { status: 501 });
  }
  const admin = createClient(env.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  // Remove stored files first (storage objects don't cascade from auth.users).
  const { data: files } = await admin.from("note_attachments").select("storage_path").eq("user_id", auth.user.id);
  if (files?.length) await admin.storage.from("attachments").remove(files.map((f) => f.storage_path));
  const { error } = await admin.auth.admin.deleteUser(auth.user.id);
  if (error) return NextResponse.json({ error: "Couldn't delete the account. Please try again." }, { status: 500 });
  await auth.supabase.auth.signOut();
  return NextResponse.json({ ok: true });
}
