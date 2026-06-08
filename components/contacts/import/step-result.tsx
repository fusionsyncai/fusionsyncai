"use client";

import { CheckCircle2, SkipForward, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import type { ImportSummary } from "./types";

type StepResultProps = {
  summary: ImportSummary;
  isImporting: boolean;
  progress: { processed: number; total: number };
};

export function StepResult({
  summary,
  isImporting,
  progress,
}: StepResultProps) {
  if (isImporting) {
    const pct =
      progress.total > 0
        ? Math.round((progress.processed / progress.total) * 100)
        : 0;

    return (
      <div className="space-y-4 py-4">
        <p className="text-sm text-muted-foreground">Importing contacts...</p>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-center text-sm text-muted-foreground">
          {progress.processed} / {progress.total} rows processed
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-2">
      <p className="text-sm font-medium">Import complete</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <CheckCircle2 className="size-5 text-green-600" />
          <div>
            <p className="text-2xl font-semibold">{summary.created}</p>
            <p className="text-xs text-muted-foreground">Created</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <SkipForward className="size-5 text-amber-600" />
          <div>
            <p className="text-2xl font-semibold">{summary.skipped}</p>
            <p className="text-xs text-muted-foreground">Skipped</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-lg border p-4">
          <XCircle className="size-5 text-destructive" />
          <div>
            <p className="text-2xl font-semibold">{summary.failed}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </div>
        </div>
      </div>

      {summary.errors.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Errors</p>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-3">
            {summary.errors.map((err) => (
              <div
                key={`${err.row}-${err.reason}`}
                className="flex items-start gap-2 text-sm"
              >
                <Badge variant="outline" className="shrink-0">
                  Row {err.row}
                </Badge>
                <span className="text-muted-foreground">{err.reason}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
