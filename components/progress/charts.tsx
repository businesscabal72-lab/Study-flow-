"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtMinutes } from "@/lib/utils/format";

const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
    color: "var(--popover-foreground)",
    boxShadow: "var(--shadow-float)",
  },
  cursor: { fill: "var(--muted)", opacity: 0.6 },
};

export function MinutesBarChart({ data, height = 200 }: { data: { day: string; minutes: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="day" {...axis} />
          <YAxis {...axis} allowDecimals={false} tickFormatter={(v: number) => (v >= 60 ? `${Math.round(v / 60)}h` : `${v}m`)} width={42} />
          <Tooltip {...tooltipStyle} formatter={(v) => [fmtMinutes(Number(v)), "Study time"]} />
          <Bar dataKey="minutes" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data, height = 200 }: { data: { name: string; value: number; color: string }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={2} stroke="var(--card)" strokeWidth={2}>
            {data.map((d) => <Cell key={d.name} fill={d.color} />)}
          </Pie>
          <Tooltip {...tooltipStyle} formatter={(v, n) => [fmtMinutes(Number(v)), String(n)]} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StackedBarChart({
  data,
  keys,
  height = 200,
}: {
  data: Record<string, string | number>[];
  keys: { key: string; label: string; color: string }[];
  height?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="label" {...axis} />
          <YAxis {...axis} allowDecimals={false} width={42} />
          <Tooltip {...tooltipStyle} />
          {keys.map((k, i) => (
            <Bar key={k.key} dataKey={k.key} name={k.label} stackId="a" fill={k.color} radius={i === keys.length - 1 ? [4, 4, 0, 0] : 0} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ConsistencyLine({ data, height = 200 }: { data: { week: string; activeDays: number }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="week" {...axis} />
          <YAxis {...axis} domain={[0, 7]} ticks={[0, 2, 4, 6, 7]} width={36} />
          <Tooltip {...tooltipStyle} formatter={(v) => [`${v} of 7 days`, "Active"]} />
          <Line type="monotone" dataKey="activeDays" stroke="var(--chart-2)" strokeWidth={2} dot={{ r: 3, fill: "var(--chart-2)" }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
