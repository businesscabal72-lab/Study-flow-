"use client";
import { addDays, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { cn } from "@/lib/utils/cn";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function monthRange(month: Date) {
  const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const to = addDays(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), 1);
  return { from, to };
}

/** Month calendar grid. `renderDay` returns the items shown in each cell. */
export function MonthGrid({
  month,
  renderDay,
  onDayClick,
}: {
  month: Date;
  renderDay: (day: Date) => React.ReactNode;
  onDayClick?: (day: Date) => void;
}) {
  const { from, to } = monthRange(month);
  const days: Date[] = [];
  for (let d = from; d < to; d = addDays(d, 1)) days.push(d);
  const today = new Date();
  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className="grid grid-cols-7 border-b border-border bg-surface">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <span className="sm:hidden">{w[0]}</span>
            <span className="hidden sm:inline">{w}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d, i) => (
          <div
            key={d.toISOString()}
            role={onDayClick ? "button" : undefined}
            tabIndex={onDayClick ? 0 : undefined}
            onClick={() => onDayClick?.(d)}
            onKeyDown={(e) => { if (onDayClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onDayClick(d); } }}
            aria-label={onDayClick ? format(d, "EEEE, MMMM d") : undefined}
            className={cn(
              "min-h-16 border-border p-1 text-left sm:min-h-24 sm:p-1.5",
              i % 7 !== 6 && "border-r",
              i < days.length - 7 && "border-b",
              !isSameMonth(d, month) && "bg-surface/60 text-muted-foreground/60",
              onDayClick && "cursor-pointer hover:bg-accent/40"
            )}
          >
            <span className={cn("mb-1 inline-grid size-6 place-items-center rounded-full text-xs tabular-nums", isSameDay(d, today) && "bg-primary font-semibold text-primary-foreground")}>
              {format(d, "d")}
            </span>
            <div className="space-y-0.5">{renderDay(d)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
