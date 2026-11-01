"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { addMonths, format, isSameDay, subMonths } from "date-fns";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Columns3, List, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { PageHeader, EmptyState, ErrorState } from "@/components/common/page";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/input";
import { Checkbox, Skeleton } from "@/components/ui/misc";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SubjectSelect, SubjectTag } from "@/components/common/subject";
import { MonthGrid } from "@/components/calendar/month-grid";
import { AssignmentDialog } from "./assignment-dialog";
import { useAssignments, useSubjectMap } from "@/hooks/use-data";
import { useDbMutation } from "@/hooks/use-mutation";
import { useSetAssignmentStatus } from "@/hooks/use-actions";
import { deleteAssignment } from "@/lib/data/planner";
import { qk } from "@/lib/data/core";
import { ASSIGNMENT_STATUS_LABEL, fmtDue, isOverdue, PRIORITY_BADGE, PRIORITY_LABEL } from "@/lib/utils/format";
import { colorFor } from "@/lib/utils/colors";
import { cn } from "@/lib/utils/cn";
import { ASSIGNMENT_STATUSES, type Assignment, type AssignmentStatus, type SubjectColor } from "@/types/database";

type Sort = "due_asc" | "due_desc" | "priority";
const PRIO_ORDER = { high: 0, medium: 1, low: 2 };

