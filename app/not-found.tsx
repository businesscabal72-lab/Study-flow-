import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-sm text-muted-foreground">404</p>
        <h1 className="mt-1 text-xl font-semibold">This page doesn&apos;t exist</h1>
        <Button asChild className="mt-5"><Link href="/dashboard">Back to dashboard</Link></Button>
      </div>
    </main>
  );
}
