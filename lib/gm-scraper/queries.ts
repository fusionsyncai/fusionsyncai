import { GmScraperStatus, Prisma } from "@/generated/prisma/client";
import { ensurePipelineForCampaign } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";

const queryInclude = {
  tag: { select: { id: true, name: true } },
  campaign: { select: { id: true, name: true } },
  stage: { select: { id: true, name: true, pipelineId: true } },
  _count: { select: { contacts: true } },
} as const;

export function serializeGmScraperQuery(
  row: Prisma.GmScraperQueryGetPayload<{ include: typeof queryInclude }>,
) {
  return {
    id: row.id,
    query: row.query,
    tagId: row.tagId,
    tag: row.tag,
    campaignId: row.campaignId,
    campaign: row.campaign,
    stageId: row.stageId,
    stage: row.stage,
    autoProcess: row.autoProcess,
    maxResults: row.maxResults,
    region: row.region,
    status: row.status,
    resultCount: row.resultCount,
    lastError: row.lastError,
    claimedAt: row.claimedAt?.toISOString() ?? null,
    processedAt: row.processedAt?.toISOString() ?? null,
    contactCount: row._count.contacts,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listGmScraperQueries() {
  const rows = await prisma.gmScraperQuery.findMany({
    orderBy: { createdAt: "desc" },
    include: queryInclude,
  });
  return rows.map(serializeGmScraperQuery);
}

export async function getGmScraperQuery(id: string) {
  const row = await prisma.gmScraperQuery.findUnique({
    where: { id },
    include: queryInclude,
  });
  return row ? serializeGmScraperQuery(row) : null;
}

export type CreateGmScraperQueryInput = {
  query: string;
  tagId: string;
  campaignId?: string | null;
  stageId?: string | null;
  autoProcess?: boolean;
  maxResults?: number;
  region?: string;
};

async function validateStageForCampaign(
  campaignId: string | null | undefined,
  stageId: string | null | undefined,
) {
  if (!stageId) return null;
  if (!campaignId) {
    throw new Error("campaignId is required when stageId is set");
  }

  const pipeline = await ensurePipelineForCampaign(campaignId);
  if (!pipeline) {
    throw new Error("Campaign not found");
  }

  const stage = pipeline.stages.find((s) => s.id === stageId);
  if (!stage) {
    throw new Error("Stage not found for campaign pipeline");
  }

  return { pipelineId: pipeline.id, stageId: stage.id };
}

export async function createGmScraperQuery(input: CreateGmScraperQueryInput) {
  const query = input.query.trim();
  if (!query) throw new Error("query is required");
  if (!input.tagId?.trim()) throw new Error("tagId is required");

  await validateStageForCampaign(input.campaignId, input.stageId);

  const tag = await prisma.tag.findUnique({
    where: { id: input.tagId },
    select: { id: true },
  });
  if (!tag) throw new Error("Tag not found");

  if (input.campaignId) {
    const campaign = await prisma.campaign.findUnique({
      where: { id: input.campaignId },
      select: { id: true },
    });
    if (!campaign) throw new Error("Campaign not found");
  }

  const maxResults = Math.min(
    500,
    Math.max(1, Math.floor(input.maxResults ?? 120)),
  );

  const row = await prisma.gmScraperQuery.create({
    data: {
      query,
      tagId: input.tagId,
      campaignId: input.campaignId ?? null,
      stageId: input.stageId ?? null,
      autoProcess: input.autoProcess === true,
      maxResults,
      region: (input.region?.trim().toUpperCase() || "IN").slice(0, 2),
      status: GmScraperStatus.PENDING,
    },
    include: queryInclude,
  });

  return serializeGmScraperQuery(row);
}

export type UpdateGmScraperQueryInput = {
  query?: string;
  tagId?: string;
  campaignId?: string | null;
  stageId?: string | null;
  autoProcess?: boolean;
  maxResults?: number;
  status?: GmScraperStatus;
};

export async function updateGmScraperQuery(
  id: string,
  input: UpdateGmScraperQueryInput,
) {
  const existing = await prisma.gmScraperQuery.findUnique({ where: { id } });
  if (!existing) return null;

  if (existing.status === GmScraperStatus.PROCESSING) {
    throw new Error("Cannot edit a query while it is processing");
  }

  const campaignId =
    input.campaignId !== undefined ? input.campaignId : existing.campaignId;
  const stageId =
    input.stageId !== undefined ? input.stageId : existing.stageId;

  await validateStageForCampaign(campaignId, stageId);

  const data: Prisma.GmScraperQueryUpdateInput = {};

  if (typeof input.query === "string" && input.query.trim()) {
    data.query = input.query.trim();
  }
  if (input.tagId) {
    const tag = await prisma.tag.findUnique({
      where: { id: input.tagId },
      select: { id: true },
    });
    if (!tag) throw new Error("Tag not found");
    data.tag = { connect: { id: input.tagId } };
  }
  if (input.campaignId !== undefined) {
    data.campaign =
      input.campaignId === null
        ? { disconnect: true }
        : { connect: { id: input.campaignId } };
  }
  if (input.stageId !== undefined) {
    data.stage =
      input.stageId === null
        ? { disconnect: true }
        : { connect: { id: input.stageId } };
  }
  if (input.autoProcess !== undefined) {
    data.autoProcess = input.autoProcess;
  }
  if (input.maxResults !== undefined) {
    data.maxResults = Math.min(
      500,
      Math.max(1, Math.floor(input.maxResults)),
    );
  }
  if (input.status !== undefined) {
    data.status = input.status;
  }

  const row = await prisma.gmScraperQuery.update({
    where: { id },
    data,
    include: queryInclude,
  });

  return serializeGmScraperQuery(row);
}

export async function deleteGmScraperQuery(id: string) {
  const existing = await prisma.gmScraperQuery.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  if (existing.status === GmScraperStatus.PROCESSING) {
    throw new Error("Cannot delete a query while it is processing");
  }

  await prisma.gmScraperQuery.delete({ where: { id } });
  return { id };
}

export async function retryGmScraperQuery(id: string) {
  const existing = await prisma.gmScraperQuery.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!existing) return null;
  if (existing.status === GmScraperStatus.PROCESSING) {
    throw new Error("Query is already processing");
  }

  const row = await prisma.gmScraperQuery.update({
    where: { id },
    data: {
      status: GmScraperStatus.PENDING,
      lastError: null,
      resultCount: null,
      claimedAt: null,
      processedAt: null,
    },
    include: queryInclude,
  });

  return serializeGmScraperQuery(row);
}

export type ResetGmScraperContactsMode =
  | "pipeline_only"
  | "reset_enrichment"
  | "full_reset";

export type ResetGmScraperContactsResult = {
  contacts: number;
  removedFromPipeline: number;
  resetFields: number;
};

/**
 * Pulls a query's scraped contacts back out of the pipeline so they can be
 * re-staged manually, optionally resetting enrichment/email state to look
 * "just scraped". The contacts themselves (tag, campaign membership, and the
 * GM-scraper link) are always preserved.
 *
 *   pipeline_only    -> only delete the PipelineContact placements
 *   reset_enrichment -> + enrichmentStatus PENDING, enrichedAt null
 *   full_reset       -> + emailStatus UNKNOWN, quality UNQUALIFIED, score null
 */
export async function resetGmScraperQueryContacts(
  queryId: string,
  mode: ResetGmScraperContactsMode = "full_reset",
): Promise<ResetGmScraperContactsResult | null> {
  const query = await prisma.gmScraperQuery.findUnique({
    where: { id: queryId },
    select: { id: true, campaignId: true },
  });
  if (!query) return null;

  const links = await prisma.gmScraperQueryContact.findMany({
    where: { queryId },
    select: { contactId: true },
  });
  const contactIds = links.map((l) => l.contactId);

  if (contactIds.length === 0) {
    return { contacts: 0, removedFromPipeline: 0, resetFields: 0 };
  }

  // Scope pipeline removal to the query's campaign pipeline when there is one,
  // otherwise clear these contacts from every pipeline they sit in.
  let pipelineId: string | null = null;
  if (query.campaignId) {
    const pipeline = await prisma.pipeline.findUnique({
      where: { campaignId: query.campaignId },
      select: { id: true },
    });
    pipelineId = pipeline?.id ?? null;
  }

  const removed = await prisma.pipelineContact.deleteMany({
    where: {
      contactId: { in: contactIds },
      ...(pipelineId ? { pipelineId } : {}),
    },
  });

  let resetFields = 0;
  if (mode !== "pipeline_only") {
    const data: Prisma.ContactUpdateManyMutationInput =
      mode === "full_reset"
        ? {
            enrichmentStatus: "PENDING",
            enrichedAt: null,
            emailStatus: "UNKNOWN",
            quality: "UNQUALIFIED",
            score: null,
          }
        : { enrichmentStatus: "PENDING", enrichedAt: null };

    const updated = await prisma.contact.updateMany({
      where: { id: { in: contactIds } },
      data,
    });
    resetFields = updated.count;
  }

  return {
    contacts: contactIds.length,
    removedFromPipeline: removed.count,
    resetFields,
  };
}

export async function listGmScraperQueryContacts(queryId: string) {
  const query = await prisma.gmScraperQuery.findUnique({
    where: { id: queryId },
    select: { stageId: true },
  });

  const links = await prisma.gmScraperQueryContact.findMany({
    where: { queryId },
    orderBy: { addedAt: "desc" },
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          email: true,
          emailStatus: true,
          phone: true,
          companyName: true,
          companyWebsite: true,
          companyDomain: true,
          enrichmentStatus: true,
          createdAt: true,
        },
      },
    },
  });

  // Which of these contacts already sit in the query's configured stage — used
  // by the per-row "process" button to disable already-placed contacts.
  let inStageIds = new Set<string>();
  if (query?.stageId && links.length > 0) {
    const placed = await prisma.pipelineContact.findMany({
      where: {
        stageId: query.stageId,
        contactId: { in: links.map((l) => l.contactId) },
      },
      select: { contactId: true },
    });
    inStageIds = new Set(placed.map((p) => p.contactId));
  }

  return links.map((link) => ({
    ...link.contact,
    addedAt: link.addedAt.toISOString(),
    createdAt: link.contact.createdAt.toISOString(),
    inStage: inStageIds.has(link.contactId),
  }));
}

