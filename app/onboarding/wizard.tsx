"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Progress } from "@/components/ui/misc";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { createSubjects } from "@/lib/data/subjects";
import { updateProfile } from "@/lib/data/practice";
import { useSession } from "@/hooks/use-session";
import { SUBJECT_COLORS } from "@/types/database";
import { colorFor } from "@/lib/utils/colors";
import { errorMessage } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SUGGESTED = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "History", "Computer Science", "Economics"];
const STEPS = ["Your name", "Subjects", "Study preferences", "Study days"];

export function OnboardingWizard({ initialName }: { initialName: string }) {
  const router = useRouter();
  const { userId } = useSession();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [nameError, setNameError] = useState<string>();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [sessionMinutes, setSessionMinutes] = useState(45);
  const [dailyGoal, setDailyGoal] = useState(120);
  const [windowStart, setWindowStart] = useState("16:00");
  const [windowEnd, setWindowEnd] = useState("21:00");
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [prefError, setPrefError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const addSubject = (s: string) => {
    const v = s.trim().slice(0, 80);
    if (!v || subjects.some((x) => x.toLowerCase() === v.toLowerCase()) || subjects.length >= 20) return;
    setSubjects((x) => [...x, v]);
    setDraft("");
  };

  const next = () => {
    if (step === 0) {
      if (!name.trim()) return setNameError("Enter a name so we know what to call you");
      if (name.trim().length > 60) return setNameError("Keep it under 60 characters");
      setNameError(undefined);
    }
    if (step === 2 && windowEnd <= windowStart) return setPrefError("End time must be after start time");
    setPrefError(undefined);
    if (step < STEPS.length - 1) setStep(step + 1);
    else finish();
  };

  async function finish(skipRemaining = false) {
    setSaving(true);
    try {
      const sb = getSupabaseBrowser();
      if (subjects.length) {
        await createSubjects(sb, subjects.map((n, i) => ({ name: n, color: SUBJECT_COLORS[i % SUBJECT_COLORS.length] })));
      }
      await updateProfile(sb, userId, {
        display_name: name.trim() || null,
        onboarded: true,
        ...(skipRemaining && step < 2
          ? {}
          : { session_minutes: sessionMinutes, daily_goal_minutes: dailyGoal, study_window_start: windowStart, study_window_end: windowEnd }),
        ...(skipRemaining && step < 3 ? {} : { study_days: days }),
      });
      router.replace("/dashboard");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="flex items-center justify-between px-6 py-5">
        <Logo />
        <span className="text-xs text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
      </header>
      <main className="flex flex-1 justify-center px-4 pb-16 pt-4 sm:pt-10">
        <div className="w-full max-w-md">
          <Progress value={((step + 1) / STEPS.length) * 100} className="mb-8" />
          <div className="rounded-xl border border-border bg-card p-6 shadow-soft">
            {step === 0 && (
              <>
                <h1 className="text-lg font-semibold">Welcome to StudyFlow 👋</h1>
                <p className="mt-1 text-sm text-muted-foreground">Let&apos;s set up your workspace. What should we call you?</p>
                <Field label="Display name" htmlFor="name" error={nameError} className="mt-5">
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} autoFocus aria-invalid={!!nameError} onKeyDown={(e) => e.key === "Enter" && next()} />
                </Field>
              </>
            )}
            {step === 1 && (
              <>
                <h1 className="text-lg font-semibold">What are you studying?</h1>
                <p className="mt-1 text-sm text-muted-foreground">Add your subjects. You can change these anytime.</p>
                <form className="mt-5 flex gap-2" onSubmit={(e) => { e.preventDefault(); addSubject(draft); }}>
                  <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="e.g. Organic Chemistry" aria-label="Subject name" maxLength={80} />
                  <Button type="submit" variant="secondary" size="icon" aria-label="Add subject" disabled={!draft.trim()}><Plus /></Button>
                </form>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {SUGGESTED.filter((s) => !subjects.includes(s)).map((s) => (
                    <button key={s} onClick={() => addSubject(s)} className="rounded-full border border-dashed border-border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary hover:text-primary">
                      + {s}
                    </button>
                  ))}
                </div>
                {subjects.length > 0 && (
                  <ul className="mt-5 space-y-1.5">
                    {subjects.map((s, i) => (
                      <li key={s} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
                        <span className={cn("size-2 rounded-full", colorFor(SUBJECT_COLORS[i % SUBJECT_COLORS.length]).dot)} />
                        <span className="flex-1 truncate">{s}</span>
                        <button onClick={() => setSubjects((x) => x.filter((y) => y !== s))} aria-label={`Remove ${s}`} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
            {step === 2 && (
              <>
                <h1 className="text-lg font-semibold">How do you like to study?</h1>
                <p className="mt-1 text-sm text-muted-foreground">Used by the smart scheduler to suggest study blocks.</p>
                <div className="mt-5 grid gap-4">
                  <Field label="Typical session length" htmlFor="len">
                    <NativeSelect id="len" value={sessionMinutes} onChange={(e) => setSessionMinutes(Number(e.target.value))}>
                      {[25, 30, 45, 60, 90].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                    </NativeSelect>
                  </Field>
                  <Field label="Daily study goal" htmlFor="goal">
                    <NativeSelect id="goal" value={dailyGoal} onChange={(e) => setDailyGoal(Number(e.target.value))}>
                      {[30, 60, 90, 120, 180, 240].map((m) => <option key={m} value={m}>{m < 60 ? `${m} minutes` : `${m / 60} hour${m > 60 ? "s" : ""}`}</option>)}
                    </NativeSelect>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Available from" htmlFor="ws"><Input id="ws" type="time" value={windowStart} onChange={(e) => setWindowStart(e.target.value)} /></Field>
                    <Field label="Until" htmlFor="we" error={prefError}><Input id="we" type="time" value={windowEnd} onChange={(e) => setWindowEnd(e.target.value)} aria-invalid={!!prefError} /></Field>
                  </div>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <h1 className="text-lg font-semibold">Which days can you study?</h1>
                <p className="mt-1 text-sm text-muted-foreground">We&apos;ll only suggest study blocks on these days.</p>
                <div className="mt-5 grid grid-cols-7 gap-1.5">
                  {DAYS.map((d, i) => {
                    const on = days.includes(i);
                    return (
                      <button
                        key={d}
                        onClick={() => setDays((x) => (on ? x.filter((y) => y !== i) : [...x, i].sort()))}
                        aria-pressed={on}
                        className={cn("flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-xs font-medium transition-colors", on ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-accent")}
                      >
                        {d}
                        {on && <Check className="size-3" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
            <div className="mt-7 flex items-center justify-between gap-2">
              {step > 0 ? <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={saving}>Back</Button> : <span />}
              <div className="flex gap-2">
                {step > 0 && step < STEPS.length - 1 && (
                  <Button variant="outline" onClick={() => setStep(step + 1)} disabled={saving}>Skip</Button>
                )}
                <Button onClick={next} loading={saving} disabled={step === 3 && days.length === 0}>
                  {step === STEPS.length - 1 ? "Go to dashboard" : "Continue"}
                </Button>
              </div>
            </div>
          </div>
          {step > 0 && (
            <button onClick={() => finish(true)} disabled={saving} className="mx-auto mt-4 block text-[13px] text-muted-foreground hover:text-foreground">
              Skip setup and use defaults
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
