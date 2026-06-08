"use client";

import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { TagPicker, type TagOption } from "@/components/tags/tag-picker";

type Action = {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: unknown;
  body: unknown;
  successCriteria: unknown;
  batchSize: number;
  concurrency: number;
  onSuccessTags?: string[];
  onFailureTags?: string[];
  createdAt: string;
};

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 5;

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

const methodItems = Object.fromEntries(
  HTTP_METHODS.map((method) => [method, method]),
);

// Success criteria: how the processor decides an action "succeeded".
const SUCCESS_TYPES = ["DEFAULT", "STATUS_CODE", "JSON_MATCH"] as const;
type SuccessType = (typeof SUCCESS_TYPES)[number];

const successTypeLabels: Record<SuccessType, string> = {
  DEFAULT: "Any HTTP 2xx (default)",
  STATUS_CODE: "Status code equals",
  JSON_MATCH: "Response JSON key = value",
};

const successTypeItems = Object.fromEntries(
  SUCCESS_TYPES.map((t) => [t, successTypeLabels[t]]),
);

function successToState(criteria: unknown): {
  type: SuccessType;
  statusCode: string;
  key: string;
  value: string;
} {
  const empty = { type: "DEFAULT" as SuccessType, statusCode: "", key: "", value: "" };
  if (criteria === null || typeof criteria !== "object") return empty;
  const c = criteria as Record<string, unknown>;
  if (c.type === "STATUS_CODE") {
    return { ...empty, type: "STATUS_CODE", statusCode: String(c.statusCode ?? "") };
  }
  if (c.type === "JSON_MATCH") {
    return {
      ...empty,
      type: "JSON_MATCH",
      key: String(c.key ?? ""),
      value: String(c.value ?? ""),
    };
  }
  return empty;
}

// `existing` marks a header that was loaded from a saved action — its value is
// already encrypted server-side and is intentionally NOT shown. Leaving the
// value blank keeps it; typing replaces it (write-only secret pattern).
type HeaderRow = { name: string; value: string; existing?: boolean };

const emptyHeaderRow: HeaderRow = { name: "", value: "" };

function headersToRows(headers: unknown): HeaderRow[] {
  if (headers === null || typeof headers !== "object" || Array.isArray(headers)) {
    return [{ ...emptyHeaderRow }];
  }
  const names = Object.keys(headers as Record<string, unknown>);
  if (names.length === 0) return [{ ...emptyHeaderRow }];
  return names.map((name) => ({ name, value: "", existing: true }));
}

function bodyToText(body: unknown): string {
  if (body === null || body === undefined) return "";
  return JSON.stringify(body, null, 2);
}

