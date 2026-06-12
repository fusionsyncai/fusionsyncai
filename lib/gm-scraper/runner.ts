import {
  GmScraperStatus,
  LogCategory,
  LogLevel,
} from "@/generated/prisma/client";
import { ensurePipelineForCampaign } from "@/lib/campaigns";
import { importContacts } from "@/lib/contacts-import";
import { writeLog } from "@/lib/logs";
import { prisma } from "@/lib/prisma";

import { randomUUID } from "node:crypto";

import { mapBusinessToImportRow } from "./map";
import { scrapeGoogleMaps } from "./scraper";

const STALE_PROCESSING_MS = 15 * 60_000;

export type GmScraperRunSummary = {
  queryId?: string;
  query?: string;
  scraped?: number;
  import?: {
    total: number;
    created: number;
    skipped: number;
    failed: number;
  };
  linked?: number;
  error?: string;
};

async function reclaimStaleGmScraperQueries(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  const result = await prisma.gmScraperQuery.updateMany({
    where: {
      status: GmScraperStatus.PROCESSING,
      claimedAt: { lt: cutoff },
    },
    data: {
      status: GmScraperStatus.FAILED,
      lastError: "Processing timed out (stale reclaim)",
      claimedAt: null,
    },
  });
  return result.count;
}

async function claimNextGmScraperQuery() {
  const pending = await prisma.gmScraperQuery.findFirst({
    where: { status: GmScraperStatus.PENDING },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!pending) return null;

  const claim = await prisma.gmScraperQuery.updateMany({
    where: { id: pending.id, status: GmScraperStatus.PENDING },
    data: {
      status: GmScraperStatus.PROCESSING,
      claimedAt: new Date(),
      lastError: null,
    },
  });

  if (claim.count !== 1) return null;

  return prisma.gmScraperQuery.findUnique({ where: { id: pending.id } });
}

async function settleQuery(
  id: string,
  data: {
    status: typeof GmScraperStatus.DONE | typeof GmScraperStatus.FAILED;
    resultCount?: number;
    lastError?: string | null;
  },
) {
  await prisma.gmScraperQuery.update({
    where: { id },
    data: {
      status: data.status,
      resultCount: data.resultCount ?? null,
      lastError: data.lastError ?? null,
      processedAt: new Date(),
      claimedAt: null,
    },
  });
}

export async function runGmScraperQueryById(
  queryId: string,
): Promise<{ ok: boolean; summary: GmScraperRunSummary }> {
  const claim = await prisma.gmScraperQuery.updateMany({
    where: {
      id: queryId,
      status: { in: [GmScraperStatus.PENDING, GmScraperStatus.FAILED] },
    },
    data: {
      status: GmScraperStatus.PROCESSING,
      claimedAt: new Date(),
      lastError: null,
    },
  });

  if (claim.count !== 1) {
    const existing = await prisma.gmScraperQuery.findUnique({
      where: { id: queryId },
      select: { status: true },
    });
    if (!existing) {
      return { ok: false, summary: { error: "Query not found" } };
    }
    return {
      ok: false,
      summary: { error: `Cannot run query in status ${existing.status}` },
    };
  }

  const row = await prisma.gmScraperQuery.findUnique({ where: { id: queryId } });
  if (!row) {
    return { ok: false, summary: { error: "Query not found" } };
  }

  return executeGmScraperQuery(row);
}

async function executeGmScraperQuery(
  row: NonNullable<Awaited<ReturnType<typeof claimNextGmScraperQuery>>>,
): Promise<{ ok: boolean; summary: GmScraperRunSummary }> {
  const correlationId = randomUUID();
  const baseLog = {
    category: LogCategory.GM_SCRAPER,
    correlationId,
    entityType: "GmScraperQuery",
    entityId: row.id,
  };

  await writeLog({
    ...baseLog,
    event: "gm_scraper.started",
    message: `GM Scraper started: "${row.query}"`,
    metadata: { query: row.query, maxResults: row.maxResults },
  });

  try {
    const scrapeResult = await scrapeGoogleMaps(row.query, row.maxResults);
    const importRows = scrapeResult.businesses
      .map(mapBusinessToImportRow)
      .filter((r): r is NonNullable<typeof r> => r !== null);

    let pipelineId: string | null = null;
    let stageId: string | null = null;

    if (row.autoProcess && row.campaignId && row.stageId) {
      const pipeline = await ensurePipelineForCampaign(row.campaignId);
      const stage = pipeline?.stages.find((s) => s.id === row.stageId);
      if (pipeline && stage) {
        pipelineId = pipeline.id;
        stageId = stage.id;
      }
    }

    const importResult = await importContacts({
      contacts: importRows,
      tagId: row.tagId,
      campaignId: row.campaignId,
      pipelineId: row.autoProcess ? pipelineId : null,
      stageId: row.autoProcess ? stageId : null,
      gmScraperQueryId: row.id,
      region: row.region,
    });

    await settleQuery(row.id, {
      status: GmScraperStatus.DONE,
      resultCount: importResult.created,
      lastError: null,
    });

    const summary: GmScraperRunSummary = {
      queryId: row.id,
      query: row.query,
      scraped: scrapeResult.businesses.length,
      import: {
        total: importResult.total,
        created: importResult.created,
        skipped: importResult.skipped,
        failed: importResult.failed,
      },
      linked: importResult.createdContactIds.length,
    };

    await writeLog({
      ...baseLog,
      event: "gm_scraper.completed",
      message: `GM Scraper completed: ${importResult.created} created from "${row.query}"`,
      metadata: summary,
    });

    return { ok: true, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : "GM Scraper failed";

    await settleQuery(row.id, {
      status: GmScraperStatus.FAILED,
      lastError: message,
    });

    await writeLog({
      ...baseLog,
      level: LogLevel.ERROR,
      event: "gm_scraper.failed",
      message: `GM Scraper failed: ${message}`,
      metadata: { query: row.query, error: message },
    });

    return { ok: false, summary: { queryId: row.id, query: row.query, error: message } };
  }
}

/** Cron entry: reclaim stale, claim one PENDING query, scrape + import. */
export async function runNextGmScraperQuery(): Promise<{
  skipped: boolean;
  summary: GmScraperRunSummary;
}> {
  const reclaimed = await reclaimStaleGmScraperQueries();
  const row = await claimNextGmScraperQuery();

  if (!row) {
    return {
      skipped: true,
      summary: { scraped: 0, ...(reclaimed > 0 ? { error: `reclaimed ${reclaimed} stale` } : {}) },
    };
  }

  const outcome = await executeGmScraperQuery(row);
  return { skipped: false, summary: outcome.summary };
}
