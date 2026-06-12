"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Loader2,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { type TagOption } from "@/components/tags/tag-picker";
import {
  CONTACT_COLUMNS,
  DEFAULT_CONTACT_COLUMNS,
  type ContactColumnKey,
} from "@/lib/campaign-columns";

type ContactStage = {
  id: string;
  name: string;
  order: number;
};

type Contact = {
  id: string;
  name: string;
  email: string | null;
  companyName: string | null;
  companyShortName: string | null;
  quality: string;
  emailStatus: string;
  personalizedHighlight: string | null;
  mailbox: string | null;
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
    mailboxes: string[];
    contactColumns: ContactColumnKey[];
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

  // Manual per-contact processing: run a single contact's current stage action
  // on demand (e.g. test the Sync action for one contact without arming the
  // stage's auto-process). Keyed by contactId so only that row shows a spinner.
  const [processingContactId, setProcessingContactId] = useState<string | null>(
    null,
  );
  const [contactProcessMsg, setContactProcessMsg] = useState<string | null>(
    null,
  );

  // Per-campaign sending mailboxes (assigned to leads on campaign add).
  const [newMailbox, setNewMailbox] = useState("");
  const [isSavingMailboxes, setIsSavingMailboxes] = useState(false);
  const [mailboxMsg, setMailboxMsg] = useState<string | null>(null);

  // Settings tab: editable campaign description. Seeded from the loaded campaign
  // once (keyed by id) so background reloads don't clobber an in-progress edit.
  const [descDraft, setDescDraft] = useState("");
  const [isSavingDesc, setIsSavingDesc] = useState(false);
  const [descMsg, setDescMsg] = useState<string | null>(null);
  const seededDescForId = useRef<string | null>(null);

  // Per-campaign configurable contact-table columns.
  const [isSavingColumns, setIsSavingColumns] = useState(false);

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

  const saveMailboxes = useCallback(
    async (mailboxes: string[]) => {
      setIsSavingMailboxes(true);
      setMailboxMsg(null);
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mailboxes }),
        });
        if (!response.ok) throw new Error("Failed to save mailboxes");
        const json = (await response.json()) as {
          campaign: { mailboxes: string[] };
        };
        setData((prev) =>
          prev
            ? {
                ...prev,
                campaign: {
                  ...prev.campaign,
                  mailboxes: json.campaign.mailboxes,
                },
              }
            : prev,
        );
        setNewMailbox("");
      } catch (error) {
        setMailboxMsg(
          error instanceof Error ? error.message : "Failed to save mailboxes",
        );
      } finally {
        setIsSavingMailboxes(false);
      }
    },
    [campaignId],
  );

  useEffect(() => {
    if (data && seededDescForId.current !== data.campaign.id) {
      setDescDraft(data.campaign.description ?? "");
      seededDescForId.current = data.campaign.id;
    }
  }, [data]);

  const saveDescription = useCallback(async () => {
    setIsSavingDesc(true);
    setDescMsg(null);
    try {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: descDraft.trim() || null }),
      });
      if (!response.ok) throw new Error("Failed to save description");
      const json = (await response.json()) as {
        campaign: { description: string | null };
      };
      setData((prev) =>
        prev
          ? {
              ...prev,
              campaign: {
                ...prev.campaign,
                description: json.campaign.description,
              },
            }
          : prev,
      );
      setDescMsg("Saved");
    } catch (error) {
      setDescMsg(
        error instanceof Error ? error.message : "Failed to save description",
      );
    } finally {
      setIsSavingDesc(false);
    }
  }, [campaignId, descDraft]);

  const saveColumns = useCallback(
    async (contactColumns: ContactColumnKey[]) => {
      setIsSavingColumns(true);
      try {
        const response = await fetch(`/api/campaigns/${campaignId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactColumns }),
        });
        if (!response.ok) throw new Error("Failed to save columns");
        const json = (await response.json()) as {
          campaign: { contactColumns: ContactColumnKey[] };
        };
        setData((prev) =>
          prev
            ? {
                ...prev,
                campaign: {
                  ...prev.campaign,
                  contactColumns: json.campaign.contactColumns,
                },
              }
            : prev,
        );
      } finally {
        setIsSavingColumns(false);
      }
    },
    [campaignId],
  );

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

  // Effective columns: the campaign's saved selection, or a sensible default.
  const activeColumns: ContactColumnKey[] =
    campaign.contactColumns.length > 0
      ? campaign.contactColumns
      : DEFAULT_CONTACT_COLUMNS;

  function toggleColumn(key: ContactColumnKey) {
    const selected = new Set<ContactColumnKey>(activeColumns);
    if (selected.has(key)) {
      selected.delete(key);
    } else {
      selected.add(key);
    }
    // Persist in catalog order so columns always render in a stable sequence.
    const next = CONTACT_COLUMNS.map((column) => column.key).filter((columnKey) =>
      selected.has(columnKey),
    );
    void saveColumns(next);
  }

  function columnHeadClass(key: ContactColumnKey): string | undefined {
    if (key === "action") return "w-10";
    if (key === "name") return "w-56";
    if (key === "personalizedHighlight") return "w-104 max-w-104";
    return undefined;
  }

  function renderContactCell(key: ContactColumnKey, contact: Contact) {
    switch (key) {
      case "action":
        return (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Process ${contact.name}`}
            title="Run this contact's current stage action"
            disabled={processingContactId !== null || !contact.stage}
            onClick={() => void handleProcessContact(contact.id)}
          >
            {processingContactId === contact.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
          </Button>
        );
      case "name":
        return (
          <Link
            href={`/contacts/${contact.id}`}
            className="block max-w-56 truncate font-medium hover:underline"
            title={contact.name}
          >
            {contact.name}
          </Link>
        );
      case "companyName":
        return contact.companyName ? (
          <span className="block max-w-48 truncate" title={contact.companyName}>
            {contact.companyName}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      case "companyShortName":
        return contact.companyShortName ? (
          <span>{contact.companyShortName}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      case "personalizedHighlight":
        return contact.personalizedHighlight ? (
          <span
            className="block w-104 max-w-104 truncate text-sm text-muted-foreground"
            title={contact.personalizedHighlight}
          >
            {contact.personalizedHighlight}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      case "mailbox":
        return contact.mailbox ? (
          <span className="font-mono text-xs">{contact.mailbox}</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      case "email":
        return contact.email ? (
          <span className="block max-w-56 truncate" title={contact.email}>
            {contact.email}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      case "stage":
        return contact.stage ? (
          <Badge variant="secondary">{contact.stage.name}</Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      case "status":
        return contact.stageStatus ? (
          <span className="text-xs text-muted-foreground">
            {formatLabel(contact.stageStatus)}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      case "quality":
        return <Badge>{formatLabel(contact.quality)}</Badge>;
      case "emailStatus":
        return (
          <Badge variant="outline">{formatLabel(contact.emailStatus)}</Badge>
        );
      default:
        return null;
    }
  }

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

  async function handleProcessContact(contactId: string) {
    if (processingContactId) return;

    setProcessingContactId(contactId);
    setContactProcessMsg(null);
    try {
      const response = await fetch(
        `/api/campaigns/${campaignId}/contacts/${contactId}/process`,
        { method: "POST" },
      );
      const json = (await response.json().catch(() => null)) as {
        ok?: boolean;
        error?: string;
        stageName?: string;
        statusCode?: number;
        advanced?: boolean;
      } | null;

      if (!response.ok || !json) {
        setContactProcessMsg(json?.error ?? "Processing failed");
      } else if (json.ok) {
        const where = json.stageName ? ` (${json.stageName})` : "";
        setContactProcessMsg(
          json.advanced
            ? `Success${where} · advanced to next stage`
            : `Success${where}`,
        );
      } else {
        setContactProcessMsg(json.error ?? "Action did not succeed");
      }

      await Promise.all([loadCampaign(), loadContacts()]);
    } catch {
      setContactProcessMsg("Processing failed");
    } finally {
      setProcessingContactId(null);
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
          <TabsTrigger value="settings">Settings</TabsTrigger>
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
                <div className="flex items-center gap-3">
                  {contactProcessMsg ? (
                    <span className="text-xs text-muted-foreground">
                      {contactProcessMsg}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {contactsData
                      ? `${contactsData.total} contact${
                          contactsData.total === 1 ? "" : "s"
                        }`
                      : null}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="outline" size="sm" disabled={isSavingColumns}>
                          {isSavingColumns ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Columns3 className="size-4" />
                          )}
                          Columns
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuGroup>
                        <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {CONTACT_COLUMNS.map((column) => {
                          const checked = activeColumns.includes(column.key);
                          return (
                            <DropdownMenuCheckboxItem
                              key={column.key}
                              checked={checked}
                              closeOnClick={false}
                              // Keep at least one column visible.
                              disabled={checked && activeColumns.length === 1}
                              onCheckedChange={() => toggleColumn(column.key)}
                            >
                              {column.label}
                            </DropdownMenuCheckboxItem>
                          );
                        })}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
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
                        {activeColumns.map((key) => {
                          const meta = CONTACT_COLUMNS.find(
                            (column) => column.key === key,
                          );
                          return (
                            <TableHead
                              key={key}
                              className={columnHeadClass(key)}
                            >
                              {key === "action" ? "" : meta?.label}
                            </TableHead>
                          );
                        })}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {contactsData.contacts.map((contact) => (
                        <TableRow key={contact.id}>
                          {activeColumns.map((key) => (
                            <TableCell key={key} className={columnHeadClass(key)}>
                              {renderContactCell(key, contact)}
                            </TableCell>
                          ))}
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

        <TabsContent value="settings" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Campaign details</CardTitle>
              <CardDescription>
                Edit the campaign description. Name and RecallSync mapping are
                managed at import time and shown here for reference.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Name</div>
                  <div className="text-sm font-medium">{campaign.name}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">
                    RecallSync campaign
                  </div>
                  <div className="truncate font-mono text-sm">
                    {campaign.recallsyncCampaignId ?? "Not mapped"}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Created</div>
                  <div className="text-sm">{formatDate(campaign.createdAt)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-muted-foreground">Contacts</div>
                  <div className="text-sm">{campaign.contactCount}</div>
                </div>
              </div>
              <div className="space-y-2">
                <label
                  htmlFor="campaign-description"
                  className="text-xs text-muted-foreground"
                >
                  Description
                </label>
                <textarea
                  id="campaign-description"
                  value={descDraft}
                  disabled={isSavingDesc}
                  rows={4}
                  onChange={(event) => setDescDraft(event.target.value)}
                  placeholder="What this campaign segment is for…"
                  className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30"
                />
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    onClick={() => void saveDescription()}
                    disabled={
                      isSavingDesc ||
                      descDraft.trim() === (campaign.description ?? "").trim()
                    }
                  >
                    {isSavingDesc ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Check className="size-4" />
                    )}
                    Save description
                  </Button>
                  {descMsg ? (
                    <span className="text-xs text-muted-foreground">
                      {descMsg}
                    </span>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sending mailboxes</CardTitle>
              <CardDescription>
                Leads added to this campaign are assigned one of these boxes
                (evenly, and stuck for life) so every email sends from the same
                address. Stored on the contact as{" "}
                <code className="font-mono">customData.mailbox</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {campaign.mailboxes.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {campaign.mailboxes.map((mailbox) => (
                    <Badge
                      key={mailbox}
                      variant="secondary"
                      className="gap-1.5 font-mono"
                    >
                      {mailbox}
                      <button
                        type="button"
                        aria-label={`Remove ${mailbox}`}
                        disabled={isSavingMailboxes}
                        onClick={() =>
                          void saveMailboxes(
                            campaign.mailboxes.filter((m) => m !== mailbox),
                          )
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No mailboxes configured — leads won&apos;t be assigned a
                  sending box.
                </p>
              )}
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  const next = newMailbox.trim().toLowerCase();
                  if (!next || campaign.mailboxes.includes(next)) {
                    setNewMailbox("");
                    return;
                  }
                  void saveMailboxes([...campaign.mailboxes, next]);
                }}
              >
                <Input
                  type="email"
                  placeholder="name@tryfusionsync.com"
                  value={newMailbox}
                  disabled={isSavingMailboxes}
                  onChange={(event) => setNewMailbox(event.target.value)}
                  className="max-w-xs"
                />
                <Button type="submit" disabled={isSavingMailboxes}>
                  {isSavingMailboxes ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Plus className="size-4" />
                  )}
                  Add
                </Button>
              </form>
              {mailboxMsg ? (
                <p className="text-destructive text-sm">{mailboxMsg}</p>
              ) : null}
            </CardContent>
          </Card>
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
