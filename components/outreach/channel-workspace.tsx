"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

import { AddToChannelDialog } from "@/components/outreach/add-to-channel-dialog";
import { DraftPanel } from "@/components/outreach/draft-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { OutreachDrafts } from "@/lib/outreach/types";

type OutreachItemRow = {
  id: string;
  pipeline: string;
  status: string;
  signalContext: string | null;
  sourceUrl: string | null;
  drafts: OutreachDrafts | null;
  contact: {
    id: string;
    name: string;
    email: string | null;
    linkedinUrl: string | null;
    companyName: string | null;
    companyShortName: string | null;
    companyEmployeeCount: number | null;
    customData: unknown;
  } | null;
};

const STATUSES = ["PENDING", "SENT", "REPLIED", "SUCCESS", "SKIP"] as const;

function formatLabel(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function statusVariant(status: string) {
  if (status === "SUCCESS") return "default" as const;
  if (status === "REPLIED") return "secondary" as const;
  if (status === "SENT") return "outline" as const;
  if (status === "SKIP") return "destructive" as const;
  return "outline" as const;
}

type ChannelWorkspaceProps = {
  profileId: string;
  channel: string;
};

export function ChannelWorkspace({ profileId, channel }: ChannelWorkspaceProps) {
  const [items, setItems] = useState<OutreachItemRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    item: OutreachItemRow & {
      timeline: {
        id: string;
        type: string;
        author: string;
        body: string;
        createdAt: string;
      }[];
    };
  } | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<"NOTE_SENT" | "NOTE_RECEIVED">(
    "NOTE_SENT",
  );
  const [isSaving, setIsSaving] = useState(false);
  const [teamSizeNote, setTeamSizeNote] = useState("");

  const loadItems = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        profileId,
        channel,
        pageSize: "50",
      });
      if (statusFilter !== "all") params.set("status", statusFilter);

      const response = await fetch(`/api/outreach/items?${params}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to load");
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setIsLoading(false);
    }
  }, [profileId, channel, statusFilter]);

  const loadDetail = useCallback(async (id: string) => {
    const response = await fetch(`/api/outreach/items/${id}`);
    const data = await response.json();
    if (response.ok) {
      setDetail({ item: data.item });
      const custom = data.item.contact?.customData;
      if (custom && typeof custom === "object" && !Array.isArray(custom)) {
        const ts = (custom as Record<string, unknown>).teamSize;
        setTeamSizeNote(typeof ts === "string" ? ts : "");
      } else {
        setTeamSizeNote("");
      }
    }
  }, []);

  useEffect(() => {
    void loadItems();
  }, [loadItems]);

  useEffect(() => {
    if (selectedId) void loadDetail(selectedId);
    else setDetail(null);
  }, [selectedId, loadDetail]);

  async function regenerateDrafts() {
    if (!selectedId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/outreach/items/${selectedId}/draft`, {
        method: "POST",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed");
      setDetail({ item: data.item });
      void loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setIsSaving(false);
    }
  }

  async function addNote() {
    if (!selectedId || !note.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch(
        `/api/outreach/items/${selectedId}/timeline`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: noteType, body: note.trim() }),
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed");
      setDetail({ item: data.item });
      setNote("");
      void loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setIsSaving(false);
    }
  }

  async function setStatus(status: string) {
    if (!selectedId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/outreach/items/${selectedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Failed");
      }
      void loadDetail(selectedId);
      void loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setIsSaving(false);
    }
  }

  async function saveContactField(field: "companyEmployeeCount" | "customData", value: unknown) {
    if (!selected?.contact?.id) return;
    setIsSaving(true);
    try {
      const body =
        field === "companyEmployeeCount"
          ? { companyEmployeeCount: value }
          : {
              customData: {
                ...(typeof selected.contact.customData === "object" &&
                selected.contact.customData &&
                !Array.isArray(selected.contact.customData)
                  ? selected.contact.customData
                  : {}),
                teamSize: value,
              },
            };

      const response = await fetch(`/api/contacts/${selected.contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("Failed to update contact");
      void loadDetail(selectedId!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact");
    } finally {
      setIsSaving(false);
    }
  }

  const selected = detail?.item ?? items.find((item) => item.id === selectedId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value ?? "all")}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {formatLabel(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <AddToChannelDialog
          profileId={profileId}
          channel={channel}
          onCreated={loadItems}
        />
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contacts</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-4 text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="p-4 text-sm text-muted-foreground">
                No contacts in this channel yet. Campaign pipeline &quot;Add to
                Profile&quot; stage will populate this automatically.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
                    <TableRow
                      key={item.id}
                      className={
                        selectedId === item.id ? "bg-muted/50" : "cursor-pointer"
                      }
                      onClick={() => setSelectedId(item.id)}
                    >
                      <TableCell>
                        <div className="font-medium">
                          {item.contact?.name ?? "Unknown"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {item.contact?.companyShortName ??
                            item.contact?.companyName ??
                            "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(item.status)}>
                          {formatLabel(item.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4 lg:col-span-3">
          {!selected ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Select a contact to view drafts, notes, and timeline.
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-3 pb-2">
                  <div>
                    <CardTitle className="text-base">
                      {selected.contact?.name ?? "Unknown"}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {selected.contact?.companyName ?? "—"}
                    </p>
                    {selected.signalContext ? (
                      <p className="mt-2 text-sm">{selected.signalContext}</p>
                    ) : null}
                    {selected.contact ? (
                      <Link
                        href={`/contacts/${selected.contact.id}`}
                        className="mt-1 inline-block text-sm text-primary underline"
                      >
                        Open full contact
                      </Link>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={regenerateDrafts}
                    >
                      <RefreshCw className="size-4" />
                      Redraft
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isSaving}
                      onClick={() => setStatus("SUCCESS")}
                    >
                      Mark success
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={isSaving}
                      onClick={() => setStatus("SKIP")}
                    >
                      Skip
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selected.contact ? (
                    <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                      <label className="text-xs text-muted-foreground">
                        Team size (custom)
                        <Input
                          className="mt-1"
                          value={teamSizeNote}
                          onChange={(e) => setTeamSizeNote(e.target.value)}
                          onBlur={() =>
                            saveContactField("customData", teamSizeNote.trim())
                          }
                          placeholder="e.g. 8-person agency"
                        />
                      </label>
                      <label className="text-xs text-muted-foreground">
                        Employees (column)
                        <Input
                          className="mt-1"
                          type="number"
                          defaultValue={
                            selected.contact.companyEmployeeCount ?? ""
                          }
                          onBlur={(e) => {
                            const n = Number(e.target.value);
                            if (Number.isFinite(n) && n > 0) {
                              void saveContactField("companyEmployeeCount", n);
                            }
                          }}
                          placeholder="e.g. 12"
                        />
                      </label>
                    </div>
                  ) : null}
                  <DraftPanel drafts={(selected.drafts as OutreachDrafts) ?? null} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Timeline</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {(detail?.item.timeline ?? []).map((entry) => (
                      <div
                        key={entry.id}
                        className="rounded-md border px-3 py-2 text-sm"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                          <span>
                            {entry.author.toLowerCase()} · {formatLabel(entry.type)}
                          </span>
                          <span>
                            {new Intl.DateTimeFormat("en-GB", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }).format(new Date(entry.createdAt))}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap">{entry.body}</p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 border-t pt-4">
                    <Select
                      value={noteType}
                      onValueChange={(value) =>
                        setNoteType(
                          (value ?? "NOTE_SENT") as "NOTE_SENT" | "NOTE_RECEIVED",
                        )
                      }
                    >
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NOTE_SENT">Sent</SelectItem>
                        <SelectItem value="NOTE_RECEIVED">Received</SelectItem>
                      </SelectContent>
                    </Select>
                    <textarea
                      className="min-h-24 w-full rounded-md border bg-background px-3 py-2 text-sm"
                      placeholder="Log what you sent or what they replied…"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                    <Button
                      type="button"
                      disabled={isSaving || !note.trim()}
                      onClick={addNote}
                    >
                      Add to timeline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
