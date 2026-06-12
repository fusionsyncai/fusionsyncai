"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, Pause, Play, Plus, RotateCcw, Trash2 } from "lucide-react";

import { REGIONS } from "@/lib/phone";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type GmScraperQueryRow = {
  id: string;
  query: string;
  tagId: string;
  tag: { id: string; name: string };
  campaignId: string | null;
  campaign: { id: string; name: string } | null;
  stageId: string | null;
  stage: { id: string; name: string; pipelineId: string } | null;
  autoProcess: boolean;
  maxResults: number;
  region: string;
  status: string;
  resultCount: number | null;
  lastError: string | null;
  contactCount: number;
  processedAt: string | null;
  createdAt: string;
};

type TagOption = { id: string; name: string };
type CampaignOption = { id: string; name: string };
type StageOption = { id: string; name: string; order: number };

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "DONE") return "default";
  if (status === "PROCESSING") return "secondary";
  if (status === "FAILED") return "destructive";
  if (status === "PAUSED") return "outline";
  return "outline";
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function GmScraperPage() {
  const [queries, setQueries] = useState<GmScraperQueryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);

  const [formQuery, setFormQuery] = useState("");
  const [formTagId, setFormTagId] = useState("");
  const [formCampaignId, setFormCampaignId] = useState<string | null>(null);
  const [formStageId, setFormStageId] = useState<string | null>(null);
  const [formAutoProcess, setFormAutoProcess] = useState(false);
  const [formMaxResults, setFormMaxResults] = useState("120");
  const [formRegion, setFormRegion] = useState("IN");
  const [newTagName, setNewTagName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [runningId, setRunningId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<GmScraperQueryRow | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadQueries = useCallback(async () => {
    const response = await fetch("/api/gm-scraper", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load GM Scraper queries");
    const data = (await response.json()) as { queries: GmScraperQueryRow[] };
    setQueries(data.queries);
  }, []);

  const loadOptions = useCallback(async () => {
    const [tagsRes, campaignsRes] = await Promise.all([
      fetch("/api/tags", { cache: "no-store" }),
      fetch("/api/campaigns", { cache: "no-store" }),
    ]);
    if (!tagsRes.ok || !campaignsRes.ok) {
      throw new Error("Failed to load form options");
    }
    const tagsData = (await tagsRes.json()) as { tags: TagOption[] };
    const campaignsData = (await campaignsRes.json()) as {
      campaigns: CampaignOption[];
    };
    setTags(tagsData.tags);
    setCampaigns(campaignsData.campaigns);
  }, []);

  const loadStagesForCampaign = useCallback(async (campaignId: string | null) => {
    if (!campaignId) {
      setStages([]);
      return;
    }
    const response = await fetch(`/api/campaigns/${campaignId}/pipeline`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setStages([]);
      return;
    }
    const data = (await response.json()) as {
      pipeline: { stages: StageOption[] };
    };
    setStages(data.pipeline.stages);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await loadQueries();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadQueries]);

  useEffect(() => {
    if (!queries.some((q) => q.status === "PROCESSING")) return;
    const id = setInterval(() => void loadQueries().catch(() => {}), 3000);
    return () => clearInterval(id);
  }, [queries, loadQueries]);

  useEffect(() => {
    if (!createOpen) return;
    void loadOptions().catch(() => {});
  }, [createOpen, loadOptions]);

  useEffect(() => {
    void loadStagesForCampaign(formCampaignId);
    setFormStageId(null);
  }, [formCampaignId, loadStagesForCampaign]);

  function resetForm() {
    setFormQuery("");
    setFormTagId("");
    setFormCampaignId(null);
    setFormStageId(null);
    setFormAutoProcess(false);
    setFormMaxResults("120");
    setFormRegion("IN");
    setNewTagName("");
    setFormError(null);
    setStages([]);
  }

  async function createTag() {
    const name = newTagName.trim();
    if (!name) return;
    const response = await fetch("/api/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!response.ok) return;
    const data = (await response.json()) as { tag: TagOption };
    setTags((prev) => [...prev, data.tag]);
    setFormTagId(data.tag.id);
    setNewTagName("");
  }

  async function handleCreate() {
    if (isSaving) return;
    setFormError(null);

    if (!formQuery.trim()) {
      setFormError("Query is required");
      return;
    }
    if (!formTagId) {
      setFormError("Tag is required");
      return;
    }
    if (formAutoProcess && (!formCampaignId || !formStageId)) {
      setFormError("Campaign and stage are required when auto-process is on");
      return;
    }

    const maxResults = Number(formMaxResults.trim());
    if (!Number.isInteger(maxResults) || maxResults < 1) {
      setFormError("Max results must be a positive integer");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/gm-scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: formQuery.trim(),
          tagId: formTagId,
          campaignId: formCampaignId,
          stageId: formStageId,
          autoProcess: formAutoProcess,
          maxResults,
          region: formRegion,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to create query");
      }

      setCreateOpen(false);
      resetForm();
      await loadQueries();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRunNow(row: GmScraperQueryRow) {
    if (runningId) return;
    setRunningId(row.id);
    try {
      await fetch(`/api/gm-scraper/${row.id}/run`, { method: "POST" });
      await loadQueries();
    } finally {
      setRunningId(null);
    }
  }

  async function handleTogglePause(row: GmScraperQueryRow) {
    const next =
      row.status === "PAUSED" ? "PENDING" : ("PAUSED" as const);
    await fetch(`/api/gm-scraper/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    await loadQueries();
  }

  async function handleRetry(row: GmScraperQueryRow) {
    await fetch(`/api/gm-scraper/${row.id}/retry`, { method: "POST" });
    await loadQueries();
  }

  async function handleDelete() {
    if (!toDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/gm-scraper/${toDelete.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete query");
      setToDelete(null);
      await loadQueries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">GM Scraper</h1>
          <p className="text-sm text-muted-foreground">
            Google Maps harvest queries. Enable the &quot;Run GM Scraper&quot;
            cronjob (e.g. every 5 min) to process the queue automatically.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" />
          New query
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Queries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : queries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No queries yet. Create one to start harvesting Google Maps
              listings.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Query</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Auto</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contacts</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {queries.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="max-w-xs font-medium">
                      <Link
                        href={`/gm-scraper/${row.id}`}
                        className="text-primary hover:underline"
                      >
                        {row.query}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.campaign?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.stage?.name ?? "—"}
                    </TableCell>
                    <TableCell>
                      {row.autoProcess ? (
                        <Badge variant="default">On</Badge>
                      ) : (
                        <Badge variant="outline">Off</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <Badge variant={statusVariant(row.status)}>
                          {formatLabel(row.status)}
                        </Badge>
                        {row.lastError ? (
                          <p className="max-w-48 truncate text-xs text-destructive">
                            {row.lastError}
                          </p>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>{row.contactCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          aria-label="Run now"
                          disabled={
                            row.status === "PROCESSING" ||
                            row.status === "PAUSED" ||
                            runningId === row.id
                          }
                          onClick={() => void handleRunNow(row)}
                        >
                          <Play className="size-4" />
                        </Button>
                        {row.status === "FAILED" || row.status === "DONE" ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            aria-label="Retry"
                            onClick={() => void handleRetry(row)}
                          >
                            <RotateCcw className="size-4" />
                          </Button>
                        ) : null}
                        {row.status === "PENDING" || row.status === "PAUSED" ? (
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-8"
                            aria-label={
                              row.status === "PAUSED" ? "Resume" : "Pause"
                            }
                            onClick={() => void handleTogglePause(row)}
                          >
                            <Pause className="size-4" />
                          </Button>
                        ) : null}
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          aria-label="Delete"
                          disabled={row.status === "PROCESSING"}
                          onClick={() => setToDelete(row)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) resetForm();
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New GM Scraper query</DialogTitle>
            <DialogDescription>
              A Maps search string to harvest. One query is processed per cron
              tick.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Search query
              </label>
              <Input
                value={formQuery}
                onChange={(e) => setFormQuery(e.target.value)}
                placeholder="HVAC contractor Orlando FL"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Tag
              </label>
              <Select
                value={formTagId || null}
                onValueChange={(v) => v && setFormTagId(v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select tag" />
                </SelectTrigger>
                <SelectContent>
                  {tags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      {tag.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  placeholder="New tag name"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!newTagName.trim()}
                  onClick={() => void createTag()}
                >
                  <Plus className="size-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Campaign
              </label>
              <Select
                value={formCampaignId ?? "__none__"}
                onValueChange={(v) =>
                  setFormCampaignId(v === "__none__" ? null : v)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="No campaign" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No campaign</SelectItem>
                  {campaigns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formCampaignId ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Pipeline stage
                </label>
                <Select
                  value={formStageId ?? ""}
                  onValueChange={(v) => v && setFormStageId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            <label className="flex items-center gap-2">
              <Switch
                checked={formAutoProcess}
                onCheckedChange={(c) => setFormAutoProcess(c === true)}
              />
              <span className="text-sm">
                Auto-process (place contacts in stage when done)
              </span>
            </label>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Phone region
              </label>
              <Select value={formRegion} onValueChange={(v) => v && setFormRegion(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(REGIONS).map((code) => (
                    <SelectItem key={code} value={code}>
                      {code} (+{REGIONS[code].callingCode})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Local numbers get +{REGIONS[formRegion]?.callingCode ?? "…"}; leading 0 is stripped.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Max results
              </label>
              <Input
                value={formMaxResults}
                onChange={(e) => setFormMaxResults(e.target.value)}
                inputMode="numeric"
              />
            </div>

            {formError ? (
              <p className="text-sm text-destructive">{formError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void handleCreate()}
            >
              <MapPin className="size-4" />
              {isSaving ? "Creating..." : "Create query"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete query?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes &quot;{toDelete?.query}&quot;. Scraped contacts are
              kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
