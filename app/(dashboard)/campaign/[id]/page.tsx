"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";

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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type TagOption } from "@/components/tags/tag-picker";

type ContactStage = {
  id: string;
  name: string;
  order: number;
};

type Contact = {
  id: string;
  name: string;
  quality: string;
  emailStatus: string;
  addedAt: string;
  stage: ContactStage | null;
  stageStatus: string | null;
};

type ContactsResponse = {
  contacts: Contact[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

const ALL_STAGES = "all";

type StageAction = {
  id: string;
  name: string;
  method: string;
  url: string;
};

type Stage = {
  id: string;
  name: string;
  order: number;
  actionId: string | null;
  autoProcessing: boolean;
  action: StageAction | null;
  _count: { contacts: number };
};

type ActionOption = {
  id: string;
  name: string;
  method: string;
};

const NO_ACTION = "none";

type Pipeline = {
  id: string;
  name: string;
  stages: Stage[];
};

type Aggregate = {
  key: string;
  count: number;
};

type CampaignDetail = {
  campaign: {
    id: string;
    name: string;
    description: string | null;
    recallsyncCampaignId: string | null;
    createdAt: string;
    contactCount: number;
    pipeline: Pipeline | null;
  };
  aggregates: {
    byQuality: Aggregate[];
    byEmailStatus: Aggregate[];
  };
};

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

const chartConfig = {
  count: { label: "Contacts" },
} satisfies ChartConfig;

function DistributionChart({ data }: { data: Aggregate[] }) {
  const chartData = data.map((item) => ({
    label: formatLabel(item.key),
    count: item.count,
  }));

  return (
    <ChartContainer config={chartConfig} className="h-[220px] w-full">
      <BarChart accessibilityLayer data={chartData} margin={{ top: 8 }}>
        <CartesianGrid vertical={false} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="count" radius={6}>
          {chartData.map((entry, index) => (
            <Cell
              key={entry.label}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const campaignId = params.id;

  const [data, setData] = useState<CampaignDetail | null>(null);
  const [actions, setActions] = useState<ActionOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newStageName, setNewStageName] = useState("");
  const [isMutating, setIsMutating] = useState(false);
  const [stageToDelete, setStageToDelete] = useState<Stage | null>(null);
  const [editingStageId, setEditingStageId] = useState<string | null>(null);
  const [editingStageName, setEditingStageName] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [processMsg, setProcessMsg] = useState<string | null>(null);

  // Contacts tab: server-side paginated + stage-filtered list (separate from
  // the campaign detail, which only feeds the dashboard aggregates + pipeline).
  const [contactsData, setContactsData] = useState<ContactsResponse | null>(
    null,
  );
  const [stageFilter, setStageFilter] = useState<string>(ALL_STAGES);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsLoading, setContactsLoading] = useState(true);

  // Bulk "move all contacts tagged X into stage Y" (the actionable half of
  // outcome tagging — e.g. sweep "invalid-email" contacts into a fallback stage).
  const [tags, setTags] = useState<TagOption[]>([]);
  const [bulkTagId, setBulkTagId] = useState<string>("");
  const [bulkStageId, setBulkStageId] = useState<string>("");
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const [bulkMsg, setBulkMsg] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const query = new URLSearchParams({ page: String(contactsPage) });
      if (stageFilter !== ALL_STAGES) query.set("stageId", stageFilter);

      const response = await fetch(
        `/api/campaigns/${campaignId}/contacts?${query.toString()}`,
        { cache: "no-store" },
      );

      if (response.ok) {
        setContactsData((await response.json()) as ContactsResponse);
      }
    } finally {
      setContactsLoading(false);
    }
  }, [campaignId, contactsPage, stageFilter]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const loadCampaign = useCallback(async () => {
    const response = await fetch(`/api/campaigns/${campaignId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(
        response.status === 404
          ? "Campaign not found"
          : "Failed to load campaign",
      );
    }

    setData((await response.json()) as CampaignDetail);
  }, [campaignId]);

  const loadActions = useCallback(async () => {
    const response = await fetch("/api/actions", { cache: "no-store" });
    if (response.ok) {
      const json = (await response.json()) as { actions: ActionOption[] };
      setActions(json.actions);
    }
  }, []);

  const loadTags = useCallback(async () => {
    const response = await fetch("/api/tags", { cache: "no-store" });
    if (response.ok) {
      const json = (await response.json()) as { tags: TagOption[] };
      setTags(json.tags);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await Promise.all([loadCampaign(), loadActions(), loadTags()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadCampaign, loadActions, loadTags]);

  async function handleAddStage() {
    const name = newStageName.trim();
    if (!name || isMutating) return;

    setIsMutating(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/pipeline/stages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      setNewStageName("");
      await loadCampaign();
    } finally {
      setIsMutating(false);
    }
  }

  function startEditStage(stage: Stage) {
    setEditingStageId(stage.id);
    setEditingStageName(stage.name);
  }

  function cancelEditStage() {
    setEditingStageId(null);
    setEditingStageName("");
  }

  async function handleRenameStage(stageId: string) {
    const name = editingStageName.trim();
    if (!name || isMutating) return;

    setIsMutating(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/pipeline/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      await loadCampaign();
      cancelEditStage();
    } finally {
      setIsMutating(false);
    }
  }

  async function handleMoveStage(stageId: string, direction: "up" | "down") {
    if (isMutating) return;

    setIsMutating(true);
    try {
      await fetch(
        `/api/campaigns/${campaignId}/pipeline/stages/${stageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ direction }),
        },
      );
      await loadCampaign();
    } finally {
      setIsMutating(false);
    }
  }

  async function handleDeleteStage(stageId: string) {
    if (isMutating) return;

    setIsMutating(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/pipeline/stages/${stageId}`, {
        method: "DELETE",
      });
      await loadCampaign();
      setStageToDelete(null);
    } finally {
      setIsMutating(false);
    }
  }

  async function handleSetStageAction(stageId: string, value: string) {
    if (isMutating) return;

    setIsMutating(true);
    try {
      await fetch(
        `/api/campaigns/${campaignId}/pipeline/stages/${stageId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            actionId: value === NO_ACTION ? null : value,
          }),
        },
      );
      await loadCampaign();
    } finally {
      setIsMutating(false);
    }
  }

  async function handleToggleAutoProcessing(
    stageId: string,
    autoProcessing: boolean,
  ) {
    if (isMutating) return;

    setIsMutating(true);
    try {
      await fetch(`/api/campaigns/${campaignId}/pipeline/stages/${stageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoProcessing }),
      });
      await loadCampaign();
    } finally {
      setIsMutating(false);
    }
  }

  async function handleProcessPipeline(pipelineId: string) {
    if (isProcessing) return;

    setIsProcessing(true);
    setProcessMsg(null);
    try {
      const response = await fetch(`/api/pipelines/${pipelineId}/process`, {
        method: "POST",
      });
      const json = (await response.json().catch(() => null)) as {
        processed?: number;
        advanced?: number;
        failed?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        setProcessMsg(json?.error ?? "Processing failed");
      } else {
        setProcessMsg(
          `Processed ${json?.processed ?? 0} · advanced ${json?.advanced ?? 0} · failed ${json?.failed ?? 0}`,
        );
      }
      await Promise.all([loadCampaign(), loadContacts()]);
    } catch {
      setProcessMsg("Processing failed");
    } finally {
      setIsProcessing(false);
    }
  }

  const actionItems: Record<string, string> = {
    [NO_ACTION]: "No action",
    ...Object.fromEntries(
      actions.map((action) => [
        action.id,
        `${action.method} · ${action.name}`,
      ]),
    ),
  };

  const totalEmailVerified = useMemo(() => {
    if (!data) return 0;
    return data.aggregates.byEmailStatus
      .filter((item) => item.key === "VALID" || item.key === "RISKY")
      .reduce((sum, item) => sum + item.count, 0);
  }, [data]);

  if (isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">Loading campaign...</div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to campaigns
        </Link>
        <div className="text-sm text-destructive">{error}</div>
      </div>
    );
  }

  const { campaign, aggregates } = data;
  const stages = campaign.pipeline?.stages ?? [];

  function handleStageFilterChange(value: string) {
    setStageFilter(value);
    setContactsPage(1);
  }

  async function handleBulkMoveByTag() {
    if (!bulkTagId || !bulkStageId || isBulkMoving) return;

    setIsBulkMoving(true);
    setBulkMsg(null);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/contacts/move-by-tag`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tagId: bulkTagId, stageId: bulkStageId }),
        },
      );
      const json = (await response.json().catch(() => null)) as {
        matched?: number;
        moved?: number;
        created?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        setBulkMsg(json?.error ?? "Bulk move failed");
      } else if ((json?.matched ?? 0) === 0) {
        setBulkMsg("No contacts have that tag in this campaign.");
      } else {
        setBulkMsg(`Moved ${json?.moved ?? 0} contact(s) to the stage.`);
        await Promise.all([loadCampaign(), loadContacts()]);
      }
    } catch {
      setBulkMsg("Bulk move failed");
    } finally {
      setIsBulkMoving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/campaigns"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Back to campaigns
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            {campaign.name}
          </h1>
          {campaign.recallsyncCampaignId ? (
            <Badge variant="secondary">RecallSync linked</Badge>
          ) : (
            <Badge variant="outline">Not mapped</Badge>
          )}
        </div>
        {campaign.description ? (
          <p className="max-w-3xl text-sm text-muted-foreground">
            {campaign.description}
          </p>
        ) : null}
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card size="sm">
              <CardHeader>
                <CardDescription>Total contacts</CardDescription>
                <CardTitle className="text-2xl">
                  {campaign.contactCount}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>Valid / risky email</CardDescription>
                <CardTitle className="text-2xl">{totalEmailVerified}</CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>RecallSync campaign</CardDescription>
                <CardTitle className="truncate text-sm font-mono">
                  {campaign.recallsyncCampaignId ?? "Not mapped"}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardDescription>Created</CardDescription>
                <CardTitle className="text-sm">
                  {formatDate(campaign.createdAt)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Contacts by quality</CardTitle>
                <CardDescription>
                  Enrichment fit grade across this campaign.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DistributionChart data={aggregates.byQuality} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Contacts by email status</CardTitle>
                <CardDescription>
                  Verification state before RecallSync sync.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DistributionChart data={aggregates.byEmailStatus} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contacts" className="pt-4">
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="space-y-3 lg:w-3/5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Stage</span>
                  <Select
                    value={stageFilter}
                    onValueChange={(value) =>
                      handleStageFilterChange(value as string)
                    }
                    disabled={stages.length === 0}
                  >
                    <SelectTrigger size="sm" className="w-48">
                      <SelectValue placeholder="All stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL_STAGES}>All stages</SelectItem>
                      {stages.map((stage) => (
                        <SelectItem key={stage.id} value={stage.id}>
                          {stage.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <span className="text-xs text-muted-foreground">
                  {contactsData
                    ? `${contactsData.total} contact${
                        contactsData.total === 1 ? "" : "s"
                      }`
                    : null}
                </span>
              </div>

              {tags.length > 0 && stages.length > 0 ? (
                <div className="space-y-2 rounded-xl border border-dashed bg-card/50 p-3">
                  <div className="text-xs font-medium text-muted-foreground">
                    Bulk move by tag
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Move all tagged
                    </span>
                    <Select
                      value={bulkTagId}
                      onValueChange={(value) => setBulkTagId(value as string)}
                      disabled={isBulkMoving}
                    >
                      <SelectTrigger size="sm" className="w-44">
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
                    <span className="text-xs text-muted-foreground">to</span>
                    <Select
                      value={bulkStageId}
                      onValueChange={(value) => setBulkStageId(value as string)}
                      disabled={isBulkMoving}
                    >
                      <SelectTrigger size="sm" className="w-44">
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
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleBulkMoveByTag()}
                      disabled={isBulkMoving || !bulkTagId || !bulkStageId}
                    >
                      {isBulkMoving ? "Moving..." : "Move"}
                    </Button>
                    {bulkMsg ? (
                      <span className="text-xs text-muted-foreground">
                        {bulkMsg}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="rounded-xl border bg-card">
                {contactsLoading && !contactsData ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    Loading contacts...
                  </div>
                ) : !contactsData || contactsData.contacts.length === 0 ? (
                  <div className="p-6 text-sm text-muted-foreground">
                    {stageFilter === ALL_STAGES
                      ? "No contacts in this campaign yet."
                      : "No contacts in this stage."}
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Stage</TableHead>
                        <TableHead>Quality</TableHead>
                        <TableHead>Email status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contactsData.contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          <TableCell className="font-medium">
                            <Link
                              href={`/contacts/${contact.id}`}
                              className="hover:underline"
                            >
                              {contact.name}
                            </Link>
                          </TableCell>
                          <TableCell>
                            {contact.stage ? (
                              <span className="flex items-center gap-1.5">
                                <Badge variant="secondary">
                                  {contact.stage.name}
                                </Badge>
                                {contact.stageStatus &&
                                contact.stageStatus !== "PENDING" ? (
                                  <span className="text-xs text-muted-foreground">
                                    {formatLabel(contact.stageStatus)}
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge>{formatLabel(contact.quality)}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {formatLabel(contact.emailStatus)}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              {contactsData && contactsData.totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">
                    Page {contactsData.page} of {contactsData.totalPages}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      aria-label="Previous page"
                      disabled={contactsLoading || contactsData.page <= 1}
                      onClick={() =>
                        setContactsPage((page) => Math.max(1, page - 1))
                      }
                    >
                      <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      aria-label="Next page"
                      disabled={contactsLoading || !contactsData.hasNextPage}
                      onClick={() => setContactsPage((page) => page + 1)}
                    >
                      <ChevronRight className="size-4" />
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
            <div className="lg:w-2/5">
              <div className="flex h-full min-h-[300px] items-center justify-center rounded-xl border border-dashed bg-card/50 p-6 text-sm text-muted-foreground">
                Select a contact to see details (coming soon).
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4 pt-4">
          {!campaign.pipeline ? (
            <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
              No pipeline for this campaign yet.
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-medium">
                    {campaign.pipeline.name}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Stages run their action for PENDING contacts when
                    auto-process is on. Success moves the contact to the next
                    stage.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {processMsg ? (
                    <span className="text-xs text-muted-foreground">
                      {processMsg}
                    </span>
                  ) : null}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void handleProcessPipeline(campaign.pipeline!.id)
                    }
                    disabled={isProcessing || isMutating}
                  >
                    <Play className="size-4" />
                    {isProcessing ? "Processing..." : "Process pipeline"}
                  </Button>
                  <Input
                    value={newStageName}
                    onChange={(event) => setNewStageName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleAddStage();
                      }
                    }}
                    placeholder="New stage name"
                    className="h-8 w-48"
                    disabled={isMutating}
                  />
                  <Button
                    size="sm"
                    onClick={() => void handleAddStage()}
                    disabled={isMutating || !newStageName.trim()}
                  >
                    <Plus className="size-4" />
                    Add stage
                  </Button>
                </div>
              </div>

              <div className="flex gap-4 overflow-x-auto pb-2">
                {campaign.pipeline.stages.map((stage, index) => (
                  <div
                    key={stage.id}
                    className="flex w-64 shrink-0 flex-col rounded-xl border bg-card"
                  >
                    <div className="flex items-start justify-between gap-2 border-b p-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="text-xs text-muted-foreground">
                          Stage {index + 1}
                        </div>
                        {editingStageId === stage.id ? (
                          <div className="flex items-center gap-1">
                            <Input
                              value={editingStageName}
                              onChange={(event) =>
                                setEditingStageName(event.target.value)
                              }
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  void handleRenameStage(stage.id);
                                } else if (event.key === "Escape") {
                                  cancelEditStage();
                                }
                              }}
                              autoFocus
                              className="h-7"
                              disabled={isMutating}
                            />
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-7 shrink-0"
                              aria-label="Save stage name"
                              disabled={isMutating || !editingStageName.trim()}
                              onClick={() => void handleRenameStage(stage.id)}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7 shrink-0"
                              aria-label="Cancel rename"
                              disabled={isMutating}
                              onClick={cancelEditStage}
                            >
                              <X className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="group flex items-center gap-1.5 text-left font-medium"
                            onClick={() => startEditStage(stage)}
                            disabled={isMutating}
                            aria-label="Rename stage"
                          >
                            <span>{stage.name}</span>
                            <Pencil className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                          </button>
                        )}
                      </div>
                      {editingStageId !== stage.id && (
                        <Badge variant="secondary">
                          {stage._count.contacts}
                        </Badge>
                      )}
                    </div>
                    <div className="space-y-1.5 border-b p-3">
                      <div className="text-xs text-muted-foreground">Action</div>
                      <Select
                        items={actionItems}
                        value={stage.actionId ?? NO_ACTION}
                        onValueChange={(value) =>
                          void handleSetStageAction(stage.id, value as string)
                        }
                        disabled={isMutating}
                      >
                        <SelectTrigger size="sm" className="w-full">
                          <SelectValue placeholder="No action" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NO_ACTION}>No action</SelectItem>
                          {actions.map((action) => (
                            <SelectItem key={action.id} value={action.id}>
                              {action.method} · {action.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-xs text-muted-foreground">
                          Auto-process
                        </span>
                        <Switch
                          size="sm"
                          checked={stage.autoProcessing}
                          onCheckedChange={(checked) =>
                            void handleToggleAutoProcessing(
                              stage.id,
                              checked === true,
                            )
                          }
                          disabled={isMutating || !stage.actionId}
                        />
                      </label>
                    </div>
                    <div className="flex items-center justify-between gap-2 p-3">
                      <span className="text-xs text-muted-foreground">
                        {stage._count.contacts === 0
                          ? "No contacts yet"
                          : `${stage._count.contacts} contact${
                              stage._count.contacts === 1 ? "" : "s"
                            }`}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label="Move stage left"
                          disabled={isMutating || index === 0}
                          onClick={() => void handleMoveStage(stage.id, "up")}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7"
                          aria-label="Move stage right"
                          disabled={
                            isMutating ||
                            index === campaign.pipeline!.stages.length - 1
                          }
                          onClick={() => void handleMoveStage(stage.id, "down")}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-7 text-destructive hover:text-destructive"
                          aria-label="Delete stage"
                          disabled={isMutating}
                          onClick={() => setStageToDelete(stage)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog
        open={stageToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isMutating) setStageToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stage?</AlertDialogTitle>
            <AlertDialogDescription>
              {stageToDelete
                ? `This removes the "${stageToDelete.name}" stage${
                    stageToDelete._count.contacts > 0
                      ? ` and its ${stageToDelete._count.contacts} contact placement${
                          stageToDelete._count.contacts === 1 ? "" : "s"
                        }`
                      : ""
                  }. This can't be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isMutating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isMutating}
              onClick={() => {
                if (stageToDelete) void handleDeleteStage(stageToDelete.id);
              }}
            >
              {isMutating ? "Deleting..." : "Delete stage"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
