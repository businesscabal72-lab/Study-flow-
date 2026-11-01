import type { SubjectColor } from "@/types/database";

/** Subject color identifiers → static Tailwind classes (kept literal for the compiler). */
export const SUBJECT_COLOR_STYLES: Record<SubjectColor, { dot: string; soft: string; text: string; hex: string; label: string }> = {
  sage: { dot: "bg-[#6f9a77]", soft: "bg-[#6f9a77]/12", text: "text-[#4f7a57] dark:text-[#9cc4a3]", hex: "#6f9a77", label: "Sage" },
  lavender: { dot: "bg-[#8d82be]", soft: "bg-[#8d82be]/12", text: "text-[#6c60a0] dark:text-[#b4aae0]", hex: "#8d82be", label: "Lavender" },
  sand: { dot: "bg-[#c2a374]", soft: "bg-[#c2a374]/15", text: "text-[#93733f] dark:text-[#d8bc90]", hex: "#c2a374", label: "Sand" },
  sky: { dot: "bg-[#6c9bb8]", soft: "bg-[#6c9bb8]/12", text: "text-[#46799a] dark:text-[#9cc3dc]", hex: "#6c9bb8", label: "Sky" },
  rose: { dot: "bg-[#c58787]", soft: "bg-[#c58787]/12", text: "text-[#a25f5f] dark:text-[#e0a9a9]", hex: "#c58787", label: "Rose" },
  slate: { dot: "bg-[#7f8790]", soft: "bg-[#7f8790]/12", text: "text-[#5c636b] dark:text-[#aeb5bd]", hex: "#7f8790", label: "Slate" },
  amber: { dot: "bg-[#d29a4a]", soft: "bg-[#d29a4a]/12", text: "text-[#a06f24] dark:text-[#e6b874]", hex: "#d29a4a", label: "Amber" },
  teal: { dot: "bg-[#5ea39b]", soft: "bg-[#5ea39b]/12", text: "text-[#3b7f77] dark:text-[#8fcac2]", hex: "#5ea39b", label: "Teal" },
};

export const colorFor = (c: string | null | undefined) =>
  SUBJECT_COLOR_STYLES[(c as SubjectColor) ?? "slate"] ?? SUBJECT_COLOR_STYLES.slate;
