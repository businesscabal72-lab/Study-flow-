"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { MOBILE_PRIMARY, NAV_ITEMS, isActive } from "./nav";
import { cn } from "@/lib/utils/cn";

export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => MOBILE_PRIMARY.includes(i.href));
  const more = NAV_ITEMS.filter((i) => !MOBILE_PRIMARY.includes(i.href));
  const moreActive = more.some((i) => isActive(pathname, i.href));

  return (
    <>
      <nav
        className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden"
        aria-label="Primary"
      >
        <div className="grid h-16 grid-cols-5">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center justify-center gap-1 text-[11px]", active ? "text-primary" : "text-muted-foreground")}
              >
                <item.icon className="size-5" />
                {item.short ?? item.label}
              </Link>
            );
          })}
          <button
            onClick={() => setOpen(true)}
            className={cn("flex flex-col items-center justify-center gap-1 text-[11px]", moreActive ? "text-primary" : "text-muted-foreground")}
            aria-haspopup="dialog"
          >
            <MoreHorizontal className="size-5" />
            More
          </button>
        </div>
      </nav>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="gap-2">
          <DialogTitle>More</DialogTitle>
          <div className="grid grid-cols-3 gap-2 pt-2">
            {more.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border border-border p-3 text-center text-xs",
                  isActive(pathname, item.href) ? "bg-primary-soft text-primary" : "hover:bg-accent"
                )}
              >
                <item.icon className="size-5" />
                {item.short ?? item.label}
              </Link>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
