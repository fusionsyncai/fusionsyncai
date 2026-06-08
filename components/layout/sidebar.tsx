"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Clock,
  LayoutDashboard,
  MapPin,
  Megaphone,
  ScrollText,
  Users,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Contacts",
    href: "/contacts",
    icon: Users,
  },
  {
    title: "Campaigns",
    href: "/campaigns",
    icon: Megaphone,
  },
  {
    title: "GM Scraper",
    href: "/gm-scraper",
    icon: MapPin,
  },
  {
    title: "Actions",
    href: "/actions",
    icon: Zap,
  },
  {
    title: "Cronjobs",
    href: "/cronjobs",
    icon: Clock,
  },
  {
    title: "Logs",
    href: "/logs",
    icon: ScrollText,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 border-r bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="border-b px-5 py-4">
        <p className="text-sm font-semibold tracking-tight">FusionSync CRM</p>
        <p className="text-xs text-muted-foreground">Lead factory</p>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive &&
                  "bg-sidebar-accent text-sidebar-accent-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
