import { Prisma } from "@/generated/prisma/client";
import { evaluateActionSuccess, decryptHeaders } from "@/lib/actions";
import { ensurePipelineForCampaign } from "@/lib/campaigns";
import { prisma } from "@/lib/prisma";
import { interpolateHeaders, interpolateString, interpolateValue } from "@/lib/templating";

export type StageDirection = "up" | "down";

const stageSelect = {
  id: true,
  name: true,
  order: true,
  actionId: true,
  autoProcessing: true,
  action: { select: { id: true, name: true, method: true, url: true } },
  _count: { select: { contacts: true } },
} as const;

function stagesForPipeline(pipelineId: string) {
  return prisma.stage.findMany({
    where: { pipelineId },
    orderBy: { order: "asc" },
    select: stageSelect,
  });
}

// Appends a new stage to a campaign's pipeline (creating the pipeline if needed).
// Returns the full ordered stage list, or null if the campaign is missing.
export async function addStageToCampaignPipeline(
  campaignId: string,
  name: string,
) {
  const pipeline = await ensurePipelineForCampaign(campaignId);

  if (!pipeline) {
    return null;
  }

  const lastOrder = pipeline.stages.reduce(
    (max, stage) => Math.max(max, stage.order),
    -1,
  );

  await prisma.stage.create({
    data: {
      name,
      order: lastOrder + 1,
      pipelineId: pipeline.id,
    },
  });

  return stagesForPipeline(pipeline.id);
}

// Renames a stage that belongs to the campaign's pipeline. Returns the ordered
// stage list, or null if the campaign/pipeline/stage can't be resolved.
export async function renameCampaignStage(
  campaignId: string,
  stageId: string,
  name: string,
) {
  const pipeline = await ensurePipelineForCampaign(campaignId);

  if (!pipeline) {
    return null;
  }

  const stage = await prisma.stage.findFirst({
    where: { id: stageId, pipelineId: pipeline.id },
    select: { id: true },
  });

  if (!stage) {
    return null;
  }

  await prisma.stage.update({
    where: { id: stage.id },
    data: { name },
  });

  return stagesForPipeline(pipeline.id);
}

// Moves a stage one position up (earlier) or down (later) by swapping its
// `order` with the adjacent stage. No-op at the boundaries. Returns the ordered
// stage list, or null if campaign/pipeline/stage can't be resolved.
export async function reorderCampaignStage(
  campaignId: string,
  stageId: string,
  direction: StageDirection,
) {
  const pipeline = await ensurePipelineForCampaign(campaignId);

  if (!pipeline) {
    return null;
  }

  const stages = await stagesForPipeline(pipeline.id);
  const index = stages.findIndex((stage) => stage.id === stageId);

  if (index === -1) {
    return null;
  }

  const neighborIndex = direction === "up" ? index - 1 : index + 1;

  // Boundary — nothing to swap with, return current order unchanged.
  if (neighborIndex < 0 || neighborIndex >= stages.length) {
    return stages;
  }

  const current = stages[index];
  const neighbor = stages[neighborIndex];

  await prisma.$transaction([
    prisma.stage.update({
      where: { id: current.id },
      data: { order: neighbor.order },
    }),
    prisma.stage.update({
      where: { id: neighbor.id },
      data: { order: current.order },
    }),
  ]);

  return stagesForPipeline(pipeline.id);
}

// Deletes a stage from the campaign's pipeline and re-normalizes the remaining
// stages' `order` to stay contiguous (0,1,2,...). Returns the ordered stage
// list, or null if the campaign/pipeline/stage can't be resolved.
export async function deleteCampaignStage(campaignId: string, stageId: string) {
  const pipeline = await ensurePipelineForCampaign(campaignId);

  if (!pipeline) {
    return null;
  }

  const stage = await prisma.stage.findFirst({
    where: { id: stageId, pipelineId: pipeline.id },
    select: { id: true },
  });

  if (!stage) {
    return null;
  }

  await prisma.$transaction(async (tx) => {
    await tx.stage.delete({ where: { id: stage.id } });

    const remaining = await tx.stage.findMany({
      where: { pipelineId: pipeline.id },
      orderBy: { order: "asc" },
      select: { id: true },
    });

    await Promise.all(
      remaining.map((row, index) =>
        tx.stage.update({ where: { id: row.id }, data: { order: index } }),
      ),
    );
  });

  return stagesForPipeline(pipeline.id);
}

