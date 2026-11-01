import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Home,
  Layers,
  Settings,
  Sparkles,
  Timer,
  Library,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  short?: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", short: "Home", icon: Home },
  { href: "/schedule", label: "My Schedule", short: "Schedule", icon: CalendarDays },
  { href: "/subjects", label: "My Subjects", short: "Subjects", icon: Library },
  { href: "/notes", label: "Notes", icon: BookOpen },
  { href: "/assignments", label: "Assignments", icon: ClipboardList },
  { href: "/exams", label: "Exam Center", short: "Exams", icon: GraduationCap },
  { href: "/ai", label: "AI Study Assistant", short: "AI", icon: Sparkles },
  { href: "/focus", label: "Focus Room", short: "Focus", icon: Timer },
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/progress", label: "My Progress", short: "Progress", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export const MOBILE_PRIMARY = ["/dashboard", "/schedule", "/notes", "/ai"];

export const isActive = (pathname: string, href: string) => pathname === href || pathname.startsWith(href + "/");
