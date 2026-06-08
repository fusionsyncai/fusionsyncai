import {
  LogCategory,
  LogLevel,
  Prisma,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const logCategories = Object.values(LogCategory);
export const logLevels = Object.values(LogLevel);

export type WriteLogInput = {
  category: LogCategory;
  event: string;
  message: string;
  level?: LogLevel;
  metadata?: unknown;
  correlationId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

// Append a log entry. Intentionally best-effort: logging must NEVER break the
// operation it's observing, so failures are swallowed (and surfaced to stderr).
export async function writeLog(input: WriteLogInput): Promise<void> {
  try {
    await prisma.log.create({
      data: {
        category: input.category,
        level: input.level ?? LogLevel.INFO,
        event: input.event,
        message: input.message,
        metadata:
          input.metadata === undefined || input.metadata === null
            ? undefined
            : (input.metadata as Prisma.InputJsonValue),
        correlationId: input.correlationId ?? undefined,
        entityType: input.entityType ?? undefined,
        entityId: input.entityId ?? undefined,
      },
    });
  } catch (err) {
    console.error("[logs] failed to write log:", err, input.event);
  }
}

const logListSelect = {
  id: true,
  category: true,
  level: true,
  event: true,
  message: true,
  metadata: true,
  correlationId: true,
  entityType: true,
  entityId: true,
  createdAt: true,
} as const;

export type ListLogsParams = {
  page?: number;
  pageSize?: number;
  category?: string | null;
  level?: string | null;
  entityType?: string | null;
  entityId?: string | null;
};

function asCategory(value: unknown): LogCategory | undefined {
  return typeof value === "string" && logCategories.includes(value as LogCategory)
    ? (value as LogCategory)
    : undefined;
}

function asLevel(value: unknown): LogLevel | undefined {
  return typeof value === "string" && logLevels.includes(value as LogLevel)
    ? (value as LogLevel)
    : undefined;
}

// Deletes log entries older than `days`. Returns how many were removed.
// Used by the DELETE_OLD_LOGS cron job for retention.
export async function deleteLogsOlderThan(days: number): Promise<number> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await prisma.log.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}

// Paginated, filterable log list (newest first). Filters are server-side.
export async function listLogs(params: ListLogsParams) {
  const page = Math.max(1, Math.floor(Number(params.page)) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, Math.floor(Number(params.pageSize)) || 20),
  );

  const where: Prisma.LogWhereInput = {};
  const category = asCategory(params.category);
  if (category) where.category = category;
  const level = asLevel(params.level);
  if (level) where.level = level;
  if (params.entityType) where.entityType = params.entityType;
  if (params.entityId) where.entityId = params.entityId;

  const [total, rows] = await Promise.all([
    prisma.log.count({ where }),
    prisma.log.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: logListSelect,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return {
    logs: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
    totalPages,
    hasNextPage: page < totalPages,
  };
}
