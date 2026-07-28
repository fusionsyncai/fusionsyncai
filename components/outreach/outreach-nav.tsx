"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/outreach/queue", label: "Queue" },
  { href: "/outreach/lists", label: "Lists" },
  { href: "/outreach/import", label: "Import" },
  { href: "/outreach/sources", label: "Sources" },
];

export function OutreachNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 space-y-1">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outreach</h1>
        <p className="text-sm text-muted-foreground">
          UK dental agency partner motion — queue, lists, drafts, timeline
        </p>
      </div>
      <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
