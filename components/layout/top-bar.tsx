"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { Bell, LogOut, Moon, Search, Settings, Sun, Timer, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/misc";
import { useAssignments, useExams, useFlashcards, useProfile } from "@/hooks/use-data";
import { useSession } from "@/hooks/use-session";
import { useFocusTimer } from "@/hooks/use-focus-timer";
import { buildNotifications } from "@/lib/logic/notifications";
import { formatClock } from "@/lib/logic/timer";
import { LogoMark } from "./logo";
import { SearchDialog } from "./search-dialog";
import { cn } from "@/lib/utils/cn";

export function TopBar() {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
      <Link href="/dashboard" className="md:hidden" aria-label="Home">
        <LogoMark />
      </Link>
      <button
        onClick={() => setSearchOpen(true)}
        className="ml-auto flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-2.5 text-[13px] text-muted-foreground hover:bg-accent sm:w-64 md:ml-0"
        aria-label="Search"
      >
        <Search className="size-4" />
        <span className="hidden sm:inline">Search…</span>
        <span className="ml-auto hidden sm:inline"><Kbd>⌘K</Kbd></span>
      </button>
      <div className="flex items-center gap-1 md:ml-auto">
        <TimerPill />
        <Notifications />
        <ProfileMenu />
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
    </header>
  );
}

function TimerPill() {
  const { state, remainingMs } = useFocusTimer();
  if (state.status !== "running" && state.status !== "paused") return null;
  return (
    <Link
      href="/focus"
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-full px-2.5 font-mono text-xs tabular-nums",
        state.mode === "focus" ? "bg-primary-soft text-primary" : "bg-lavender-soft text-lavender"
      )}
      aria-label="Focus timer"
    >
      <Timer className="size-3.5" />
      {formatClock(remainingMs)}
      {state.status === "paused" && <span className="font-sans">· paused</span>}
    </Link>
  );
}

function Notifications() {
  const { data: profile } = useProfile();
  const a = useAssignments();
  const e = useExams();
  const f = useFlashcards();
  const items =
    profile && a.data && e.data && f.data
      ? buildNotifications({ assignments: a.data, exams: e.data, flashcards: f.data, prefs: profile.notification_prefs })
      : [];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label={`Notifications${items.length ? ` (${items.length})` : ""}`}>
          <Bell />
          {items.length > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-destructive ring-2 ring-background" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-72">
        <DropdownMenuLabel>Reminders</DropdownMenuLabel>
        {items.length === 0 ? (
          <p className="px-2 pb-3 pt-1 text-[13px] text-muted-foreground">You&apos;re all caught up.</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n.id} asChild>
              <Link href={n.href} className="flex flex-col !items-start gap-0">
                <span className="w-full truncate font-medium">{n.title}</span>
                <span className={cn("text-xs", n.kind === "overdue" ? "text-destructive" : "text-muted-foreground")}>{n.detail}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProfileMenu() {
  const { data: profile } = useProfile();
  const { email } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const name = profile?.display_name || email.split("@")[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="ml-1 grid size-8 place-items-center rounded-full bg-lavender-soft text-[13px] font-semibold text-lavender" aria-label="Profile menu">
          {name.slice(0, 1).toUpperCase()}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{name}</p>
          <p className="truncate text-xs">{email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings"><User /> Profile</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings?tab=preferences"><Settings /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {resolvedTheme === "dark" ? <Sun /> : <Moon />} {resolvedTheme === "dark" ? "Light mode" : "Dark mode"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full"><LogOut /> Log out</button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