// Places one or more contacts into a stage of a pipeline. Because a contact
// sits in exactly one stage per pipeline (@@unique contact+pipeline), existing
// placements are moved to the target stage; new ones are created and appended
// after the current contacts in that stage. Unknown contact ids are skipped.
// Returns { moved, created } or null if the pipeline/stage can't be resolved.
export async function addContactsToStage(
  pipelineId: string,
  stageId: string,
  contactIds: string[],
) {
  const stage = await prisma.stage.findFirst({
    where: { id: stageId, pipelineId },
    select: { id: true },
  });

  if (!stage) {
    return null;
  }

  const contacts = await prisma.contact.findMany({
    where: { id: { in: contactIds } },
    select: { id: true },
  });
  const validIds = new Set(contacts.map((c) => c.id));

  let moved = 0;
  let created = 0;

  await prisma.$transaction(async (tx) => {
    let nextOrder = await tx.pipelineContact.count({
      where: { stageId: stage.id },
    });

    for (const contactId of contactIds) {
      if (!validIds.has(contactId)) continue;

      const existing = await tx.pipelineContact.findUnique({
        where: {
          contactId_pipelineId: { contactId, pipelineId },
        },
        select: { id: true, stageId: true },
      });

      if (existing) {
        if (existing.stageId === stage.id) continue;
        // Explicit (re)placement starts fresh in the target stage: reset to
        // PENDING so the processor can pick it up even if it was FAILED/WAITING.
        await tx.pipelineContact.update({
          where: { id: existing.id },
          data: {
            stageId: stage.id,
            stageStatus: "PENDING",
            processingStartedAt: null,
            order: nextOrder++,
            addedToStageAt: new Date(),
          },
        });
        moved++;
      } else {
        await tx.pipelineContact.create({
          data: {
            contactId,
            pipelineId,
            stageId: stage.id,
            order: nextOrder++,
          },
        });
        created++;
      }
    }
  });

  return { moved, created };
}

export type ContactStageStatus =
  | "PENDING"
  | "PROCESSING"
  | "FAILED"
  | "WAITING";

// Manually updates a contact's placement in a pipeline: move it to another
// stage and/or override its stageStatus. Used by the contact detail page so an
// operator can unstick / re-route a contact by hand. Moving to a different
// stage appends it to the end and (unless an explicit status is given) resets
// to PENDING so the processor can pick it up. Returns the updated placement, or
// null if the contact isn't in the given pipeline.
export async function setContactPipelinePlacement(
  contactId: string,
  pipelineId: string,
  input: { stageId?: string; stageStatus?: ContactStageStatus },
) {
  const placement = await prisma.pipelineContact.findUnique({
    where: { contactId_pipelineId: { contactId, pipelineId } },
    select: { id: true, stageId: true },
  });

  if (!placement) {
    return null;
  }

  const data: Prisma.PipelineContactUpdateInput = {};

  const movingStage = input.stageId && input.stageId !== placement.stageId;

  if (input.stageId) {
    const stage = await prisma.stage.findFirst({
      where: { id: input.stageId, pipelineId },
      select: { id: true },
    });
    if (!stage) {
      throw new Error("Stage not found for pipeline");
    }

    if (movingStage) {
      const nextOrder = await prisma.pipelineContact.count({
        where: { stageId: stage.id },
      });
      data.stage = { connect: { id: stage.id } };
      data.order = nextOrder;
      data.addedToStageAt = new Date();
      // A manual move starts fresh unless the caller sets a status below.
      data.stageStatus = "PENDING";
      data.processingStartedAt = null;
    }
  }

  if (input.stageStatus) {
    data.stageStatus = input.stageStatus;
    // Clear the in-flight lock unless we are explicitly marking PROCESSING.
    data.processingStartedAt =
      input.stageStatus === "PROCESSING" ? new Date() : null;
  }

  if (Object.keys(data).length === 0) {
    return { ok: true, changed: false as const };
  }

  await prisma.pipelineContact.update({
    where: { id: placement.id },
    data,
  });

  return { ok: true, changed: true as const };
}

