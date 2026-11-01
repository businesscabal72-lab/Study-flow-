import { Suspense } from "react";
import { AIChat } from "@/components/ai/ai-chat";
export const metadata = { title: "AI Study Assistant" };
export default function Page() {
  return (
    <Suspense>
      <AIChat />
    </Suspense>
  );
}
