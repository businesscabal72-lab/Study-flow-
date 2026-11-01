"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTheme } from "next-themes";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Monitor, Moon, Palette, Shield, SlidersHorizontal, Sun, User } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PageHeader } from "@/components/common/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Field, Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/misc";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useProfile } from "@/hooks/use-data";
import { useSession } from "@/hooks/use-session";
import { useDbMutation } from "@/hooks/use-mutation";
import { updateProfile, type ProfilePatch } from "@/lib/data/practice";
import { qk } from "@/lib/data/core";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { passwordSchema, profileSchema, validate } from "@/lib/validations";
import { errorMessage } from "@/lib/utils/format";
import { cn } from "@/lib/utils/cn";
import type { NotificationPrefs, Profile } from "@/types/database";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TABS = ["profile", "appearance", "notifications", "preferences", "account"] as const;

export function SettingsView() {
  const params = useSearchParams();
  const initial = TABS.includes(params.get("tab") as (typeof TABS)[number]) ? (params.get("tab") as string) : "profile";
  const { data: profile, isLoading } = useProfile();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <Tabs defaultValue={initial}>
        <TabsList>
          <TabsTrigger value="profile"><User /> Profile</TabsTrigger>
          <TabsTrigger value="appearance"><Palette /> Appearance</TabsTrigger>
          <TabsTrigger value="notifications"><Bell /> Notifications</TabsTrigger>
          <TabsTrigger value="preferences"><SlidersHorizontal /> Study</TabsTrigger>
          <TabsTrigger value="account"><Shield /> Account</TabsTrigger>
        </TabsList>
        {isLoading || !profile ? <Skeleton className="mt-4 h-64" /> : (
          <>
            <TabsContent value="profile"><ProfileTab profile={profile} /></TabsContent>
            <TabsContent value="appearance"><AppearanceTab /></TabsContent>
            <TabsContent value="notifications"><NotificationsTab profile={profile} /></TabsContent>
            <TabsContent value="preferences"><PreferencesTab profile={profile} /></TabsContent>
            <TabsContent value="account"><AccountTab /></TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
}

function useSaveProfile(success = "Saved") {
  const { userId } = useSession();
  const qc = useQueryClient();
  return useDbMutation((sb, patch: ProfilePatch) => updateProfile(sb, userId, patch), {
    invalidate: [],
    success,
    onSuccess: (p) => qc.setQueryData(qk.profile, p),
  });
}

function ProfileTab({ profile }: { profile: Profile }) {
  const { email } = useSession();
  const [error, setError] = useState<string>();
  const save = useSaveProfile("Profile updated");
  return (
    <Card>
      <CardHeader><div><CardTitle>Profile</CardTitle><CardDescription>How StudyFlow greets you.</CardDescription></div></CardHeader>
      <CardContent>
        <form
          noValidate
          className="grid max-w-sm gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const v = validate(profileSchema, { display_name: new FormData(e.currentTarget).get("display_name") });
            if (!v.ok) return setError(v.errors.display_name);
            setError(undefined);
            save.mutate(v.data);
          }}
        >
          <Field label="Display name" htmlFor="dn" error={error}><Input id="dn" name="display_name" defaultValue={profile.display_name ?? ""} maxLength={60} aria-invalid={!!error} /></Field>
          <Field label="Email" htmlFor="em" hint="Your sign-in email can't be changed here."><Input id="em" value={email} disabled /></Field>
          <Button type="submit" loading={save.isPending} className="justify-self-start">Save</Button>
        </form>
      </CardContent>
    </Card>
  );
}