// Places one or more contacts into a stage of the campaign's pipeline. Because
// a contact sits in exactly one stage per pipeline (@@unique contact+pipeline),
// existing placements are moved to the target stage; new ones are created and
// appended after the current contacts in that stage. Unknown contact ids are
// skipped. Returns { stages, moved, created } or null if the campaign/pipeline/
// stage can't be resolved.
export async function addContactsToCampaignStage(
  campaignId: string,
  stageId: string,
  contactIds: string[],
) {
  const pipeline = await ensurePipelineForCampaign(campaignId);

  if (!pipeline) {
    return null;
  }

  const result = await addContactsToStage(pipeline.id, stageId, contactIds);

  if (!result) {
    return null;
  }

  return {
    stages: await stagesForPipeline(pipeline.id),
    ...result,
  };
}

// Bulk move: places every contact in the campaign that carries `tagId` into the
// target stage of the campaign's pipeline. This is the actionable half of
// outcome tagging — e.g. tag failures "invalid-email", then sweep them all into
// a fallback stage in one go. Moved placements reset to PENDING (see
// addContactsToStage). Returns { stages, moved, created, matched } or null if
// the campaign/pipeline/stage can't be resolved.
export async function moveCampaignContactsByTagToStage(
  campaignId: string,
  stageId: string,
  tagId: string,
) {
  const pipeline = await ensurePipelineForCampaign(campaignId);

  if (!pipeline) {
    return null;
  }

  const links = await prisma.campaignContact.findMany({
    where: { campaignId, contact: { tags: { some: { tagId } } } },
    select: { contactId: true },
  });

  const contactIds = links.map((link) => link.contactId);

  if (contactIds.length === 0) {
    const stage = await prisma.stage.findFirst({
      where: { id: stageId, pipelineId: pipeline.id },
      select: { id: true },
    });
    if (!stage) return null;
    return {
      stages: await stagesForPipeline(pipeline.id),
      moved: 0,
      created: 0,
      matched: 0,
    };
  }

  const result = await addContactsToStage(pipeline.id, stageId, contactIds);

  if (!result) {
    return null;
  }

  return {
    stages: await stagesForPipeline(pipeline.id),
    matched: contactIds.length,
    ...result,
  };
}

// Resets every FAILED placement in a stage back to PENDING so the processor
// retries them (e.g. after the stage's target service was down). Returns the
// ordered stage list plus how many rows were reset, or null if the
// campaign/pipeline/stage can't be resolved.
export async function retryFailedCampaignStageContacts(
  campaignId: string,
  stageId: string,
) {
  const pipeline = await ensurePipelineForCampaign(campaignId);

  if (!pipeline) {
    return null;
  }

  const stage = pipeline.stages.find((s) => s.id === stageId);

  if (!stage) {
    return null;
  }

  const result = await prisma.pipelineContact.updateMany({
    where: {
      pipelineId: pipeline.id,
      stageId: stage.id,
      stageStatus: "FAILED",
    },
    data: { stageStatus: "PENDING", processingStartedAt: null },
  });

  return {
    stages: await stagesForPipeline(pipeline.id),
    reset: result.count,
  };
}

// Attaches (actionId) or detaches (null) an action on a stage that belongs to
// the campaign's pipeline. Returns the ordered stage list, or null if the
// campaign/pipeline/stage can't be resolved.
export async function setStageAction(
  campaignId: string,
  stageId: string,
  actionId: string | null,
) {
  const pipeline = await ensurePipelineForCampaign(campaignId);

  if (!pipeline) {
    return null;
  }

  const stage = await prisma.stage.findFirst({
    where: { id: stageId, pipelineId: pipeline.id },
    select: { id: true },
  });

  if (!stage) {
    return null;
  }

  await prisma.stage.update({
    where: { id: stage.id },
    data: { actionId },
  });

  return stagesForPipeline(pipeline.id);
}

