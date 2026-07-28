"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { OUTREACH_CHANNELS } from "@/lib/outreach/constants";
import { cn } from "@/lib/utils";

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  linkedin: "LinkedIn",
  "email-linkedin": "Email + LinkedIn",
  reddit: "Reddit",
};

type ProfileChannelNavProps = {
  profileId: string;
  profileName: string;
};

export function ProfileChannelNav({
  profileId,
  profileName,
}: ProfileChannelNavProps) {
  const pathname = usePathname();
  const base = `/outreach/${profileId}/channels`;

  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Link href="/outreach" className="hover:text-foreground underline">
          Outreach
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{profileName}</span>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <nav className="flex flex-wrap gap-1 rounded-lg bg-muted p-1">
        {OUTREACH_CHANNELS.map((channel) => {
          const href = `${base}/${channel}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={channel}
              href={href}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {CHANNEL_LABELS[channel] ?? channel}
            </Link>
          );
        })}
        <Link
          href={`/outreach/${profileId}/settings`}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
            pathname.endsWith("/settings")
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          Settings
        </Link>
      </nav>
      <button
        type="button"
        className="text-xs text-muted-foreground underline"
        onClick={() => navigator.clipboard.writeText(profileId)}
        title="For campaign pipeline 'Add to Profile' action"
      >
        Copy profile ID
      </button>
    </div>
    </div>
  );
}
