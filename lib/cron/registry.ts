import { CronJobType } from "@/generated/prisma/client";
import { runDatabaseBackup } from "@/lib/backup";
import { deleteLogsOlderThan } from "@/lib/logs";
import { runNextGmScraperQuery } from "@/lib/gm-scraper/runner";
import { processAllPipelines } from "@/lib/pipelines";

// Log retention window for the DELETE_OLD_LOGS job.
const LOG_RETENTION_DAYS = 14;

// A handler runs the actual work for a cron job type and returns a small,
// JSON-serializable summary that we persist as the job's lastResult. The
// `skipped` flag lets a handler report "nothing to do / already running" so the
// dashboard can show SKIPPED instead of SUCCESS.
export type CronJobHandlerResult = {
  skipped?: boolean;
  summary: Record<string, unknown>;
};

export type CronJobHandler = () => Promise<CronJobHandlerResult>;

// Registry: one handler per CronJobType. To add a new kind of job, add a value
// to the CronJobType enum (schema) and a handler here — the scheduler, API and
// UI all work off this map, so nothing else needs to change.
export const cronJobHandlers: Record<CronJobType, CronJobHandler> = {
  [CronJobType.PROCESS_PIPELINES]: async () => {
    const result = await processAllPipelines();
    return { skipped: result.skipped === true, summary: result };
  },

  [CronJobType.DELETE_OLD_LOGS]: async () => {
    const deleted = await deleteLogsOlderThan(LOG_RETENTION_DAYS);
    return { summary: { deleted, retentionDays: LOG_RETENTION_DAYS } };
  },

  [CronJobType.BACKUP_DB]: async () => {
    const result = await runDatabaseBackup();
    return { summary: { file: result.file } };
  },

  [CronJobType.RUN_GM_SCRAPER]: async () => {
    const result = await runNextGmScraperQuery();
    return { skipped: result.skipped, summary: result.summary };
  },
};

// Human-friendly labels for the dashboard/forms.
export const cronJobTypeLabels: Record<CronJobType, string> = {
  [CronJobType.PROCESS_PIPELINES]: "Process pipelines",
  [CronJobType.DELETE_OLD_LOGS]: "Delete old logs (14d)",
  [CronJobType.BACKUP_DB]: "Backup database",
  [CronJobType.RUN_GM_SCRAPER]: "Run GM Scraper (1 query)",
};

export const cronJobTypes = Object.values(CronJobType);