/**
 * Manually "processes" a single scraped contact by placing it into the query's
 * configured campaign + stage. Used by the per-row button on the query detail
 * page. Requires the query to have a campaign and stage configured, and the
 * contact to be linked to the query. Returns the stage it was placed in plus
 * the add result, or null if the query is missing.
 */
export async function processGmScraperContact(
  queryId: string,
  contactId: string,
) {
  const query = await prisma.gmScraperQuery.findUnique({
    where: { id: queryId },
    select: { id: true, campaignId: true, stageId: true },
  });
  if (!query) return null;

  if (!query.campaignId || !query.stageId) {
    throw new Error("Query has no configured campaign and stage");
  }

  const link = await prisma.gmScraperQueryContact.findUnique({
    where: { queryId_contactId: { queryId, contactId } },
    select: { contactId: true },
  });
  if (!link) {
    throw new Error("Contact is not linked to this query");
  }

  const pipeline = await ensurePipelineForCampaign(query.campaignId);
  if (!pipeline) throw new Error("Campaign not found");

  const stage = pipeline.stages.find((s) => s.id === query.stageId);
  if (!stage) throw new Error("Configured stage not found on campaign pipeline");

  const { addContactsToStage } = await import("@/lib/pipelines");
  const result = await addContactsToStage(pipeline.id, stage.id, [contactId]);
  if (!result) throw new Error("Failed to place contact in stage");

  return { stage: { id: stage.id, name: stage.name }, ...result };
}

export type PushGmScraperContactsInput = {
  campaignId: string;
  stageId: string;
};

export async function pushGmScraperContactsToStage(
  queryId: string,
  input: PushGmScraperContactsInput,
) {
  const query = await prisma.gmScraperQuery.findUnique({
    where: { id: queryId },
    select: { id: true, status: true },
  });
  if (!query) return null;
  if (query.status !== GmScraperStatus.DONE) {
    throw new Error("Query must be DONE before pushing contacts to a stage");
  }

  const pipeline = await ensurePipelineForCampaign(input.campaignId);
  if (!pipeline) throw new Error("Campaign not found");

  const stage = pipeline.stages.find((s) => s.id === input.stageId);
  if (!stage) throw new Error("Stage not found for campaign pipeline");

  const links = await prisma.gmScraperQueryContact.findMany({
    where: { queryId },
    select: { contactId: true },
  });

  if (links.length === 0) {
    return { moved: 0, created: 0, matched: 0 };
  }

  const { addContactsToStage } = await import("@/lib/pipelines");
  const result = await addContactsToStage(
    pipeline.id,
    stage.id,
    links.map((l) => l.contactId),
  );

  if (!result) throw new Error("Failed to place contacts in stage");

  return { ...result, matched: links.length };
}
