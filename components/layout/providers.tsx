"use client";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { PwaRegister, OfflineIndicator } from "./pwa";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: true, retry: (n, e) => n < 2 && !/permission|not found/i.test(String(e)) },
          mutations: { retry: 0 },
        },
      })
  );
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={client}>
        {children}
        <OfflineIndicator />
        <PwaRegister />
        <Toaster position="top-center" richColors closeButton toastOptions={{ classNames: { toast: "!rounded-lg !text-[13px]" } }} />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
