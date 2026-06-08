"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Log = {
  id: string;
  category: string;
  level: string;
  event: string;
  message: string;
  metadata: unknown;
  correlationId: string | null;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
};

const CATEGORIES = [
  "ALL",
  "CRONJOB",
  "CONTACT",
  "CAMPAIGN",
  "PIPELINE",
  "STAGE",
  "ACTION",
  "SYSTEM",
] as const;

const LEVELS = ["ALL", "DEBUG", "INFO", "WARN", "ERROR"] as const;

const categoryItems = Object.fromEntries(CATEGORIES.map((c) => [c, c]));
const levelItems = Object.fromEntries(LEVELS.map((l) => [l, l]));

function levelVariant(
  level: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (level === "ERROR") return "destructive";
  if (level === "WARN") return "outline";
  if (level === "INFO") return "secondary";
  return "outline";
}

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<string>("CRONJOB");
  const [level, setLevel] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadLogs = useCallback(async () => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", "25");
    if (category !== "ALL") params.set("category", category);
    if (level !== "ALL") params.set("level", level);

    const response = await fetch(`/api/logs?${params.toString()}`, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Failed to load logs");
    const data = (await response.json()) as {
      logs: Log[];
      total: number;
      totalPages: number;
    };
    setLogs(data.logs);
    setTotal(data.total);
    setTotalPages(data.totalPages);
  }, [page, category, level]);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await loadLogs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadLogs]);

  // Auto-refresh the first page so new cron logs appear live.
  useEffect(() => {
    if (!autoRefresh || page !== 1) return;
    const id = setInterval(() => void loadLogs().catch(() => {}), 5000);
    return () => clearInterval(id);
  }, [autoRefresh, page, loadLogs]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
        <p className="text-sm text-muted-foreground">
          Segmented activity stream. Filter by category to track what&apos;s
          happening across the system.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle>Activity</CardTitle>
          <div className="flex items-center gap-2">
            <div className="w-40">
              <Select
                items={categoryItems}
                value={category}
                onValueChange={(v) => {
                  setPage(1);
                  setCategory(v as string);
                }}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "ALL" ? "All categories" : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-32">
              <Select
                items={levelItems}
                value={level}
                onValueChange={(v) => {
                  setPage(1);
                  setLevel(v as string);
                }}
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEVELS.map((l) => (
                    <SelectItem key={l} value={l}>
                      {l === "ALL" ? "All levels" : l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
              onClick={() => setAutoRefresh((v) => !v)}
            >
              <RefreshCw className="size-4" />
              {autoRefresh ? "Live" : "Paused"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No logs yet for this filter.
            </p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-44">Time</TableHead>
                    <TableHead className="w-28">Category</TableHead>
                    <TableHead className="w-20">Level</TableHead>
                    <TableHead className="w-44">Event</TableHead>
                    <TableHead>Message</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatWhen(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.category}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={levelVariant(log.level)}>
                          {log.level}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.event}
                      </TableCell>
                      <TableCell className="text-sm">{log.message}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                <span>
                  {total} log{total === 1 ? "" : "s"} · page {page} of{" "}
                  {totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
