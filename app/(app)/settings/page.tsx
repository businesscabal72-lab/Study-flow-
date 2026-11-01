import { Suspense } from "react";
import { SettingsView } from "@/components/settings/settings-view";
export const metadata = { title: "Settings" };
export default function Page() {
  return (
    <Suspense>
      <SettingsView />
    </Suspense>
  );
}