// Toggles auto-processing on a stage that belongs to the campaign's pipeline.
// Returns the ordered stage list, or null if it can't be resolved.
export async function setStageAutoProcessing(
  campaignId: string,
  stageId: string,
  autoProcessing: boolean,
) {
  const pipeline = await ensurePipelineForCampaign(campaignId);

  if (!pipeline) {
    return null;
  }

  const stage = await prisma.stage.findFirst({
    where: { id: stageId, pipelineId: pipeline.id },
    select: { id: true },
  });

  if (!stage) {
    return null;
  }

  await prisma.stage.update({
    where: { id: stage.id },
    data: { autoProcessing },
  });

  return stagesForPipeline(pipeline.id);
}

// ---------------------------------------------------------------------------
// Stage processing — run a stage's action for its PENDING contacts.
//
// Model: Postgres-as-queue, bounded ticks. Each run claims a bounded slice of
// PENDING contacts (capped per action by batchSize, run at action.concurrency)
// and returns within a wall-clock deadline; leftovers drain on the next tick.
// No background worker — everything runs inside the request.
// ---------------------------------------------------------------------------

const PROCESS_TIMEOUT_MS = 60_000; // per-request (verify-email can be slow)
const RUN_DEADLINE_MS = 50_000; // stop claiming new work after ~50s, return
const STALE_PROCESSING_MS = 5 * 60_000; // reclaim PROCESSING stuck > 5 min
const CRON_LOCK_KEY = "cron:process";
const CRON_LOCK_TTL_MS = 70_000; // > RUN_DEADLINE_MS so it covers a full run

type ProcessResult = {
  pipelineContactId: string;
  contactId: string;
  stageId: string;
  ok: boolean;
  statusCode?: number;
  advancedToStageId?: string | null;
  error?: string;
  // Service was down/unreachable; the contact was left PENDING (not FAILED).
  unreachable?: boolean;
};

type ActionForRun = {
  id: string;
  method: string;
  url: string;
  headers: unknown;
  body: unknown;
  successCriteria: unknown;
  batchSize: number;
  concurrency: number;
  advanceOnSuccess: boolean;
  onSuccessTags: string[];
  onFailureTags: string[];
};

type EligibleStage = {
  id: string;
  pipelineId: string;
  order: number;
  action: ActionForRun;
};

