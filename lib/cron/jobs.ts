import {
  CronJob,
  CronJobType,
  LogCategory,
  LogLevel,
  Prisma,
} from "@/generated/prisma/client";
import { cronJobHandlers } from "@/lib/cron/registry";
import { writeLog } from "@/lib/logs";
import { prisma } from "@/lib/prisma";

import { randomUUID } from "node:crypto";

const DEFAULT_INTERVAL_SECONDS = 60;
const MIN_INTERVAL_SECONDS = 10;
const STALE_RUN_MS = 10 * 60_000; // reclaim a job stuck "running" > 10 min

function clampInterval(value: unknown): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < MIN_INTERVAL_SECONDS) {
    return Number.isFinite(n) && n >= 1 ? Math.max(n, MIN_INTERVAL_SECONDS) : DEFAULT_INTERVAL_SECONDS;
  }
  return Math.min(n, 86_400); // cap at 1 day
}

function asType(value: unknown): CronJobType | null {
  return typeof value === "string" && value in cronJobHandlers
    ? (value as CronJobType)
    : null;
}

// Shapes a CronJob row for API/UI: dates -> ISO strings.
export function serializeCronJob(job: CronJob) {
  return {
    id: job.id,
    name: job.name,
    type: job.type,
    enabled: job.enabled,
    intervalSeconds: job.intervalSeconds,
    nextRunAt: job.nextRunAt?.toISOString() ?? null,
    lastRunAt: job.lastRunAt?.toISOString() ?? null,
    lastStatus: job.lastStatus,
    lastResult: job.lastResult,
    lastError: job.lastError,
    isRunning: job.isRunning,
    createdAt: job.createdAt.toISOString(),
  };
}

export async function listCronJobs() {
  const jobs = await prisma.cronJob.findMany({ orderBy: { createdAt: "asc" } });
  return jobs.map(serializeCronJob);
}

export type CreateCronJobInput = {
  name: string;
  type: unknown;
  intervalSeconds?: unknown;
  enabled?: unknown;
};

export async function createCronJob(input: CreateCronJobInput) {
  const type = asType(input.type);
  if (!type) return { error: "Unknown job type" as const };

  const enabled = input.enabled === true;
  const intervalSeconds = clampInterval(input.intervalSeconds);

  const job = await prisma.cronJob.create({
    data: {
      name: input.name.trim() || "Untitled job",
      type,
      enabled,
      intervalSeconds,
      // An enabled job is due immediately; a disabled one has no schedule yet.
      nextRunAt: enabled ? new Date() : null,
    },
  });

  return { job: serializeCronJob(job) };
}

export type UpdateCronJobInput = {
  name?: unknown;
  intervalSeconds?: unknown;
  enabled?: unknown;
};

export async function updateCronJob(id: string, input: UpdateCronJobInput) {
  const existing = await prisma.cronJob.findUnique({ where: { id } });
  if (!existing) return null;

  const data: Prisma.CronJobUpdateInput = {};

  if (typeof input.name === "string" && input.name.trim()) {
    data.name = input.name.trim();
  }
  if (input.intervalSeconds !== undefined) {
    data.intervalSeconds = clampInterval(input.intervalSeconds);
  }
  if (input.enabled !== undefined) {
    const enabled = input.enabled === true;
    data.enabled = enabled;
    if (enabled && !existing.enabled) {
      // Turning on: schedule the first run now.
      data.nextRunAt = new Date();
    } else if (!enabled) {
      // Turning off: clear the schedule so it won't be picked up.
      data.nextRunAt = null;
    }
  }

  const job = await prisma.cronJob.update({ where: { id }, data });
  return serializeCronJob(job);
}

export async function deleteCronJob(id: string) {
  const existing = await prisma.cronJob.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return null;

  await prisma.cronJob.delete({ where: { id } });
  return { id };
}

// Atomic claim: flips isRunning false -> true so a slow run can't be started
// twice (by the next tick or a concurrent "Run now"). Returns true if claimed.
async function claimJob(id: string): Promise<boolean> {
  const claim = await prisma.cronJob.updateMany({
    where: { id, isRunning: false },
    data: { isRunning: true, runStartedAt: new Date() },
  });
  return claim.count === 1;
}

