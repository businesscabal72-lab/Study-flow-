import { Logo } from "@/components/layout/logo";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Shown when Supabase environment variables are missing — never fakes a connection.
export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/");
  return (
    <main className="mx-auto max-w-xl px-5 py-16">
      <Logo />
      <h1 className="mt-8 text-2xl font-semibold tracking-tight">Connect StudyFlow to Supabase</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        StudyFlow stores everything in your own Supabase project. It isn&apos;t connected yet, so nothing can be saved.
      </p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm">
        <li>Create a project at supabase.com.</li>
        <li>
          Run <code className="rounded bg-muted px-1">supabase/migrations/0001_studyflow_schema.sql</code> in the SQL editor.
        </li>
        <li>
          Copy <code className="rounded bg-muted px-1">.env.example</code> to <code className="rounded bg-muted px-1">.env.local</code> and set{" "}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code className="rounded bg-muted px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code>.
        </li>
        <li>Restart the dev server (or redeploy on Vercel).</li>
      </ol>
      <p className="mt-6 text-sm text-muted-foreground">
        AI features additionally need <code className="rounded bg-muted px-1">GEMINI_API_KEY</code>; without it they show a clear “not configured” message.
      </p>
    </main>
  );
}
