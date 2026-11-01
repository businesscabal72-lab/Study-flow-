"use client";
import { useEffect, useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* registration failure just means no offline shell */
    });
  }, []);
  return null;
}

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

export function useOnline() {
  return useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
}

/** Honest offline banner: data and AI need a connection. */
export function OfflineIndicator() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-foreground px-4 py-1.5 text-xs font-medium text-background"
    >
      <WifiOff className="size-3.5" />
      You&apos;re offline. Saved data, syncing and AI need a connection — changes won&apos;t save until you&apos;re back online.
    </div>
  );
}