// Executes one action against one contact and returns whether it succeeded per
// the action's success criteria. Never throws — failures become ok:false.
async function runActionForContact(
  action: ActionForRun,
  contact: Record<string, unknown>,
): Promise<{
  ok: boolean;
  statusCode?: number;
  error?: string;
  // True when the target service couldn't be reached (connection refused, DNS,
  // timeout) or replied with an "unavailable" gateway code. The caller should
  // leave the contact PENDING and retry later instead of marking it FAILED.
  unreachable?: boolean;
}> {
  const context = { contact };

  const url = interpolateString(action.url, context);
  const headers = interpolateHeaders(decryptHeaders(action.headers), context);
  const method = action.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && action.body != null;
  const body = hasBody
    ? JSON.stringify(interpolateValue(action.body, context))
    : undefined;

  if (hasBody && !Object.keys(headers).some((h) => h.toLowerCase() === "content-type")) {
    headers["Content-Type"] = "application/json";
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROCESS_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
    });

    let payload: unknown = null;
    const text = await response.text();
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    const ok = evaluateActionSuccess(
      action.successCriteria,
      response.status,
      payload,
    );

    // Gateway "unavailable" codes mean the upstream is down/overloaded — treat
    // like unreachable so we retry later rather than burning the contact.
    const unreachable =
      !ok && [502, 503, 504].includes(response.status);

    return {
      ok,
      statusCode: response.status,
      unreachable,
      error: ok ? undefined : `Success criteria not met (HTTP ${response.status})`,
    };
  } catch (err) {
    // fetch threw: connection refused, DNS failure, or aborted/timed out — the
    // service never answered, so this is unreachable, not a real rejection.
    return {
      ok: false,
      unreachable: true,
      error: err instanceof Error ? err.message : "Request failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

const eligibleStageSelect = {
  id: true,
  pipelineId: true,
  order: true,
  action: {
    select: {
      id: true,
      method: true,
      url: true,
      headers: true,
      body: true,
      successCriteria: true,
      batchSize: true,
      concurrency: true,
      advanceOnSuccess: true,
      onSuccessTags: true,
      onFailureTags: true,
    },
  },
} as const;

// Armed stages = autoProcessing AND an attached action. Scoped to a pipeline
// when pipelineId is given, otherwise across all pipelines (cron).
async function loadEligibleStages(
  pipelineId?: string,
): Promise<EligibleStage[]> {
  const stages = await prisma.stage.findMany({
    where: {
      autoProcessing: true,
      actionId: { not: null },
      ...(pipelineId ? { pipelineId } : {}),
    },
    orderBy: [{ pipelineId: "asc" }, { order: "asc" }],
    select: eligibleStageSelect,
  });

  const eligible: EligibleStage[] = [];
  for (const s of stages) {
    if (!s.action) continue;
    eligible.push({
      id: s.id,
      pipelineId: s.pipelineId,
      order: s.order,
      action: {
        id: s.action.id,
        method: s.action.method,
        url: s.action.url,
        headers: s.action.headers,
        body: s.action.body,
        successCriteria: s.action.successCriteria,
        batchSize: s.action.batchSize,
        concurrency: s.action.concurrency,
        advanceOnSuccess: s.action.advanceOnSuccess,
        onSuccessTags: s.action.onSuccessTags,
        onFailureTags: s.action.onFailureTags,
      },
    });
  }
  return eligible;
}

// Resets contacts stuck in PROCESSING (crash/timeout before settle) back to
// PENDING once they're older than the staleness window. In-flight rows have a
// recent processingStartedAt so they're never touched.
async function reclaimStaleProcessing(pipelineId?: string): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MS);
  const result = await prisma.pipelineContact.updateMany({
    where: {
      stageStatus: "PROCESSING",
      OR: [{ processingStartedAt: { lt: cutoff } }, { processingStartedAt: null }],
      ...(pipelineId ? { pipelineId } : {}),
    },
    data: { stageStatus: "PENDING", processingStartedAt: null },
  });
  return result.count;
}

// Applies outcome tags to a contact (additive, idempotent). Tag IDs that no
// longer exist are silently ignored (the array is a loose reference, not a FK).
// Tagging is a label only — it never changes the contact's pipeline position.
async function applyTags(contactId: string, tagIds: string[]): Promise<void> {
  if (tagIds.length === 0) return;

  const existing = await prisma.tag.findMany({
    where: { id: { in: tagIds } },
    select: { id: true },
  });
  if (existing.length === 0) return;

  await prisma.contactTag.createMany({
    data: existing.map((tag) => ({ contactId, tagId: tag.id })),
    skipDuplicates: true,
  });
}

