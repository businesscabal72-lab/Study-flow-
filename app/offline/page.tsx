import { WifiOff } from "lucide-react";

export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <WifiOff className="mx-auto size-6 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">You&apos;re offline</h1>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          StudyFlow needs a connection to load and save your data. Reconnect and this page will work again.
        </p>
      </div>
    </main>
  );
}
