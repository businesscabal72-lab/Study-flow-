import Link from "next/link";
import { BookOpen, CalendarClock, Layers, Sparkles, Timer, TrendingUp } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

const features = [
  { icon: BookOpen, title: "Notes that stay organized", body: "A calm editor with headings, checklists, tables and code — filed by subject." },
  { icon: CalendarClock, title: "Deadlines under control", body: "Assignments, exams and study sessions in one schedule, with smart block suggestions." },
  { icon: Sparkles, title: "An AI tutor that explains", body: "Ask for explanations, summaries and practice questions grounded in your own notes." },
  { icon: Timer, title: "Focus that counts", body: "A distraction-free timer that logs real study time to your progress." },
  { icon: Layers, title: "Flashcards with spacing", body: "Review what's due today; cards you find hard come back sooner." },
  { icon: TrendingUp, title: "Progress you can see", body: "Weekly activity, subject balance and consistency — from your real data." },
];

// Signed-in visitors are redirected to /dashboard by the proxy.
export default function Landing() {
  return (
    <div className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm"><Link href="/login">Log in</Link></Button>
          <Button asChild size="sm"><Link href="/signup">Get started</Link></Button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-5">
        <section className="py-16 text-center sm:py-24">
          <p className="mb-4 inline-flex rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground">
            For school and college students
          </p>
          <h1 className="mx-auto max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Your whole academic life, in one calm workspace.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground">
            StudyFlow brings your subjects, notes, deadlines, exam prep and an AI study partner together — so you can spend less time organizing and more time understanding.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg"><Link href="/signup">Create your free workspace</Link></Button>
            <Button asChild size="lg" variant="outline"><Link href="/login">Log in</Link></Button>
          </div>
        </section>
        <section className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-card p-6">
              <f.icon className="mb-3 size-5 text-primary" />
              <h2 className="text-sm font-semibold">{f.title}</h2>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </section>
        <footer className="py-12 text-center text-xs text-muted-foreground">StudyFlow · Built for focused learning</footer>
      </main>
    </div>
  );
}
