import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { AppShell } from "@/components/layout/app-shell";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await requireUser();
  if (!auth) redirect("/login");
  const { data: profile } = await auth.supabase.from("profiles").select("*").eq("id", auth.user.id).single<Profile>();
  if (!profile?.onboarded) redirect("/onboarding");

  return (
    <AppShell session={{ userId: auth.user.id, email: auth.user.email ?? "" }} initialProfile={profile}>
      {children}
    </AppShell>
  );
}
