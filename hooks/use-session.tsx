"use client";
import { createContext, useContext } from "react";

export interface SessionInfo {
  userId: string;
  email: string;
}

const SessionContext = createContext<SessionInfo | null>(null);

export function SessionProvider({ value, children }: { value: SessionInfo; children: React.ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionInfo {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside the authenticated app layout");
  return ctx;
}