// Runs the handler for a claimed job and writes back the outcome + next schedule.
// Emits CRONJOB logs (started/completed/skipped/failed) sharing one
// correlationId so a single run's entries can be grouped.
async function executeClaimedJob(job: CronJob) {
  const handler = cronJobHandlers[job.type];
  const now = new Date();
  const startMs = Date.now();
  const correlationId = randomUUID();
  // Only reschedule if still enabled; a manual run on a disabled job won't arm it.
  const nextRunAt = job.enabled
    ? new Date(now.getTime() + job.intervalSeconds * 1000)
    : job.nextRunAt;

  const baseLog = {
    category: LogCategory.CRONJOB,
    correlationId,
    entityType: "CronJob",
    entityId: job.id,
  };

  await writeLog({
    ...baseLog,
    event: "cronjob.started",
    message: `Cronjob "${job.name}" started`,
    metadata: { jobName: job.name, type: job.type },
  });

  try {
    const result = await handler();
    const durationMs = Date.now() - startMs;
    await prisma.cronJob.update({
      where: { id: job.id },
      data: {
        isRunning: false,
        runStartedAt: null,
        lastRunAt: now,
        nextRunAt,
        lastStatus: result.skipped ? "SKIPPED" : "SUCCESS",
        lastResult: result.summary as Prisma.InputJsonValue,
        lastError: null,
      },
    });

    await writeLog({
      ...baseLog,
      event: result.skipped ? "cronjob.skipped" : "cronjob.completed",
      message: result.skipped
        ? `Cronjob "${job.name}" skipped (already running)`
        : `Cronjob "${job.name}" completed in ${durationMs}ms`,
      metadata: {
        jobName: job.name,
        type: job.type,
        durationMs,
        summary: result.summary,
      },
    });

    return { ok: true as const, skipped: result.skipped === true, summary: result.summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Job failed";
    const durationMs = Date.now() - startMs;
    await prisma.cronJob.update({
      where: { id: job.id },
      data: {
        isRunning: false,
        runStartedAt: null,
        lastRunAt: now,
        nextRunAt,
        lastStatus: "FAILED",
        lastError: message,
      },
    });

    await writeLog({
      ...baseLog,
      level: LogLevel.ERROR,
      event: "cronjob.failed",
      message: `Cronjob "${job.name}" failed: ${message}`,
      metadata: { jobName: job.name, type: job.type, durationMs, error: message },
    });

    return { ok: false as const, error: message };
  }
}

// Claims + runs a single job by id. Used by the scheduler and "Run now".
async function runOne(id: string) {
  const claimed = await claimJob(id);
  if (!claimed) return { claimed: false as const };

  const job = await prisma.cronJob.findUnique({ where: { id } });
  if (!job) {
    await prisma.cronJob
      .updateMany({ where: { id }, data: { isRunning: false } })
      .catch(() => {});
    return { claimed: false as const };
  }

  const outcome = await executeClaimedJob(job);
  return { claimed: true as const, ...outcome };
}

// Manual trigger from the dashboard. Runs regardless of enabled/schedule.
export async function runCronJobNow(id: string) {
  const existing = await prisma.cronJob.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return null;

  const outcome = await runOne(id);
  if (!outcome.claimed) {
    return { alreadyRunning: true as const };
  }
  return { alreadyRunning: false as const, ...outcome };
}

// Resets jobs stuck in isRunning (process crashed mid-run) so they can run again.
async function reclaimStaleJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - STALE_RUN_MS);
  const result = await prisma.cronJob.updateMany({
    where: {
      isRunning: true,
      OR: [{ runStartedAt: { lt: cutoff } }, { runStartedAt: null }],
    },
    data: { isRunning: false, runStartedAt: null },
  });
  return result.count;
}

// Scheduler tick: find enabled, not-running, due jobs and run them sequentially.
// Safe to call repeatedly; claims guard against overlap.
export async function runDueCronJobs() {
  await reclaimStaleJobs();

  const now = new Date();
  const due = await prisma.cronJob.findMany({
    where: {
      enabled: true,
      isRunning: false,
      OR: [{ nextRunAt: null }, { nextRunAt: { lte: now } }],
    },
    select: { id: true },
    orderBy: { nextRunAt: "asc" },
  });

  let ran = 0;
  for (const { id } of due) {
    const outcome = await runOne(id);
    if (outcome.claimed) ran += 1;
  }

  return { due: due.length, ran };
}
