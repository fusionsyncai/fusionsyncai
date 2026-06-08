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
  Phone,
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
      setError(null);
      const response = await fetch(`/api/contacts/${id}`, { cache: "no-store" });
      if (response.status === 404) {
        throw new Error("Contact not found");
      }
      if (!response.ok) {
        throw new Error("Failed to load contact");
      }
      const data = (await response.json()) as { contact: ContactDetail };
      setContact(data.contact);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

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
            <CardHeader className="border-b">
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
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
                  <div key={membership.pipelineId} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {membership.pipelineName}
                      </span>
                      <Badge variant="outline">
                        {formatLabel(membership.stageStatus)}
                      </Badge>
                    </div>
                    <StageTrack membership={membership} />
                    <p className="text-xs text-muted-foreground">
                      In stage since {formatDate(membership.addedToStageAt)}
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
