"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ProfileRow = {
  id: string;
  name: string;
  slug: string;
  icpDescription: string | null;
  _count: { items: number };
};

export default function OutreachProfilesPage() {
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [icp, setIcp] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/outreach/profiles");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load");
      setProfiles(data.profiles);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createProfile() {
    setIsCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/outreach/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          icpDescription: icp.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to create");
      setCreateOpen(false);
      setName("");
      setIcp("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Outreach</h1>
          <p className="text-sm text-muted-foreground">
            Profiles are execution workspaces. Campaigns admit qualified contacts
            into a profile by channel.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New profile
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading profiles…</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((profile) => (
            <Link key={profile.id} href={`/outreach/${profile.id}/channels/email`}>
              <Card className="transition-colors hover:bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-lg">{profile.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-muted-foreground">
                  {profile.icpDescription ? (
                    <p className="line-clamp-3">{profile.icpDescription}</p>
                  ) : null}
                  <p>{profile._count.items} outreach item(s)</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create outreach profile</DialogTitle>
            <DialogDescription>
              Defines ICP context and voice for drafts in this motion.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              placeholder="Profile name (e.g. Dental Patient Acquisition)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <textarea
              className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="ICP description — who is this for?"
              value={icp}
              onChange={(e) => setIcp(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              disabled={isCreating || !name.trim()}
              onClick={createProfile}
            >
              {isCreating ? "Creating…" : "Create profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
