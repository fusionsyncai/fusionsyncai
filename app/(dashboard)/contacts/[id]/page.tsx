"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Pencil,
  Phone,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STAGE_STATUSES = ["PENDING", "PROCESSING", "FAILED", "WAITING"] as const;

type Tag = { id: string; name: string; color: string | null; assignedAt: string };
type CampaignRef = { id: string; name: string; addedAt: string };
type PipelineStage = { id: string; name: string; order: number };
type PipelineMembership = {
  pipelineId: string;
  pipelineName: string;
  campaignId: string | null;
  campaignName: string | null;
  currentStageId: string;
  currentStageName: string;
  currentStageOrder: number;
  stageStatus: string;
  addedToStageAt: string;
  stages: PipelineStage[];
};

type ContactDetail = {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  emailStatus: string;
  phone: string | null;
  linkedinUrl: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  youtubeUrl: string | null;
  twitterUrl: string | null;
  companyName: string | null;
  companyWebsite: string | null;
  companyDomain: string | null;
  companyEmployeeCount: number | null;
  companyIndustry: string | null;
  companyLocation: string | null;
  companyLinkedinUrl: string | null;
  quality: string;
  score: number | null;
  enrichmentStatus: string;
  enrichedAt: string | null;
  source: string | null;
  sourceUrl: string | null;
  customData: Record<string, unknown> | null;
  recallsyncLeadId: string | null;
  syncedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: Tag[];
  campaigns: CampaignRef[];
  pipelines: PipelineMembership[];
};

function formatDate(value: string | null) {
  if (!value) return "-";
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

function emailStatusVariant(status: string) {
  switch (status) {
    case "VALID":
      return "default" as const;
    case "INVALID":
      return "destructive" as const;
    default:
      return "outline" as const;
  }
}

function enrichmentVariant(status: string) {
  switch (status) {
    case "ENRICHED":
      return "default" as const;
    case "FAILED":
      return "destructive" as const;
    case "RUNNING":
      return "secondary" as const;
    default:
      return "outline" as const;
  }
}

// Pull the highlight fields the email templates read out of customData.
function getHighlights(customData: Record<string, unknown> | null) {
  if (!customData) return [] as { key: string; value: string }[];
  const keys = ["personalizedHighlight", "personalizationHighlight"];
  const out: { key: string; value: string }[] = [];
  for (const key of keys) {
    const value = customData[key];
    if (typeof value === "string" && value.trim()) {
      out.push({ key, value });
    }
  }
  return out;
}

type EnrichmentBlock = {
  firmographics?: Record<string, unknown>;
  signals?: { type?: string; summary?: string; sourceUrl?: string | null }[];
  provenance?: { confidence?: number; ranAt?: string; sources?: { url?: string; title?: string | null }[] };
};

function getEnrichmentBlock(
  customData: Record<string, unknown> | null,
): EnrichmentBlock | null {
  if (!customData) return null;
  const block = customData.enrichment;
  if (!block || typeof block !== "object" || Array.isArray(block)) return null;
  return block as EnrichmentBlock;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="text-sm">{value ?? "-"}</div>
    </div>
  );
}