export function AssignmentsView() {
  const params = useSearchParams();
  const router = useRouter();
  const { data, isLoading, error, refetch } = useAssignments();
  const { map: subjects } = useSubjectMap();
  const [subject, setSubject] = useState("");
  const [status, setStatus] = useState<"" | AssignmentStatus | "overdue">("");
  const [sort, setSort] = useState<Sort>("due_asc");
  const [editing, setEditing] = useState<Assignment | null>(null);
  const [creating, setCreating] = useState<{ date?: Date } | null>(null);
  const [deleting, setDeleting] = useState<Assignment | null>(null);
  const setA = useSetAssignmentStatus();
  const del = useDbMutation((sb, id: string) => deleteAssignment(sb, id), { invalidate: [qk.assignments], success: "Assignment deleted", onSuccess: () => setDeleting(null) });

  // Deep link: /assignments?open=<id>
  useEffect(() => {
    const id = params.get("open");
    if (id && data) {
      const a = data.find((x) => x.id === id);
      if (a) setEditing(a);
      router.replace("/assignments");
    }
  }, [params, data, router]);

  const filtered = useMemo(() => {
    const list = (data ?? []).filter(
      (a) =>
        (!subject || a.subject_id === subject) &&
        (!status || (status === "overdue" ? isOverdue(a.due_date, a.status) : a.status === status))
    );
    return list.sort((a, b) =>
      sort === "priority"
        ? PRIO_ORDER[a.priority] - PRIO_ORDER[b.priority] || +new Date(a.due_date) - +new Date(b.due_date)
        : sort === "due_desc"
          ? +new Date(b.due_date) - +new Date(a.due_date)
          : +new Date(a.due_date) - +new Date(b.due_date)
    );
  }, [data, subject, status, sort]);

  const overdueCount = (data ?? []).filter((a) => isOverdue(a.due_date, a.status)).length;
  const upcoming = (data ?? []).filter((a) => a.status !== "completed" && new Date(a.due_date) >= new Date() && +new Date(a.due_date) - Date.now() < 7 * 86_400_000);

  const actions = (a: Assignment) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={`Actions for ${a.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onSelect={() => setEditing(a)}><Pencil /> Edit</DropdownMenuItem>
        {ASSIGNMENT_STATUSES.filter((s) => s !== a.status).map((s) => (
          <DropdownMenuItem key={s} onSelect={() => setA.mutate({ id: a.id, status: s })}>Mark {ASSIGNMENT_STATUS_LABEL[s].toLowerCase()}</DropdownMenuItem>
        ))}
        <DropdownMenuItem destructive onSelect={() => setDeleting(a)}><Trash2 /> Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div>
      <PageHeader title="Assignments" description="Track every deadline in one place." actions={<Button onClick={() => setCreating({})}><Plus /> New assignment</Button>} />

      {(overdueCount > 0 || upcoming.length > 0) && (
        <div className="mb-5 flex flex-wrap gap-2">
          {overdueCount > 0 && (
            <button onClick={() => setStatus("overdue")} className="flex items-center gap-1.5 rounded-lg bg-destructive-soft px-3 py-1.5 text-[13px] font-medium text-destructive">
              <AlertTriangle className="size-3.5" /> {overdueCount} overdue
            </button>
          )}
          {upcoming.length > 0 && (
            <span className="flex items-center gap-1.5 rounded-lg bg-sand-soft px-3 py-1.5 text-[13px] font-medium text-sand">
              {upcoming.length} due in the next 7 days
            </span>
          )}
        </div>
      )}

      <Tabs defaultValue="list">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <TabsList>
            <TabsTrigger value="list"><List /> List</TabsTrigger>
            <TabsTrigger value="kanban"><Columns3 /> Kanban</TabsTrigger>
            <TabsTrigger value="calendar"><CalendarDays /> Calendar</TabsTrigger>
          </TabsList>
          <div className="grid grid-cols-3 gap-2 lg:flex">
            <SubjectSelect value={subject} onChange={(e) => setSubject(e.target.value)} noneLabel="All subjects" aria-label="Filter by subject" className="h-8 text-[13px] lg:w-40" />
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Filter by status" className="h-8 text-[13px] lg:w-36">
              <option value="">All statuses</option>
              {ASSIGNMENT_STATUSES.map((s) => <option key={s} value={s}>{ASSIGNMENT_STATUS_LABEL[s]}</option>)}
              <option value="overdue">Overdue</option>
            </NativeSelect>
            <NativeSelect value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort" className="h-8 text-[13px] lg:w-40">
              <option value="due_asc">Due date (soonest)</option>
              <option value="due_desc">Due date (latest)</option>
              <option value="priority">Priority</option>
            </NativeSelect>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-4 space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : error ? (
          <ErrorState error={error} onRetry={() => refetch()} className="mt-4" />
        ) : (data ?? []).length === 0 ? (
          <EmptyState className="mt-4" icon={ClipboardList} title="No assignments yet" description="Add homework, projects and essays to keep deadlines in view." action={<Button onClick={() => setCreating({})}><Plus /> Add an assignment</Button>} />
        ) : (
          <>
            <TabsContent value="list">
              {filtered.length === 0 ? <EmptyState compact icon={ClipboardList} title="No assignments match these filters" /> : (
                <Card>
                  <ul className="divide-y divide-border">
                    {filtered.map((a) => {
                      const overdue = isOverdue(a.due_date, a.status);
                      const done = a.status === "completed";
                      return (
                        <li key={a.id} className={cn("flex items-center gap-3 px-4 py-3", overdue && "bg-destructive-soft/40")}>
                          <Checkbox checked={done} label={`Mark ${a.title} ${done ? "not started" : "complete"}`} onCheckedChange={(v) => setA.mutate({ id: a.id, status: v ? "completed" : "not_started" })} />
                          <button className="min-w-0 flex-1 text-left" onClick={() => setEditing(a)}>
                            <p className={cn("truncate text-sm font-medium", done && "font-normal text-muted-foreground line-through")}>{a.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className={cn("text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                                {overdue && <AlertTriangle className="mr-1 inline size-3" />}
                                {overdue ? "Overdue · " : done ? "Was due " : "Due "}{fmtDue(a.due_date)}
                              </span>
                              <SubjectTag subject={a.subject_id ? subjects.get(a.subject_id) : null} />
                            </div>
                          </button>
                          <Badge variant={a.status === "in_progress" ? "lavender" : done ? "sage" : "outline"} className="hidden sm:inline-flex">{ASSIGNMENT_STATUS_LABEL[a.status]}</Badge>
                          <Badge variant={PRIORITY_BADGE[a.priority]}>{PRIORITY_LABEL[a.priority]}</Badge>
                          {actions(a)}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              )}
            </TabsContent>
            <TabsContent value="kanban">
              <Kanban items={filtered} subjects={subjects} onOpen={setEditing} onMove={(id, s) => setA.mutate({ id, status: s })} />
            </TabsContent>
            <TabsContent value="calendar">
              <AssignmentCalendar items={filtered} subjects={subjects} onOpen={setEditing} onAdd={(d) => setCreating({ date: d })} />
            </TabsContent>
          </>
        )}
      </Tabs>

      <AssignmentDialog
        open={!!creating || !!editing}
        onOpenChange={(v) => { if (!v) { setCreating(null); setEditing(null); } }}
        assignment={editing}
        defaultSubjectId={subject || null}
        defaultDate={creating?.date ?? null}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(v) => !v && setDeleting(null)}
        title="Delete assignment?"
        description={`“${deleting?.title}” will be permanently deleted.`}
        loading={del.isPending}
        onConfirm={() => deleting && del.mutate(deleting.id)}
      />
    </div>
  );
}

type SubjectLookup = Map<string, { name: string; color: SubjectColor }>;

function Kanban({ items, subjects, onOpen, onMove }: { items: Assignment[]; subjects: SubjectLookup; onOpen: (a: Assignment) => void; onMove: (id: string, s: AssignmentStatus) => void }) {
  const [over, setOver] = useState<AssignmentStatus | null>(null);
  return (
    <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
      {ASSIGNMENT_STATUSES.map((col) => {
        const list = items.filter((a) => a.status === col);
        return (
          <div
            key={col}
            onDragOver={(e) => { e.preventDefault(); setOver(col); }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const id = e.dataTransfer.getData("text/plain");
              const item = items.find((a) => a.id === id);
              if (item && item.status !== col) onMove(id, col);
            }}
            className={cn("w-[82%] shrink-0 snap-start rounded-xl border border-border bg-surface p-2 transition-colors sm:w-auto", over === col && "border-primary/50 bg-primary-soft/40")}
          >
            <div className="flex items-center justify-between px-1.5 py-1">
              <p className="text-[13px] font-medium">{ASSIGNMENT_STATUS_LABEL[col]}</p>
              <span className="text-xs text-muted-foreground">{list.length}</span>
            </div>
            <div className="mt-1 min-h-24 space-y-2">
              {list.map((a) => {
                const overdue = isOverdue(a.due_date, a.status);
                const s = a.subject_id ? subjects.get(a.subject_id) : null;
                return (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/plain", a.id)}
                    className={cn("cursor-grab rounded-lg border bg-card p-3 shadow-soft active:cursor-grabbing", overdue ? "border-destructive/40" : "border-border")}
                  >
                    <button className="w-full text-left" onClick={() => onOpen(a)}>
                      <p className={cn("text-sm font-medium", a.status === "completed" && "text-muted-foreground line-through")}>{a.title}</p>
                      <p className={cn("mt-1 text-xs", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>{overdue && "Overdue · "}{fmtDue(a.due_date)}</p>
                    </button>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      {s ? <SubjectTag subject={s} /> : <span />}
                      <Badge variant={PRIORITY_BADGE[a.priority]}>{PRIORITY_LABEL[a.priority]}</Badge>
                    </div>
                    {/* Touch devices can't drag — offer a status picker */}
                    <NativeSelect
                      aria-label={`Move ${a.title}`}
                      value={a.status}
                      onChange={(e) => onMove(a.id, e.target.value as AssignmentStatus)}
                      className="mt-2 h-7 text-xs sm:hidden"
                    >
                      {ASSIGNMENT_STATUSES.map((s2) => <option key={s2} value={s2}>{ASSIGNMENT_STATUS_LABEL[s2]}</option>)}
                    </NativeSelect>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssignmentCalendar({ items, subjects, onOpen, onAdd }: { items: Assignment[]; subjects: SubjectLookup; onOpen: (a: Assignment) => void; onAdd: (d: Date) => void }) {
  const [month, setMonth] = useState(() => new Date());
  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => subMonths(m, 1))} aria-label="Previous month"><ChevronLeft /></Button>
        <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month"><ChevronRight /></Button>
        <Button variant="ghost" size="sm" onClick={() => setMonth(new Date())}>Today</Button>
        <p className="ml-1 text-sm font-medium">{format(month, "MMMM yyyy")}</p>
      </div>
      <MonthGrid
        month={month}
        onDayClick={onAdd}
        renderDay={(d) => {
          const list = items.filter((a) => isSameDay(new Date(a.due_date), d));
          return (
            <>
              {list.slice(0, 3).map((a) => {
                const s = a.subject_id ? subjects.get(a.subject_id) : null;
                const overdue = isOverdue(a.due_date, a.status);
                return (
                  <button
                    key={a.id}
                    onClick={(e) => { e.stopPropagation(); onOpen(a); }}
                    className={cn(
                      "flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] sm:text-[11px]",
                      overdue ? "bg-destructive-soft text-destructive" : s ? cn(colorFor(s.color).soft, colorFor(s.color).text) : "bg-muted",
                      a.status === "completed" && "line-through opacity-60"
                    )}
                  >
                    <span className="truncate">{a.title}</span>
                  </button>
                );
              })}
              {list.length > 3 && <p className="px-1 text-[10px] text-muted-foreground">+{list.length - 3} more</p>}
            </>
          );
        }}
      />
      <p className="mt-2 text-xs text-muted-foreground">Tap a day to add an assignment due that day.</p>
    </div>
  );
}