export default function ActionsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [method, setMethod] = useState("POST");
  const [url, setUrl] = useState("");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>([
    { ...emptyHeaderRow },
  ]);
  const [body, setBody] = useState("");
  const [successType, setSuccessType] = useState<SuccessType>("DEFAULT");
  const [successStatusCode, setSuccessStatusCode] = useState("");
  const [successKey, setSuccessKey] = useState("");
  const [successValue, setSuccessValue] = useState("");
  const [batchSize, setBatchSize] = useState(String(DEFAULT_BATCH_SIZE));
  const [concurrency, setConcurrency] = useState(String(DEFAULT_CONCURRENCY));
  const [tags, setTags] = useState<TagOption[]>([]);
  const [successTagIds, setSuccessTagIds] = useState<string[]>([]);
  const [failureTagIds, setFailureTagIds] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionToDelete, setActionToDelete] = useState<Action | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const isEditing = editingId !== null;

  function resetForm() {
    setEditingId(null);
    setName("");
    setMethod("POST");
    setUrl("");
    setHeaderRows([{ ...emptyHeaderRow }]);
    setBody("");
    setSuccessType("DEFAULT");
    setSuccessStatusCode("");
    setSuccessKey("");
    setSuccessValue("");
    setBatchSize(String(DEFAULT_BATCH_SIZE));
    setConcurrency(String(DEFAULT_CONCURRENCY));
    setSuccessTagIds([]);
    setFailureTagIds([]);
    setFormError(null);
  }

  function loadForEdit(action: Action) {
    setEditingId(action.id);
    setName(action.name);
    setMethod(action.method);
    setUrl(action.url);
    setHeaderRows(headersToRows(action.headers));
    setBody(bodyToText(action.body));
    const s = successToState(action.successCriteria);
    setSuccessType(s.type);
    setSuccessStatusCode(s.statusCode);
    setSuccessKey(s.key);
    setSuccessValue(s.value);
    setBatchSize(String(action.batchSize ?? DEFAULT_BATCH_SIZE));
    setConcurrency(String(action.concurrency ?? DEFAULT_CONCURRENCY));
    setSuccessTagIds(action.onSuccessTags ?? []);
    setFailureTagIds(action.onFailureTags ?? []);
    setFormError(null);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function addHeaderRow() {
    setHeaderRows((rows) => [...rows, { ...emptyHeaderRow }]);
  }

  function updateHeaderRow(index: number, patch: Partial<HeaderRow>) {
    setHeaderRows((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  }

  function removeHeaderRow(index: number) {
    setHeaderRows((rows) => {
      const next = rows.filter((_, i) => i !== index);
      return next.length > 0 ? next : [{ ...emptyHeaderRow }];
    });
  }

  const loadActions = useCallback(async () => {
    const response = await fetch("/api/actions", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load actions");
    }
    const data = (await response.json()) as { actions: Action[] };
    setActions(data.actions);
  }, []);

  const loadTags = useCallback(async () => {
    const response = await fetch("/api/tags", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { tags: TagOption[] };
      setTags(data.tags);
    }
  }, []);

  // Creates (or reuses) a tag by name and returns its id for auto-selection.
  const createTag = useCallback(
    async (name: string): Promise<string | null> => {
      const response = await fetch("/api/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { tag: TagOption };
      await loadTags();
      return data.tag.id;
    },
    [loadTags],
  );

  useEffect(() => {
    void (async () => {
      try {
        setError(null);
        await Promise.all([loadActions(), loadTags()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        setIsLoading(false);
      }
    })();
  }, [loadActions, loadTags]);

  function parseOptionalJson(value: string, label: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      throw new Error(`${label} must be valid JSON`);
    }
  }

  async function handleSubmit() {
    if (isSaving) return;
    setFormError(null);

    if (!name.trim() || !url.trim()) {
      setFormError("Name and URL are required");
      return;
    }

    // Build the header set. For a NEW header the value is required; for an
    // existing one an empty value means "keep current" (sent as "").
    const headersObject: Record<string, string> = {};
    for (const row of headerRows) {
      const headerName = row.name.trim();
      if (!headerName) continue;
      if (!row.value.trim() && !row.existing) {
        setFormError(`Header "${headerName}" has no value`);
        return;
      }
      headersObject[headerName] = row.value;
    }
    // Always send the headers object so removed headers are dropped on update.
    const parsedHeaders = headersObject;

    let parsedBody: unknown;
    try {
      parsedBody = parseOptionalJson(body, "Body");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid JSON");
      return;
    }

    // Build success criteria. DEFAULT => null (any 2xx).
    let successCriteria: unknown = null;
    if (successType === "STATUS_CODE") {
      const code = Number(successStatusCode.trim());
      if (!Number.isFinite(code)) {
        setFormError("Success status code must be a number");
        return;
      }
      successCriteria = { type: "STATUS_CODE", statusCode: code };
    } else if (successType === "JSON_MATCH") {
      const key = successKey.trim();
      if (!key) {
        setFormError("Success JSON key is required");
        return;
      }
      successCriteria = { type: "JSON_MATCH", key, value: successValue };
    }

    const batchSizeNum = Number(batchSize.trim());
    if (!Number.isInteger(batchSizeNum) || batchSizeNum < 1) {
      setFormError("Batch size must be a whole number ≥ 1");
      return;
    }
    const concurrencyNum = Number(concurrency.trim());
    if (!Number.isInteger(concurrencyNum) || concurrencyNum < 1) {
      setFormError("Concurrency must be a whole number ≥ 1");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(
        isEditing ? `/api/actions/${editingId}` : "/api/actions",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            method,
            url: url.trim(),
            headers: parsedHeaders,
            body: parsedBody ?? null,
            successCriteria,
            batchSize: batchSizeNum,
            concurrency: concurrencyNum,
            onSuccessTags: successTagIds,
            onFailureTags: failureTagIds,
          }),
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          data?.error ??
            (isEditing ? "Failed to update action" : "Failed to create action"),
        );
      }

      resetForm();
      await loadActions();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!actionToDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/actions/${actionToDelete.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete action");
      }
      if (editingId === actionToDelete.id) resetForm();
      setActionToDelete(null);
      await loadActions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Actions</h1>
        <p className="text-sm text-muted-foreground">
          Reusable HTTP calls (webhooks/endpoints) you can attach to pipeline
          stages.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEditing ? "Edit action" : "New action"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[140px_1fr]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Method
              </label>
              <Select
                items={methodItems}
                value={method}
                onValueChange={(value) => setMethod(value as string)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HTTP_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Verify email"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              URL
            </label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-muted-foreground">
                Headers (optional)
              </label>
              <span className="text-xs text-muted-foreground">
                Values are encrypted at rest
              </span>
            </div>
            <div className="space-y-2">
              {headerRows.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={row.name}
                    onChange={(e) =>
                      updateHeaderRow(index, { name: e.target.value })
                    }
                    placeholder="Header name (e.g. Authorization)"
                    className="flex-1"
                  />
                  <Input
                    value={row.value}
                    onChange={(e) =>
                      updateHeaderRow(index, { value: e.target.value })
                    }
                    placeholder={
                      row.existing
                        ? "•••••••• (unchanged — type to replace)"
                        : "Value (e.g. Bearer ...)"
                    }
                    className="flex-1 font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-9 shrink-0 text-destructive hover:text-destructive"
                    aria-label="Remove header"
                    onClick={() => removeHeaderRow(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addHeaderRow}
            >
              <Plus className="size-4" />
              Add header
            </Button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Body (JSON, optional)
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={'{ "key": "value" }'}
              className="min-h-20 w-full rounded-lg border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Success criteria
            </label>
            <p className="text-xs text-muted-foreground">
              How the processor decides this action succeeded (and the contact
              advances to the next stage).
            </p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr]">
              <Select
                items={successTypeItems}
                value={successType}
                onValueChange={(value) => setSuccessType(value as SuccessType)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUCCESS_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {successTypeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {successType === "STATUS_CODE" ? (
                <Input
                  value={successStatusCode}
                  onChange={(e) => setSuccessStatusCode(e.target.value)}
                  placeholder="e.g. 200"
                  inputMode="numeric"
                />
              ) : null}

              {successType === "JSON_MATCH" ? (
                <div className="flex gap-2">
                  <Input
                    value={successKey}
                    onChange={(e) => setSuccessKey(e.target.value)}
                    placeholder="key (e.g. status or data.ok)"
                    className="flex-1 font-mono text-xs"
                  />
                  <Input
                    value={successValue}
                    onChange={(e) => setSuccessValue(e.target.value)}
                    placeholder="value (e.g. valid)"
                    className="flex-1 font-mono text-xs"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Tag on success
              </label>
              <p className="text-xs text-muted-foreground">
                Added to the contact when the action succeeds (label only —
                doesn&apos;t change the stage).
              </p>
              <TagPicker
                tags={tags}
                value={successTagIds}
                onChange={setSuccessTagIds}
                onCreate={createTag}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Tag on failure
              </label>
              <p className="text-xs text-muted-foreground">
                Added when success criteria isn&apos;t met (e.g.
                &quot;invalid-email&quot;). The contact stays parked as failed.
              </p>
              <TagPicker
                tags={tags}
                value={failureTagIds}
                onChange={setFailureTagIds}
                onCreate={createTag}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Batch size
              </label>
              <Input
                value={batchSize}
                onChange={(e) => setBatchSize(e.target.value)}
                placeholder={String(DEFAULT_BATCH_SIZE)}
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                Max contacts processed per run for stages using this action.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Concurrency
              </label>
              <Input
                value={concurrency}
                onChange={(e) => setConcurrency(e.target.value)}
                placeholder={String(DEFAULT_CONCURRENCY)}
                inputMode="numeric"
              />
              <p className="text-xs text-muted-foreground">
                Requests run in parallel at once (caps load on the target).
              </p>
            </div>
          </div>

          {formError ? (
            <p className="text-sm text-destructive">{formError}</p>
          ) : null}

          <div className="flex items-center gap-2">
            <Button onClick={() => void handleSubmit()} disabled={isSaving}>
              <Plus className="size-4" />
              {isSaving
                ? isEditing
                  ? "Saving..."
                  : "Creating..."
                : isEditing
                  ? "Save changes"
                  : "Create action"}
            </Button>
            {isEditing ? (
              <Button
                variant="ghost"
                onClick={resetForm}
                disabled={isSaving}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-card">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">
            Loading actions...
          </div>
        ) : error ? (
          <div className="p-6 text-sm text-destructive">{error}</div>
        ) : actions.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">
            No actions yet. Create one above.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>URL</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {actions.map((action) => (
                <TableRow key={action.id}>
                  <TableCell className="font-medium">{action.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{action.method}</Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate font-mono text-xs text-muted-foreground">
                    {action.url}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7"
                        aria-label="Edit action"
                        onClick={() => loadForEdit(action)}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="size-7 text-destructive hover:text-destructive"
                        aria-label="Delete action"
                        onClick={() => setActionToDelete(action)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog
        open={actionToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setActionToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete action?</AlertDialogTitle>
            <AlertDialogDescription>
              {actionToDelete
                ? `This permanently deletes the "${actionToDelete.name}" action. Any pipeline stage using it will have its action cleared. This can't be undone.`
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
            >
              {isDeleting ? "Deleting..." : "Delete action"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