// Processes one claimed candidate end to end. Atomic claim (PENDING ->
// PROCESSING) guards against double-processing; on settle the lock is cleared:
//   success -> next stage (by order) + PENDING, or just PENDING on terminal stage
//   failure -> FAILED (skipped until manually retried)
// On settle we also apply the action's outcome tags (onSuccessTags /
// onFailureTags) — labels only, they do not move the contact.
async function processOne(
  stage: EligibleStage,
  candidate: { id: string; contactId: string; stageId: string },
): Promise<ProcessResult> {
  const base: ProcessResult = {
    pipelineContactId: candidate.id,
    contactId: candidate.contactId,
    stageId: candidate.stageId,
    ok: false,
  };

  // Atomic claim: only succeeds if the row is still PENDING.
  const claim = await prisma.pipelineContact.updateMany({
    where: { id: candidate.id, stageStatus: "PENDING" },
    data: { stageStatus: "PROCESSING", processingStartedAt: new Date() },
  });
  if (claim.count !== 1) {
    return { ...base, error: "claim-lost" };
  }

  const contact = await prisma.contact.findUnique({
    where: { id: candidate.contactId },
  });
  if (!contact) {
    await prisma.pipelineContact.update({
      where: { id: candidate.id },
      data: { stageStatus: "FAILED", processingStartedAt: null },
    });
    return { ...base, error: "contact-not-found" };
  }

  const outcome = await runActionForContact(
    stage.action,
    contact as unknown as Record<string, unknown>,
  );

  if (!outcome.ok) {
    // Service unreachable (down/timeout/gateway): don't burn the contact. Release
    // the claim back to PENDING so a later tick retries it once the service is
    // back. No FAILED, no failure tags.
    if (outcome.unreachable) {
      await prisma.pipelineContact.update({
        where: { id: candidate.id },
        data: { stageStatus: "PENDING", processingStartedAt: null },
      });
      return {
        ...base,
        unreachable: true,
        statusCode: outcome.statusCode,
        error: outcome.error,
      };
    }

    await prisma.pipelineContact.update({
      where: { id: candidate.id },
      data: { stageStatus: "FAILED", processingStartedAt: null },
    });
    // Label the failure (e.g. "invalid-email") without moving the contact.
    await applyTags(candidate.contactId, stage.action.onFailureTags);
    return { ...base, statusCode: outcome.statusCode, error: outcome.error };
  }

  // Success — label the outcome before deciding advancement.
  await applyTags(candidate.contactId, stage.action.onSuccessTags);

  // Non-advancing (async) action: the request was accepted (e.g. 202) but the
  // real work finishes later. Park the contact as WAITING so the processor
  // won't re-trigger it; an external callback decides whether/where to advance.
  if (!stage.action.advanceOnSuccess) {
    await prisma.pipelineContact.update({
      where: { id: candidate.id },
      data: { stageStatus: "WAITING", processingStartedAt: null },
    });
    return {
      ...base,
      ok: true,
      statusCode: outcome.statusCode,
      advancedToStageId: null,
    };
  }

  // Success — advance to the next stage by order, reset to PENDING.
  const nextStage = await prisma.stage.findFirst({
    where: { pipelineId: stage.pipelineId, order: { gt: stage.order } },
    orderBy: { order: "asc" },
    select: { id: true },
  });

  return prisma.$transaction(async (tx) => {
    if (nextStage) {
      const nextOrder = await tx.pipelineContact.count({
        where: { stageId: nextStage.id },
      });
      await tx.pipelineContact.update({
        where: { id: candidate.id },
        data: {
          stageId: nextStage.id,
          stageStatus: "PENDING",
          processingStartedAt: null,
          order: nextOrder,
          addedToStageAt: new Date(),
        },
      });
    } else {
      // Terminal stage (no later stage) — just clear the lock back to PENDING.
      await tx.pipelineContact.update({
        where: { id: candidate.id },
        data: { stageStatus: "PENDING", processingStartedAt: null },
      });
    }

    return {
      ...base,
      ok: true,
      statusCode: outcome.statusCode,
      advancedToStageId: nextStage?.id ?? null,
    };
  });
}

// Runs a set of eligible stages: for each, claim up to action.batchSize PENDING
// (oldest first for fairness) and process at action.concurrency, stopping when
// the wall-clock deadline is hit. Leftovers drain on the next tick.
async function runStages(
  stages: EligibleStage[],
  deadlineAt: number,
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];

  for (const stage of stages) {
    if (Date.now() >= deadlineAt) break;

    const candidates = await prisma.pipelineContact.findMany({
      where: { stageId: stage.id, stageStatus: "PENDING" },
      orderBy: { addedToStageAt: "asc" },
      select: { id: true, contactId: true, stageId: true },
      take: stage.action.batchSize,
    });

    const concurrency = Math.max(1, stage.action.concurrency);
    for (let i = 0; i < candidates.length; i += concurrency) {
      if (Date.now() >= deadlineAt) break;
      const batch = candidates.slice(i, i + concurrency);
      const settled = await Promise.all(
        batch.map((candidate) => processOne(stage, candidate)),
      );
      results.push(...settled);

      // This stage's target service is down — stop here and let the remaining
      // PENDING contacts retry on a later tick instead of hammering it.
      if (settled.some((r) => r.unreachable)) break;
    }
  }

  return results;
}

