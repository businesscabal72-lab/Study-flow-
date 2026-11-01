import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { OnboardingWizard } from "./wizard";
import { SessionProvider } from "@/hooks/use-session";

export const dynamic = "force-dynamic";
export const metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const auth = await requireUser();
  if (!auth) redirect("/login");
  const { data: profile } = await auth.supabase.from("profiles").select("*").eq("id", auth.user.id).single<Profile>();
  if (profile?.onboarded) redirect("/dashboard");
  return (
    <SessionProvider value={{ userId: auth.user.id, email: auth.user.email ?? "" }}>
      <OnboardingWizard initialName={profile?.display_name ?? ""} />
    </SessionProvider>
  );
}
