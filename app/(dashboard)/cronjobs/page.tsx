"use client";

import { useCallback, useEffect, useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

type CronJob = {
  id: string;
  name: string;
  type: string;
  enabled: boolean;
  intervalSeconds: number;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastResult: unknown;
  lastError: string | null;
  isRunning: boolean;
  createdAt: string;
};

const JOB_TYPES = [
  { id: "PROCESS_PIPELINES", label: "Process pipelines" },
  { id: "DELETE_OLD_LOGS", label: "Delete old logs (14d)" },
  { id: "BACKUP_DB", label: "Backup database" },
  { id: "RUN_GM_SCRAPER", label: "Run GM Scraper (1 query)" },
] as const;

const typeItems = Object.fromEntries(
  JOB_TYPES.map((t) => [t.id, t.label]),
);

function typeLabel(type: string) {
  return JOB_TYPES.find((t) => t.id === type)?.label ?? type;
}

function statusVariant(
  status: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "SUCCESS") return "default";
  if (status === "SKIPPED") return "secondary";
  if (status === "FAILED") return "destructive";
  return "outline";
}

function formatWhen(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function resultSummary(result: unknown): string {
  if (result === null || typeof result !== "object") return "";
  const r = result as Record<string, unknown>;
  if (r.skipped === true) return "skipped (already running)";
  const parts: string[] = [];
  if (typeof r.processed === "number") parts.push(`processed ${r.processed}`);
  if (typeof r.advanced === "number") parts.push(`advanced ${r.advanced}`);
  if (typeof r.failed === "number") parts.push(`failed ${r.failed}`);
  if (typeof r.pipelines === "number") parts.push(`${r.pipelines} pipeline(s)`);
  if (typeof r.scraped === "number") parts.push(`scraped ${r.scraped}`);
  if (r.import && typeof r.import === "object") {
    const imp = r.import as Record<string, unknown>;
    if (typeof imp.created === "number") parts.push(`created ${imp.created}`);
  }
  if (typeof r.query === "string") parts.push(r.query);
  return parts.join(" · ");
}

export default function CronjobsPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("Process pipelines");
  const [type, setType] = useState<string>(JOB_TYPES[0].id);
  const [intervalSeconds, setIntervalSeconds] = useState("60");
  const [enabledOnCreate, setEnabledOnCreate] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [jobToDelete, setJobToDelete] = useState<CronJob | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [runningId, setRunningId] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    const response = await fetch("/api/cron/jobs", { cache: "no-store" });
    if (!response.ok) throw new Error("Failed to load cron jobs");
    const data = (await response.json()) as { jobs: CronJob[] };
    setJobs(data.jobs);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await loadJobs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadJobs]);

  // Poll while any job is running so lastRun/status updates without a refresh.
  useEffect(() => {
    if (!jobs.some((j) => j.isRunning)) return;
    const id = setInterval(() => void loadJobs().catch(() => {}), 3000);
    return () => clearInterval(id);
  }, [jobs, loadJobs]);

  async function handleCreate() {
    if (isSaving) return;
    setFormError(null);

    if (!name.trim()) {
      setFormError("Name is required");
      return;
    }

    const interval = Number(intervalSeconds.trim());
    if (!Number.isInteger(interval) || interval < 10) {
      setFormError("Interval must be a whole number ≥ 10 seconds");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/cron/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          intervalSeconds: interval,
          enabled: enabledOnCreate,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to create job");
      }

      setName("Process pipelines");
      setIntervalSeconds("60");
      setEnabledOnCreate(false);
      await loadJobs();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleEnabled(job: CronJob, enabled: boolean) {
    const response = await fetch(`/api/cron/jobs/${job.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled }),
    });
    if (!response.ok) return;
    await loadJobs();
  }

  async function handleRunNow(job: CronJob) {
    if (runningId) return;
    setRunningId(job.id);
    try {
      await fetch(`/api/cron/jobs/${job.id}/run`, { method: "POST" });
      await loadJobs();
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete() {
    if (!jobToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/cron/jobs/${jobToDelete.id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete job");
      setJobToDelete(null);
      await loadJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cronjobs</h1>
        <p className="text-sm text-muted-foreground">
          Scheduled tasks that run automatically while the CRM server is up.
          Toggle a job on to start its schedule; off to pause it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New cronjob</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Process pipelines"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Type
              </label>
              <Select
                items={typeItems}
                value={type}
                onValueChange={(v) => setType(v as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOB_TYPES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Interval (seconds)
              </label>
              <Input
                value={intervalSeconds}
                onChange={(e) => setIntervalSeconds(e.target.value)}
                inputMode="numeric"
                placeholder="60"
              />
            </div>
            <label className="flex items-end gap-2 pb-2">
              <Switch
                checked={enabledOnCreate}
                onCheckedChange={(c) => setEnabledOnCreate(c === true)}
              />
              <span className="text-sm">Start enabled</span>
            </label>
          </div>

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <Button onClick={() => void handleCreate()} disabled={isSaving}>
            <Plus className="size-4" />
            {isSaving ? "Creating..." : "Create cronjob"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All cronjobs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cronjobs yet. Create one above — e.g. &quot;Process
              pipelines&quot; every 60s.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Last run</TableHead>
                  <TableHead>Next run</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {typeLabel(job.type)}
                    </TableCell>
                    <TableCell>{job.intervalSeconds}s</TableCell>
                    <TableCell>
                      <Switch
                        size="sm"
                        checked={job.enabled}
                        disabled={job.isRunning}
                        onCheckedChange={(c) =>
                          void handleToggleEnabled(job, c === true)
                        }
                      />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatWhen(job.lastRunAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {job.enabled ? formatWhen(job.nextRunAt) : "—"}
                    </TableCell>
                    <TableCell>
                      {job.isRunning ? (
                        <Badge variant="secondary">Running</Badge>
                      ) : job.lastStatus ? (
                        <div className="space-y-0.5">
                          <Badge variant={statusVariant(job.lastStatus)}>
                            {job.lastStatus}
                          </Badge>
                          {job.lastError ? (
                            <p className="max-w-48 truncate text-xs text-destructive">
                              {job.lastError}
                            </p>
                          ) : resultSummary(job.lastResult) ? (
                            <p className="max-w-48 truncate text-xs text-muted-foreground">
                              {resultSummary(job.lastResult)}
                            </p>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8"
                          aria-label="Run now"
                          disabled={
                            job.isRunning || runningId === job.id
                          }
                          onClick={() => void handleRunNow(job)}
                        >
                          <Play className="size-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          aria-label="Delete job"
                          disabled={job.isRunning}
                          onClick={() => setJobToDelete(job)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={jobToDelete !== null}
        onOpenChange={(open) => !open && setJobToDelete(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete cronjob?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove &quot;{jobToDelete?.name}&quot;. It
              will stop running immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
