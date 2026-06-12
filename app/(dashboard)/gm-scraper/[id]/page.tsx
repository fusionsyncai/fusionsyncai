"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Check, Pencil, Play, Plus, RotateCcw } from "lucide-react";

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
  stage: { id: string; name: string } | null;
  autoProcess: boolean;
  maxResults: number;
  status: string;
  resultCount: number | null;
  lastError: string | null;
  contactCount: number;
  processedAt: string | null;
  createdAt: string;
};

type TagOption = { id: string; name: string };

type ContactRow = {
  id: string;
  name: string;
  email: string | null;
  emailStatus: string;
  phone: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  enrichmentStatus: string;
  addedAt: string;
  inStage: boolean;
};

type CampaignOption = { id: string; name: string };
type StageOption = { id: string; name: string };

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function GmScraperDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [query, setQuery] = useState<GmScraperQueryRow | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [stages, setStages] = useState<StageOption[]>([]);
  const [pushCampaignId, setPushCampaignId] = useState<string | null>(null);
  const [pushStageId, setPushStageId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPushing, setIsPushing] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [processingContactId, setProcessingContactId] = useState<string | null>(
    null,
  );
  const [contactError, setContactError] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [editQuery, setEditQuery] = useState("");
  const [editTagId, setEditTagId] = useState("");
  const [editCampaignId, setEditCampaignId] = useState<string | null>(null);
  const [editStageId, setEditStageId] = useState<string | null>(null);
  const [editStages, setEditStages] = useState<StageOption[]>([]);
  const [editAutoProcess, setEditAutoProcess] = useState(false);
  const [editMaxResults, setEditMaxResults] = useState("120");
  const [newTagName, setNewTagName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const load = useCallback(async () => {
    const [queryRes, contactsRes] = await Promise.all([
      fetch(`/api/gm-scraper/${id}`, { cache: "no-store" }),
      fetch(`/api/gm-scraper/${id}/contacts`, { cache: "no-store" }),
    ]);

    if (!queryRes.ok) throw new Error("Query not found");

    const queryData = (await queryRes.json()) as { query: GmScraperQueryRow };
    const contactsData = contactsRes.ok
      ? ((await contactsRes.json()) as { contacts: ContactRow[] })
      : { contacts: [] };

    setQuery(queryData.query);
    setContacts(contactsData.contacts);
    setPushCampaignId(queryData.query.campaign?.id ?? null);
    setPushStageId(queryData.query.stage?.id ?? null);
  }, [id]);

  const loadCampaigns = useCallback(async () => {
    const response = await fetch("/api/campaigns", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { campaigns: CampaignOption[] };
    setCampaigns(data.campaigns);
  }, []);

  const loadStages = useCallback(async (campaignId: string | null) => {
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
        await Promise.all([load(), loadCampaigns()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [load, loadCampaigns]);

  useEffect(() => {
    if (query?.status !== "PROCESSING") return;
    const timer = setInterval(() => void load().catch(() => {}), 3000);
    return () => clearInterval(timer);
  }, [query?.status, load]);

  const loadEditStages = useCallback(async (campaignId: string | null) => {
    if (!campaignId) {
      setEditStages([]);
      return;
    }
    const response = await fetch(`/api/campaigns/${campaignId}/pipeline`, {
      cache: "no-store",
    });
    if (!response.ok) {
      setEditStages([]);
      return;
    }
    const data = (await response.json()) as {
      pipeline: { stages: StageOption[] };
    };
    setEditStages(data.pipeline.stages);
  }, []);

  async function handleRunNow() {
    setIsRunning(true);
    try {
      await fetch(`/api/gm-scraper/${id}/run`, { method: "POST" });
      await load();
    } finally {
      setIsRunning(false);
    }
  }

  async function handleRetry() {
    await fetch(`/api/gm-scraper/${id}/retry`, { method: "POST" });
    await load();
  }

  async function handleProcessContact(contactId: string) {
    if (processingContactId) return;
    setProcessingContactId(contactId);
    setContactError(null);
    try {
      const response = await fetch(
        `/api/gm-scraper/${id}/contacts/${contactId}/process`,
        { method: "POST" },
      );
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to process contact");
      }
      await load();
    } catch (err) {
      setContactError(
        err instanceof Error ? err.message : "Failed to process contact",
      );
    } finally {
      setProcessingContactId(null);
    }
  }

  async function handlePush() {
    if (!pushCampaignId || !pushStageId) {
      setPushMessage("Select a campaign and stage");
      return;
    }

    setIsPushing(true);
    setPushMessage(null);
    try {
      const response = await fetch(`/api/gm-scraper/${id}/push`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: pushCampaignId,
          stageId: pushStageId,
        }),
      });

      const data = (await response.json().catch(() => null)) as {
        error?: string;
        moved?: number;
        created?: number;
        matched?: number;
      } | null;

      if (!response.ok) {
        throw new Error(data?.error ?? "Push failed");
      }

      setPushMessage(
        `Placed ${data?.matched ?? 0} contact(s): ${data?.created ?? 0} created, ${data?.moved ?? 0} moved`,
      );
    } catch (err) {
      setPushMessage(err instanceof Error ? err.message : "Push failed");
    } finally {
      setIsPushing(false);
    }
  }

  async function loadTags() {
    const response = await fetch("/api/tags", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { tags: TagOption[] };
    setTags(data.tags);
  }

  function openEdit() {
    if (!query) return;
    setEditQuery(query.query);
    setEditTagId(query.tagId);
    setEditCampaignId(query.campaignId);
    setEditStageId(query.stageId);
    setEditAutoProcess(query.autoProcess);
    setEditMaxResults(String(query.maxResults));
    setNewTagName("");
    setEditError(null);
    setEditOpen(true);
    void loadTags();
    void loadEditStages(query.campaignId);
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
    setEditTagId(data.tag.id);
    setNewTagName("");
  }

  async function handleSaveEdit() {
    if (isSaving) return;
    setEditError(null);

    if (!editQuery.trim()) {
      setEditError("Query is required");
      return;
    }
    if (!editTagId) {
      setEditError("Tag is required");
      return;
    }
    if (editAutoProcess && (!editCampaignId || !editStageId)) {
      setEditError("Campaign and stage are required when auto-process is on");
      return;
    }

    const maxResults = Number(editMaxResults.trim());
    if (!Number.isInteger(maxResults) || maxResults < 1) {
      setEditError("Max results must be a positive integer");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`/api/gm-scraper/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: editQuery.trim(),
          tagId: editTagId,
          campaignId: editCampaignId,
          stageId: editCampaignId ? editStageId : null,
          autoProcess: editAutoProcess,
          maxResults,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to update query");
      }

      setEditOpen(false);
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground">Loading query...</p>
    );
  }

  if (error || !query) {
    return (
      <div className="space-y-4">
        <Link
          href="/gm-scraper"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to GM Scraper
        </Link>
        <p className="text-sm text-destructive">{error ?? "Query not found"}</p>
      </div>
    );
  }

  const showPushPanel =
    query.status === "DONE" && !query.autoProcess && contacts.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/gm-scraper"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            GM Scraper
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">
            {query.query}
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge>{formatLabel(query.status)}</Badge>
            <span>Tag: {query.tag.name}</span>
            {query.campaign ? <span>Campaign: {query.campaign.name}</span> : null}
            {query.stage ? <span>Stage: {query.stage.name}</span> : null}
            <span>Auto-process: {query.autoProcess ? "On" : "Off"}</span>
            <span>Max: {query.maxResults}</span>
          </div>
          {query.lastError ? (
            <p className="text-sm text-destructive">{query.lastError}</p>
          ) : null}
        </div>

        <div className="flex gap-2">
          {query.status !== "PROCESSING" && (
            <Button variant="outline" onClick={openEdit}>
              <Pencil className="size-4" />
              Edit
            </Button>
          )}
          {(query.status === "PENDING" || query.status === "FAILED" || query.status === "PROCESSING") && (
            <Button
              variant="outline"
              disabled={isRunning || query.status === "PROCESSING"}
              onClick={() => void handleRunNow()}
            >
              <Play className="size-4" />
              Run now
            </Button>
          )}
          {(query.status === "DONE" || query.status === "FAILED") && (
            <Button variant="outline" onClick={() => void handleRetry()}>
              <RotateCcw className="size-4" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {showPushPanel ? (
        <Card>
          <CardHeader>
            <CardTitle>Push to pipeline stage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Auto-process was off. Review contacts below, then place them in a
              campaign stage.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Campaign
                </label>
                <Select
                  value={pushCampaignId ?? "__none__"}
                  onValueChange={(v) => {
                    setPushCampaignId(v === "__none__" ? null : v);
                    setPushStageId(null);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select campaign" />
                  </SelectTrigger>
                  <SelectContent>
                    {campaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Stage
                </label>
                <Select
                  value={pushStageId ?? ""}
                  onValueChange={(v) => v && setPushStageId(v)}
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
            </div>
            <Button disabled={isPushing} onClick={() => void handlePush()}>
              {isPushing ? "Pushing..." : "Push to stage"}
            </Button>
            {pushMessage ? (
              <p className="text-sm text-muted-foreground">{pushMessage}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>
            Scraped contacts ({contacts.length})
            {query.resultCount !== null ? (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {query.resultCount} created on last run
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contactError ? (
            <p className="mb-3 text-sm text-destructive">{contactError}</p>
          ) : null}
          {!query.stage ? (
            <p className="mb-3 text-sm text-muted-foreground">
              Set a campaign and stage on this query (Edit) to enable manual
              processing.
            </p>
          ) : null}
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No contacts linked to this query yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12" />
                  <TableHead className="max-w-xs">Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead>Enrichment</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell>
                      {contact.inStage ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-muted-foreground"
                          aria-label="Already in stage"
                          title={`In ${query.stage?.name ?? "stage"}`}
                          disabled
                        >
                          <Check className="size-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          aria-label="Process — add to configured stage"
                          title={
                            query.stage
                              ? `Add to ${query.stage.name}`
                              : "Configure a stage first"
                          }
                          disabled={
                            !query.stage || processingContactId !== null
                          }
                          onClick={() => void handleProcessContact(contact.id)}
                        >
                          <Play className="size-4" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="max-w-xs truncate font-medium">
                      <Link
                        href={`/contacts/${contact.id}`}
                        className="text-primary hover:underline"
                        title={contact.name}
                      >
                        {contact.name}
                      </Link>
                    </TableCell>
                    <TableCell>{contact.phone ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {contact.companyWebsite ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {formatLabel(contact.enrichmentStatus)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(contact.addedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit query settings</DialogTitle>
            <DialogDescription>
              Tag, campaign, stage, auto-process, and max results. Changes apply
              on the next run.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Search query
              </label>
              <Input
                value={editQuery}
                onChange={(e) => setEditQuery(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Tag
              </label>
              <Select
                value={editTagId || null}
                onValueChange={(v) => v && setEditTagId(v)}
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
                value={editCampaignId ?? "__none__"}
                onValueChange={(v) => {
                  const campaignId = v === "__none__" ? null : v;
                  setEditCampaignId(campaignId);
                  setEditStageId(null);
                  void loadEditStages(campaignId);
                }}
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

            {editCampaignId ? (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Pipeline stage
                </label>
                <Select
                  value={editStageId ?? ""}
                  onValueChange={(v) => v && setEditStageId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {editStages.map((stage) => (
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
                checked={editAutoProcess}
                onCheckedChange={(c) => setEditAutoProcess(c === true)}
              />
              <span className="text-sm">
                Auto-process (place contacts in stage when done)
              </span>
            </label>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Max results
              </label>
              <Input
                value={editMaxResults}
                onChange={(e) => setEditMaxResults(e.target.value)}
                inputMode="numeric"
              />
            </div>

            {editError ? (
              <p className="text-sm text-destructive">{editError}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSaveEdit()}
            >
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