function AppearanceTab() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const options = [
    { id: "light", label: "Light", icon: Sun },
    { id: "dark", label: "Dark", icon: Moon },
    { id: "system", label: "System", icon: Monitor },
  ];
  return (
    <Card>
      <CardHeader><div><CardTitle>Appearance</CardTitle><CardDescription>Saved on this device.</CardDescription></div></CardHeader>
      <CardContent>
        <div className="grid max-w-md grid-cols-3 gap-2" role="radiogroup" aria-label="Theme">
          {options.map((o) => (
            <button
              key={o.id}
              role="radio"
              aria-checked={mounted && theme === o.id}
              onClick={() => setTheme(o.id)}
              className={cn("flex flex-col items-center gap-2 rounded-xl border p-4 text-[13px] transition-colors", mounted && theme === o.id ? "border-primary bg-primary-soft text-primary" : "border-border hover:bg-accent")}
            >
              <o.icon className="size-5" />{o.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function NotificationsTab({ profile }: { profile: Profile }) {
  const save = useSaveProfile();
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  useEffect(() => setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission), []);
  const prefs = profile.notification_prefs;
  const rows: { key: keyof NotificationPrefs; label: string; desc: string }[] = [
    { key: "due_today", label: "Due today", desc: "Assignments due today in the bell menu" },
    { key: "overdue", label: "Overdue work", desc: "Assignments past their due date" },
    { key: "exams", label: "Upcoming exams", desc: "Exams in the next 3 days" },
    { key: "flashcards", label: "Flashcards due", desc: "Cards ready for review" },
    { key: "focus_complete", label: "Focus timer", desc: "System notification when a focus session or break ends" },
  ];
  return (
    <Card>
      <CardHeader><div><CardTitle>Notifications</CardTitle><CardDescription>In-app reminders are built from your real deadlines.</CardDescription></div></CardHeader>
      <CardContent className="space-y-1">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-4 py-2.5">
            <div><p className="text-sm font-medium">{r.label}</p><p className="text-xs text-muted-foreground">{r.desc}</p></div>
            <Switch checked={prefs[r.key]} disabled={save.isPending} onCheckedChange={(v) => save.mutate({ notification_prefs: { ...prefs, [r.key]: v } })} aria-label={r.label} />
          </div>
        ))}
        <div className="mt-3 rounded-lg bg-surface p-3 text-[13px]">
          {perm === "unsupported" ? "This browser doesn't support system notifications." : perm === "granted" ? "System notifications are allowed in this browser." : perm === "denied" ? "System notifications are blocked. Enable them in your browser's site settings." : (
            <div className="flex items-center justify-between gap-3">
              <span>Allow system notifications for the focus timer.</span>
              <Button size="sm" variant="outline" onClick={() => Notification.requestPermission().then(setPerm)}>Allow</Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const prefsSchema = z
  .object({
    study_days: z.array(z.number().int().min(0).max(6)).min(1, "Pick at least one study day"),
    study_window_start: z.string().regex(/^\d{2}:\d{2}/, "Enter a start time"),
    study_window_end: z.string().regex(/^\d{2}:\d{2}/, "Enter an end time"),
    session_minutes: z.number().int().min(15).max(240),
    daily_goal_minutes: z.number().int().min(0).max(960),
    focus_minutes: z.number().int().min(1, "At least 1 minute").max(180, "At most 180 minutes"),
    short_break_minutes: z.number().int().min(1).max(60),
    long_break_minutes: z.number().int().min(1).max(90),
  })
  .refine((v) => v.study_window_end.slice(0, 5) > v.study_window_start.slice(0, 5), { message: "End time must be after start time", path: ["study_window_end"] });

function PreferencesTab({ profile }: { profile: Profile }) {
  const save = useSaveProfile("Study preferences saved");
  const [days, setDays] = useState<number[]>(profile.study_days);
  const [errors, setErrors] = useState<Record<string, string>>({});
  return (
    <Card>
      <CardHeader><div><CardTitle>Study preferences</CardTitle><CardDescription>Used by the smart scheduler, revision planner and focus timer.</CardDescription></div></CardHeader>
      <CardContent>
        <form
          noValidate
          className="grid gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const num = (k: string) => Number(fd.get(k));
            const v = validate(prefsSchema, {
              study_days: days,
              study_window_start: String(fd.get("ws")),
              study_window_end: String(fd.get("we")),
              session_minutes: num("session"),
              daily_goal_minutes: num("goal"),
              focus_minutes: num("focus"),
              short_break_minutes: num("short"),
              long_break_minutes: num("long"),
            });
            if (!v.ok) return setErrors(v.errors);
            setErrors({});
            save.mutate(v.data);
          }}
        >
          <div className="grid gap-2">
            <Label>Available study days</Label>
            <div className="grid max-w-md grid-cols-7 gap-1.5">
              {DAYS.map((d, i) => {
                const on = days.includes(i);
                return (
                  <button key={d} type="button" aria-pressed={on} onClick={() => setDays(on ? days.filter((x) => x !== i) : [...days, i].sort())} className={cn("h-10 rounded-lg border text-xs font-medium", on ? "border-primary bg-primary-soft text-primary" : "border-border text-muted-foreground hover:bg-accent")}>
                    {d}
                  </button>
                );
              })}
            </div>
            {errors.study_days && <p className="text-xs text-destructive">{errors.study_days}</p>}
          </div>
          <div className="grid max-w-md grid-cols-2 gap-3">
            <Field label="Available from" htmlFor="ws" error={errors.study_window_start}><Input id="ws" name="ws" type="time" defaultValue={profile.study_window_start.slice(0, 5)} /></Field>
            <Field label="Until" htmlFor="we" error={errors.study_window_end}><Input id="we" name="we" type="time" defaultValue={profile.study_window_end.slice(0, 5)} /></Field>
            <Field label="Study block length" htmlFor="session">
              <NativeSelect id="session" name="session" defaultValue={profile.session_minutes}>{[25, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}</NativeSelect>
            </Field>
            <Field label="Daily goal" htmlFor="goal">
              <NativeSelect id="goal" name="goal" defaultValue={profile.daily_goal_minutes}>{[0, 30, 60, 90, 120, 180, 240, 300].map((m) => <option key={m} value={m}>{m === 0 ? "No goal" : `${m} min`}</option>)}</NativeSelect>
            </Field>
          </div>
          <div className="grid max-w-md grid-cols-3 gap-3">
            <Field label="Focus (min)" htmlFor="focus" error={errors.focus_minutes}><Input id="focus" name="focus" type="number" min={1} max={180} defaultValue={profile.focus_minutes} inputMode="numeric" /></Field>
            <Field label="Short break" htmlFor="short" error={errors.short_break_minutes}><Input id="short" name="short" type="number" min={1} max={60} defaultValue={profile.short_break_minutes} inputMode="numeric" /></Field>
            <Field label="Long break" htmlFor="long" error={errors.long_break_minutes}><Input id="long" name="long" type="number" min={1} max={90} defaultValue={profile.long_break_minutes} inputMode="numeric" /></Field>
          </div>
          <Button type="submit" loading={save.isPending} className="justify-self-start">Save preferences</Button>
        </form>
      </CardContent>
    </Card>
  );
}

const DATA_TABLES = ["ai_conversations", "flashcards", "focus_sessions", "study_sessions", "exams", "assignments", "notes", "subjects"] as const;

function AccountTab() {
  const router = useRouter();
  const { userId } = useSession();
  const qc = useQueryClient();
  const [pwError, setPwError] = useState<string>();
  const [pwLoading, setPwLoading] = useState(false);
  const [pwKey, setPwKey] = useState(0);
  const [danger, setDanger] = useState<"data" | "account" | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [working, setWorking] = useState(false);

  async function changePassword(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const pw = String(fd.get("pw"));
    const v = validate(z.object({ pw: passwordSchema }), { pw });
    if (!v.ok) return setPwError(v.errors.pw);
    if (pw !== fd.get("pw2")) return setPwError("Passwords don't match");
    setPwError(undefined);
    setPwLoading(true);
    const { error } = await getSupabaseBrowser().auth.updateUser({ password: pw });
    setPwLoading(false);
    if (error) return setPwError(/reauth|recent/i.test(error.message) ? "For security, log out and back in, then try again." : error.message);
    toast.success("Password changed");
    setPwKey((k) => k + 1);
  }

  async function deleteAllData() {
    setWorking(true);
    try {
      const sb = getSupabaseBrowser();
      const { data: files } = await sb.from("note_attachments").select("storage_path");
      if (files?.length) await sb.storage.from("attachments").remove(files.map((f) => f.storage_path));
      for (const t of DATA_TABLES) {
        const { error } = await sb.from(t).delete().eq("user_id", userId);
        if (error) throw error;
      }
      await qc.invalidateQueries();
      toast.success("All study data deleted");
      setDanger(null);
      router.push("/dashboard");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setWorking(false);
    }
  }

  async function deleteAccount() {
    setWorking(true);
    try {
      const res = await fetch("/api/account/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm: "DELETE" }) });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Couldn't delete the account.");
      window.location.href = "/";
    } catch (e) {
      toast.error(errorMessage(e));
      setWorking(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
        <CardContent>
          <form key={pwKey} noValidate onSubmit={changePassword} className="grid max-w-sm gap-4">
            <Field label="New password" htmlFor="pw" error={pwError}><Input id="pw" name="pw" type="password" autoComplete="new-password" /></Field>
            <Field label="Confirm new password" htmlFor="pw2"><Input id="pw2" name="pw2" type="password" autoComplete="new-password" /></Field>
            <Button type="submit" loading={pwLoading} className="justify-self-start">Update password</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Session</CardTitle></CardHeader>
        <CardContent>
          <form action="/auth/signout" method="post"><Button type="submit" variant="outline">Log out</Button></form>
        </CardContent>
      </Card>
      <Card className="border-destructive/30">
        <CardHeader><div><CardTitle className="text-destructive">Danger zone</CardTitle><CardDescription>These actions can&apos;t be undone.</CardDescription></div></CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive-soft" onClick={() => { setConfirmText(""); setDanger("data"); }}>Delete all study data</Button>
          <Button variant="destructive" onClick={() => { setConfirmText(""); setDanger("account"); }}>Delete account</Button>
        </CardContent>
      </Card>
      <Dialog open={!!danger} onOpenChange={(v) => !v && setDanger(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{danger === "account" ? "Delete your account?" : "Delete all study data?"}</DialogTitle>
            <DialogDescription>
              {danger === "account"
                ? "Your account and everything in it — subjects, notes, PDFs, assignments, exams, flashcards, focus history and AI chats — will be permanently deleted."
                : "Subjects, notes, PDFs, assignments, sessions, exams, flashcards, focus history and AI chats will be permanently deleted. Your account and settings stay."}
            </DialogDescription>
          </DialogHeader>
          <Field label='Type "DELETE" to confirm' htmlFor="confirm"><Input id="confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" /></Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDanger(null)} disabled={working}>Cancel</Button>
            <Button variant="destructive" disabled={confirmText !== "DELETE"} loading={working} onClick={danger === "account" ? deleteAccount : deleteAllData}>Delete permanently</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