function StageTrack({ membership }: { membership: PipelineMembership }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {membership.stages.map((stage, index) => {
        const isCurrent = stage.id === membership.currentStageId;
        const isPast = stage.order < membership.currentStageOrder;
        return (
          <div key={stage.id} className="flex items-center gap-1.5">
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                isCurrent
                  ? "bg-primary text-primary-foreground"
                  : isPast
                    ? "bg-muted text-muted-foreground"
                    : "border border-border text-muted-foreground",
              ].join(" ")}
            >
              {isPast ? <CheckCircle2 className="size-3" /> : null}
              {stage.name}
            </span>
            {index < membership.stages.length - 1 ? (
              <span className="text-muted-foreground">/</span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [contact, setContact] = useState<ContactDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/contacts/${id}`, { cache: "no-store" });
      if (response.status === 404) {
        throw new Error("Contact not found");
      }
      if (!response.ok) {
        throw new Error("Failed to load contact");
      }
      const data = (await response.json()) as { contact: ContactDetail };
      setError(null);
      setContact(data.contact);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const [savingPipelineId, setSavingPipelineId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState(false);
  const [savingContact, setSavingContact] = useState(false);
  const [contactSaveError, setContactSaveError] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState({
    name: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    title: "",
    linkedinUrl: "",
    facebookUrl: "",
    instagramUrl: "",
    youtubeUrl: "",
    twitterUrl: "",
  });

  function startContactEdit() {
    if (!contact) return;
    setContactForm({
      name: contact.name ?? "",
      firstName: contact.firstName ?? "",
      lastName: contact.lastName ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      title: contact.title ?? "",
      linkedinUrl: contact.linkedinUrl ?? "",
      facebookUrl: contact.facebookUrl ?? "",
      instagramUrl: contact.instagramUrl ?? "",
      youtubeUrl: contact.youtubeUrl ?? "",
      twitterUrl: contact.twitterUrl ?? "",
    });
    setEditingContact(true);
    setContactSaveError(null);
  }

  function cancelContactEdit() {
    setEditingContact(false);
    setContactSaveError(null);
  }

  async function saveContactEdit() {
    setSavingContact(true);
    setContactSaveError(null);
    try {
      const payload: Record<string, string | null> = {
        name: contactForm.name.trim(),
        firstName: contactForm.firstName.trim() || null,
        lastName: contactForm.lastName.trim() || null,
        email: contactForm.email.trim() || null,
        phone: contactForm.phone.trim() || null,
        title: contactForm.title.trim() || null,
        linkedinUrl: contactForm.linkedinUrl.trim() || null,
        facebookUrl: contactForm.facebookUrl.trim() || null,
        instagramUrl: contactForm.instagramUrl.trim() || null,
        youtubeUrl: contactForm.youtubeUrl.trim() || null,
        twitterUrl: contactForm.twitterUrl.trim() || null,
      };

      const response = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to update contact");
      }
      setEditingContact(false);
      await refresh();
    } catch (err) {
      setContactSaveError(
        err instanceof Error ? err.message : "Failed to update contact",
      );
    } finally {
      setSavingContact(false);
    }
  }

  async function updatePlacement(
    pipelineId: string,
    patch: { stageId?: string; stageStatus?: string },
  ) {
    setSavingPipelineId(pipelineId);
    setError(null);
    try {
      const response = await fetch(`/api/contacts/${id}/pipeline`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId, ...patch }),
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to update placement");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update placement");
    } finally {
      setSavingPipelineId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading contact...
      </div>
    );
  }

  if (error || !contact) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" render={<Link href="/contacts" />}>
          <ArrowLeft className="mr-1.5 size-4" />
          Back to contacts
        </Button>
        <div className="rounded-xl border bg-card p-6 text-sm text-destructive">
          {error ?? "Contact not found"}
        </div>
      </div>
    );
  }

  const highlights = getHighlights(contact.customData);
  const enrichment = getEnrichmentBlock(contact.customData);

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" render={<Link href="/contacts" />}>
          <ArrowLeft className="mr-1.5 size-4" />
          Back to contacts
        </Button>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{contact.name}</h1>
          <p className="text-sm text-muted-foreground">
            {contact.title ? `${contact.title} · ` : ""}
            {contact.companyName ?? "No company"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={emailStatusVariant(contact.emailStatus)}>
            Email: {formatLabel(contact.emailStatus)}
          </Badge>
          <Badge variant={enrichmentVariant(contact.enrichmentStatus)}>
            Enrichment: {formatLabel(contact.enrichmentStatus)}
          </Badge>
          <Badge>{formatLabel(contact.quality)}</Badge>
          {contact.score !== null ? (
            <Badge variant="outline">Score {contact.score}</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Contact details */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b">
              <CardTitle>Contact</CardTitle>
              {!editingContact ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={startContactEdit}
                >
                  <Pencil className="mr-1.5 size-3.5" />
                  Edit
                </Button>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={cancelContactEdit}
                    disabled={savingContact}
                  >
                    <X className="mr-1.5 size-3.5" />
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void saveContactEdit()}
                    disabled={savingContact || !contactForm.name.trim()}
                  >
                    {savingContact ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : null}
                    Save
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
              {contactSaveError ? (
                <p className="text-sm text-destructive sm:col-span-2">
                  {contactSaveError}
                </p>
              ) : null}
              {editingContact ? (
                <>
                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Display name
                    </label>
                    <Input
                      value={contactForm.name}
                      onChange={(e) =>
                        setContactForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="Contact or company name"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) =>
                        setContactForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="name@company.com"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Phone
                    </label>
                    <Input
                      type="tel"
                      value={contactForm.phone}
                      onChange={(e) =>
                        setContactForm((f) => ({ ...f, phone: e.target.value }))
                      }
                      placeholder="+44 ..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      First name
                    </label>
                    <Input
                      value={contactForm.firstName}
                      onChange={(e) =>
                        setContactForm((f) => ({
                          ...f,
                          firstName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Last name
                    </label>
                    <Input
                      value={contactForm.lastName}
                      onChange={(e) =>
                        setContactForm((f) => ({
                          ...f,
                          lastName: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Title
                    </label>
                    <Input
                      value={contactForm.title}
                      onChange={(e) =>
                        setContactForm((f) => ({ ...f, title: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      LinkedIn URL
                    </label>
                    <Input
                      value={contactForm.linkedinUrl}
                      onChange={(e) =>
                        setContactForm((f) => ({
                          ...f,
                          linkedinUrl: e.target.value,
                        }))
                      }
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Facebook URL
                    </label>
                    <Input
                      value={contactForm.facebookUrl}
                      onChange={(e) =>
                        setContactForm((f) => ({
                          ...f,
                          facebookUrl: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Instagram URL
                    </label>
                    <Input
                      value={contactForm.instagramUrl}
                      onChange={(e) =>
                        setContactForm((f) => ({
                          ...f,
                          instagramUrl: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      YouTube URL
                    </label>
                    <Input
                      value={contactForm.youtubeUrl}
                      onChange={(e) =>
                        setContactForm((f) => ({
                          ...f,
                          youtubeUrl: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Twitter / X URL
                    </label>
                    <Input
                      value={contactForm.twitterUrl}
                      onChange={(e) =>
                        setContactForm((f) => ({
                          ...f,
                          twitterUrl: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              ) : (
                <>
              <Field
                label="Email"
                value={
                  contact.email ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Mail className="size-3.5 text-muted-foreground" />
                      {contact.email}
                    </span>
                  ) : null
                }
              />
              <Field
                label="Phone"
                value={
                  contact.phone ? (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone className="size-3.5 text-muted-foreground" />
                      {contact.phone}
                    </span>
                  ) : null
                }
              />
              <Field label="First name" value={contact.firstName} />
              <Field label="Last name" value={contact.lastName} />
              <Field
                label="LinkedIn"
                value={
                  contact.linkedinUrl ? (
                    <a
                      href={contact.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Profile <ExternalLink className="size-3" />
                    </a>
                  ) : null
                }
              />
              <Field label="Title" value={contact.title} />
              <Field
                label="Facebook"
                value={
                  contact.facebookUrl ? (
                    <a
                      href={contact.facebookUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Profile <ExternalLink className="size-3" />
                    </a>
                  ) : null
                }
              />
              <Field
                label="Instagram"
                value={
                  contact.instagramUrl ? (
                    <a
                      href={contact.instagramUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Profile <ExternalLink className="size-3" />
                    </a>
                  ) : null
                }
              />
              <Field
                label="YouTube"
                value={
                  contact.youtubeUrl ? (
                    <a
                      href={contact.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Channel <ExternalLink className="size-3" />
                    </a>
                  ) : null
                }
              />
              <Field
                label="Twitter / X"
                value={
                  contact.twitterUrl ? (
                    <a
                      href={contact.twitterUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Profile <ExternalLink className="size-3" />
                    </a>
                  ) : null
                }
              />
                </>
              )}
            </CardContent>
          </Card>

          {/* Company */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="inline-flex items-center gap-1.5">
                <Building2 className="size-4" />
                Company
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
              <Field label="Name" value={contact.companyName} />
              <Field
                label="Website"
                value={
                  contact.companyWebsite ? (
                    <a
                      href={contact.companyWebsite}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      {contact.companyDomain ?? contact.companyWebsite}
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null
                }
              />
              <Field label="Industry" value={contact.companyIndustry} />
              <Field
                label="Employees"
                value={contact.companyEmployeeCount ?? null}
              />
              <Field label="Location" value={contact.companyLocation} />
              <Field
                label="Company LinkedIn"
                value={
                  contact.companyLinkedinUrl ? (
                    <a
                      href={contact.companyLinkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      Profile <ExternalLink className="size-3" />
                    </a>
                  ) : null
                }
              />
            </CardContent>
          </Card>

          {/* Highlights */}
          {highlights.length > 0 ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Personalization</CardTitle>
                <CardDescription>
                  Custom enrichment fields used by outreach templates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {highlights.map((h) => (
                  <div key={h.key} className="space-y-1">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {h.key}
                    </div>
                    <p className="text-sm">{h.value}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}

          {/* Enrichment signals */}
          {enrichment?.signals && enrichment.signals.length > 0 ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Signals</CardTitle>
                <CardDescription>
                  Research signals found during enrichment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                {enrichment.signals.map((signal, index) => (
                  <div
                    key={index}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                  >
                    <div className="space-y-1">
                      {signal.type ? (
                        <Badge variant="outline">{formatLabel(signal.type)}</Badge>
                      ) : null}
                      <p className="text-sm">{signal.summary}</p>
                    </div>
                    {signal.sourceUrl ? (
                      <a
                        href={signal.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Sidebar: pipelines, campaigns, meta */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Pipelines</CardTitle>
              <CardDescription>Current stage in each pipeline.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {contact.pipelines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Not in any pipeline.
                </p>
              ) : (
                contact.pipelines.map((membership) => (
                  <div key={membership.pipelineId} className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {membership.pipelineName}
                      </span>
                      <Badge variant="outline">
                        {formatLabel(membership.stageStatus)}
                      </Badge>
                    </div>
                    <StageTrack membership={membership} />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Stage
                        </label>
                        <Select
                          value={membership.currentStageId}
                          onValueChange={(v) =>
                            v &&
                            void updatePlacement(membership.pipelineId, {
                              stageId: v,
                            })
                          }
                          disabled={savingPipelineId === membership.pipelineId}
                        >
                          <SelectTrigger className="w-full" size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {membership.stages.map((stage) => (
                              <SelectItem key={stage.id} value={stage.id}>
                                {stage.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">
                          Status
                        </label>
                        <Select
                          value={membership.stageStatus}
                          onValueChange={(v) =>
                            v &&
                            void updatePlacement(membership.pipelineId, {
                              stageStatus: v,
                            })
                          }
                          disabled={savingPipelineId === membership.pipelineId}
                        >
                          <SelectTrigger className="w-full" size="sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STAGE_STATUSES.map((status) => (
                              <SelectItem key={status} value={status}>
                                {formatLabel(status)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      In stage since {formatDate(membership.addedToStageAt)}
                      {savingPipelineId === membership.pipelineId
                        ? " · saving…"
                        : ""}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Campaigns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4">
              {contact.campaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No campaigns.</p>
              ) : (
                contact.campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="text-sm">{campaign.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(campaign.addedAt)}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {contact.tags.length > 0 ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Tags</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2 pt-4">
                {contact.tags.map((tag) => (
                  <Badge key={tag.id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="border-b">
              <CardTitle>Meta</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4">
              <Field label="Source" value={contact.source} />
              <Field
                label="Source URL"
                value={
                  contact.sourceUrl ? (
                    <a
                      href={contact.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 break-all text-primary hover:underline"
                    >
                      {contact.sourceUrl}
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : null
                }
              />
              <Field
                label="RecallSync lead"
                value={contact.recallsyncLeadId ?? "Not synced"}
              />
              <Field label="Enriched at" value={formatDate(contact.enrichedAt)} />
              <Field label="Synced at" value={formatDate(contact.syncedAt)} />
              <Field label="Created" value={formatDate(contact.createdAt)} />
              <Field label="Updated" value={formatDate(contact.updatedAt)} />
              {enrichment?.provenance?.confidence !== undefined ? (
                <Field
                  label="Enrichment confidence"
                  value={`${Math.round((enrichment.provenance.confidence ?? 0) * 100)}%`}
                />
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
