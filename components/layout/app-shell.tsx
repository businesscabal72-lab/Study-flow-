"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SessionProvider, type SessionInfo } from "@/hooks/use-session";
import { FocusTimerProvider } from "@/hooks/use-focus-timer";
import { qk } from "@/lib/data/core";
import type { Profile } from "@/types/database";
import { Sidebar } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { TopBar } from "./top-bar";
import { cn } from "@/lib/utils/cn";

const COLLAPSE_KEY = "studyflow.sidebar.collapsed";

export function AppShell({ session, initialProfile, children }: { session: SessionInfo; initialProfile: Profile; children: React.ReactNode }) {
  const qc = useQueryClient();
  // Seed the profile cache from the server so the first paint has real data.
  if (!qc.getQueryData(qk.profile)) qc.setQueryData(qk.profile, initialProfile);

  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {}
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });

  return (
    <SessionProvider value={session}>
      <FocusTimerProvider>
        <div className="flex min-h-dvh">
          <Sidebar collapsed={collapsed} onToggle={toggle} />
          <div className={cn("flex min-w-0 flex-1 flex-col transition-[padding] duration-200", collapsed ? "md:pl-[60px]" : "md:pl-60")}>
            <TopBar />
            <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-28 pt-5 sm:px-6 md:pb-12 md:pt-6">
              {children}
            </main>
          </div>
          <MobileNav />
        </div>
      </FocusTimerProvider>
    </SessionProvider>
  );
}
