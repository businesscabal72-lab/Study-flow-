import type { SubjectColor } from "@/types/database";

/** Subject color identifiers → static Tailwind classes (kept literal for the compiler). */
export const SUBJECT_COLOR_STYLES: Record<SubjectColor, { dot: string; soft: string; text: string; hex: string; label: string }> = {
  sage: { dot: "bg-[#22c55e]", soft: "bg-[#22c55e]/12", text: "text-[#15803d] dark:text-[#86efac]", hex: "#22c55e", label: "Green" },
  lavender: { dot: "bg-[#8b5cf6]", soft: "bg-[#8b5cf6]/12", text: "text-[#6d28d9] dark:text-[#c4b5fd]", hex: "#8b5cf6", label: "Violet" },
  sand: { dot: "bg-[#f59e0b]", soft: "bg-[#f59e0b]/15", text: "text-[#b45309] dark:text-[#fcd34d]", hex: "#f59e0b", label: "Yellow" },
  sky: { dot: "bg-[#3b82f6]", soft: "bg-[#3b82f6]/12", text: "text-[#1d4ed8] dark:text-[#93c5fd]", hex: "#3b82f6", label: "Blue" },
  rose: { dot: "bg-[#f43f5e]", soft: "bg-[#f43f5e]/12", text: "text-[#be123c] dark:text-[#fda4af]", hex: "#f43f5e", label: "Pink" },
  slate: { dot: "bg-[#64748b]", soft: "bg-[#64748b]/12", text: "text-[#334155] dark:text-[#cbd5e1]", hex: "#64748b", label: "Slate" },
  amber: { dot: "bg-[#f97316]", soft: "bg-[#f97316]/12", text: "text-[#c2410c] dark:text-[#fdba74]", hex: "#f97316", label: "Orange" },
  teal: { dot: "bg-[#14b8a6]", soft: "bg-[#14b8a6]/12", text: "text-[#0f766e] dark:text-[#5eead4]", hex: "#14b8a6", label: "Teal" },
};

export const colorFor = (c: string | null | undefined) =>
  SUBJECT_COLOR_STYLES[(c as SubjectColor) ?? "slate"] ?? SUBJECT_COLOR_STYLES.slate;