function summarize(results: ProcessResult[]) {
  return {
    processed: results.length,
    advanced: results.filter((r) => r.ok).length,
    // Service was down — left PENDING for retry, not a failure.
    skippedContacts: results.filter((r) => r.unreachable).length,
    // "claim-lost" means another concurrent run took the row — not a failure.
    failed: results.filter(
      (r) => !r.ok && !r.unreachable && r.error !== "claim-lost",
    ).length,
    results,
  };
}

// Processes a single pipeline's armed stages (used by the manual "Process"
// button). Returns null if the pipeline doesn't exist.
export async function processPipeline(pipelineId: string) {
  const pipeline = await prisma.pipeline.findUnique({
    where: { id: pipelineId },
    select: { id: true },
  });

  if (!pipeline) return null;

  await reclaimStaleProcessing(pipelineId);
  const stages = await loadEligibleStages(pipelineId);
  const results = await runStages(stages, Date.now() + RUN_DEADLINE_MS);
  return summarize(results);
}

// Manually runs a single contact's CURRENT stage action, on demand (the "process
// this one contact" button). Unlike processPipeline this ignores the stage's
// autoProcessing flag — that's the whole point: test/run one contact without
// arming the stage for the cron. FAILED/WAITING placements are reset to PENDING
// first so they're claimable (manual retry). Returns null when the campaign has
// no pipeline; otherwise an outcome envelope.
export async function processSingleContact(
  campaignId: string,
  contactId: string,
): Promise<{
  ok: boolean;
  error?: string;
  stageName?: string;
  statusCode?: number;
  advanced?: boolean;
} | null> {
  const pipeline = await ensurePipelineForCampaign(campaignId);
  if (!pipeline) return null;

  const placement = await prisma.pipelineContact.findUnique({
    where: { contactId_pipelineId: { contactId, pipelineId: pipeline.id } },
    select: {
      id: true,
      contactId: true,
      stageId: true,
      stageStatus: true,
      stage: {
        select: {
          id: true,
          pipelineId: true,
          order: true,
          name: true,
          action: { select: eligibleStageSelect.action.select },
        },
      },
    },
  });

  if (!placement) {
    return { ok: false, error: "Contact is not in this campaign's pipeline" };
  }

  const action = placement.stage.action;
  if (!action) {
    return {
      ok: false,
      stageName: placement.stage.name,
      error: "This stage has no action to run",
    };
  }

  // Already mid-flight — don't double-trigger.
  if (placement.stageStatus === "PROCESSING") {
    return {
      ok: false,
      stageName: placement.stage.name,
      error: "Contact is already being processed",
    };
  }

  // processOne can only claim a PENDING row; reset terminal/parked states so a
  // manual run can re-process them.
  if (placement.stageStatus !== "PENDING") {
    await prisma.pipelineContact.update({
      where: { id: placement.id },
      data: { stageStatus: "PENDING", processingStartedAt: null },
    });
  }

  const stage: EligibleStage = {
    id: placement.stage.id,
    pipelineId: placement.stage.pipelineId,
    order: placement.stage.order,
    action: {
      id: action.id,
      method: action.method,
      url: action.url,
      headers: action.headers,
      body: action.body,
      successCriteria: action.successCriteria,
      batchSize: action.batchSize,
      concurrency: action.concurrency,
      advanceOnSuccess: action.advanceOnSuccess,
      onSuccessTags: action.onSuccessTags,
      onFailureTags: action.onFailureTags,
    },
  };

  const result = await processOne(stage, {
    id: placement.id,
    contactId: placement.contactId,
    stageId: placement.stageId,
  });

  return {
    ok: result.ok,
    error: result.error,
    stageName: placement.stage.name,
    statusCode: result.statusCode,
    advanced: result.ok && Boolean(result.advancedToStageId),
  };
}

