"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NAV_ITEMS, isActive } from "./nav";
import { Logo } from "./logo";
import { cn } from "@/lib/utils/cn";

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border bg-sidebar transition-[width] duration-200 md:flex",
        collapsed ? "w-[60px]" : "w-60"
      )}
      aria-label="Main navigation"
    >
      <div className={cn("flex h-14 items-center", collapsed ? "justify-center" : "justify-between px-4")}>
        <Link href="/dashboard" aria-label="StudyFlow home">
          <Logo collapsed={collapsed} />
        </Link>
        {!collapsed && (
          <button onClick={onToggle} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Collapse sidebar">
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex h-8 items-center gap-2.5 rounded-md text-[13.5px] transition-colors",
                collapsed ? "justify-center" : "px-2.5",
                active ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/70 hover:text-foreground"
              )}
            >
              <item.icon className={cn("size-[17px] shrink-0", active && "text-primary")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
      {collapsed && (
        <div className="flex justify-center p-2">
          <button onClick={onToggle} className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Expand sidebar">
            <PanelLeftOpen className="size-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
