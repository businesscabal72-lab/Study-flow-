import { NextResponse } from "next/server";
import { isAIConfigured } from "@/lib/ai";

export const dynamic = "force-dynamic";

/** Lets the UI show an honest "AI not configured" state. Reveals no secrets. */
export function GET() {
  return NextResponse.json({ configured: isAIConfigured() }, { headers: { "Cache-Control": "no-store" } });
}