// TTL row-lock acquire/release (connection-safe, unlike pg advisory locks under
// Prisma pooling). Returns true if the caller now holds the lock.
async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + ttlMs);

  // Take over an expired (or our own) lock.
  const taken = await prisma.processingLock.updateMany({
    where: { key, lockedUntil: { lt: now } },
    data: { lockedUntil },
  });
  if (taken.count === 1) return true;

  // First-ever acquisition: create the row. Unique key => create fails if a
  // live lock already exists, which is the "someone else holds it" case.
  try {
    await prisma.processingLock.create({ data: { key, lockedUntil } });
    return true;
  } catch {
    return false;
  }
}

async function releaseLock(key: string): Promise<void> {
  await prisma.processingLock
    .updateMany({ where: { key }, data: { lockedUntil: new Date(0) } })
    .catch(() => {});
}

// Cron entry point: processes armed stages across ALL pipelines, guarded by a
// single-flight TTL lock so overlapping cron runs don't pile up. If the lock is
// held, returns { skipped: true } immediately.
export async function processAllPipelines() {
  const locked = await acquireLock(CRON_LOCK_KEY, CRON_LOCK_TTL_MS);
  if (!locked) {
    return { skipped: true as const, reason: "already-running" };
  }

  try {
    const reclaimed = await reclaimStaleProcessing();
    const stages = await loadEligibleStages();
    const results = await runStages(stages, Date.now() + RUN_DEADLINE_MS);
    const pipelines = new Set(stages.map((s) => s.pipelineId)).size;
    return { skipped: false as const, reclaimed, pipelines, ...summarize(results) };
  } finally {
    await releaseLock(CRON_LOCK_KEY);
  }
}

// ---------------------------------------------------------------------------
// Callback-driven advancement for async (non-advancing) actions.
//
// When an async action parks a contact as WAITING (see processOne), the work's
// callback later resolves it via this function:
//   advance=true  -> move WAITING placements to the next stage (PENDING), or
//                    just clear to PENDING on a terminal stage
//   advance=false -> mark them FAILED (the gate didn't pass, e.g. no email)
//
// Scoped to a single contact (callbacks only know the contact id). Only touches
// rows currently in WAITING, so it's a no-op if the engine hasn't parked yet or
// the contact already moved on. Returns the count of placements resolved.
// ---------------------------------------------------------------------------
export async function resolveWaitingContact(
  contactId: string,
  advance: boolean,
): Promise<{ resolved: number; advanced: number; failed: number }> {
  const waiting = await prisma.pipelineContact.findMany({
    where: { contactId, stageStatus: "WAITING" },
    select: {
      id: true,
      pipelineId: true,
      stage: { select: { order: true } },
    },
  });

  let advanced = 0;
  let failed = 0;

  for (const pc of waiting) {
    if (!advance) {
      await prisma.pipelineContact.update({
        where: { id: pc.id },
        data: { stageStatus: "FAILED", processingStartedAt: null },
      });
      failed++;
      continue;
    }

    const nextStage = await prisma.stage.findFirst({
      where: { pipelineId: pc.pipelineId, order: { gt: pc.stage.order } },
      orderBy: { order: "asc" },
      select: { id: true },
    });

    await prisma.$transaction(async (tx) => {
      if (nextStage) {
        const nextOrder = await tx.pipelineContact.count({
          where: { stageId: nextStage.id },
        });
        await tx.pipelineContact.update({
          where: { id: pc.id },
          data: {
            stageId: nextStage.id,
            stageStatus: "PENDING",
            processingStartedAt: null,
            order: nextOrder,
            addedToStageAt: new Date(),
          },
        });
      } else {
        // Terminal stage — nothing later to advance to; clear back to PENDING.
        await tx.pipelineContact.update({
          where: { id: pc.id },
          data: { stageStatus: "PENDING", processingStartedAt: null },
        });
      }
    });
    advanced++;
  }

  return { resolved: waiting.length, advanced, failed };
}
