import { HttpMethod, Prisma } from "@/generated/prisma/client";
import { decrypt, encrypt, isEncrypted } from "@/lib/encryption";
import { prisma } from "@/lib/prisma";

export const httpMethods = Object.values(HttpMethod);

const actionSelect = {
  id: true,
  name: true,
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
  createdAt: true,
} as const;

export type CreateActionInput = {
  name: string;
  method?: string | null;
  url: string;
  headers?: unknown;
  body?: unknown;
  successCriteria?: unknown;
  batchSize?: unknown;
  concurrency?: unknown;
  advanceOnSuccess?: unknown;
  onSuccessTags?: unknown;
  onFailureTags?: unknown;
};

export type UpdateActionInput = {
  name?: string;
  method?: string | null;
  url?: string;
  headers?: unknown;
  body?: unknown;
  successCriteria?: unknown;
  batchSize?: unknown;
  concurrency?: unknown;
  advanceOnSuccess?: unknown;
  onSuccessTags?: unknown;
  onFailureTags?: unknown;
};

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_CONCURRENCY = 5;

// Clamps a throughput knob to a sane positive integer, falling back to a
// default when the input isn't a usable number.
function asPositiveInt(value: unknown, fallback: number): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, 1000);
}

// Coerces a loose truthy/falsey input into a boolean, defaulting when absent.
// Accepts real booleans and the strings "true"/"false" (form/JSON friendly).
function asBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

// Normalizes a tag-id list: keeps non-empty trimmed strings, de-duplicates,
// caps the count. Non-arrays become []. Stored as a Postgres String[].
function asStringIdArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (id) seen.add(id);
    if (seen.size >= 50) break;
  }
  return [...seen];
}

// How the processor decides whether an action "succeeded" for a contact.
// STATUS_CODE: response status must equal statusCode.
// JSON_MATCH:  response JSON at dot-path `key` must equal `value` (string compare).
// Null/absent criteria => any HTTP 2xx counts as success.
export type SuccessCriteria =
  | { type: "STATUS_CODE"; statusCode: number }
  | { type: "JSON_MATCH"; key: string; value: string };

export const successCriteriaTypes = ["STATUS_CODE", "JSON_MATCH"] as const;

function asMethod(value: string | null | undefined): HttpMethod {
  return typeof value === "string" && httpMethods.includes(value as HttpMethod)
    ? (value as HttpMethod)
    : HttpMethod.POST;
}

function asJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// Validates/normalizes a raw success-criteria value into a known shape, or null
// if it isn't a usable criteria (caller then falls back to "any 2xx").
export function parseSuccessCriteria(value: unknown): SuccessCriteria | null {
  const record = asRecord(value);
  if (!record) return null;

  if (record.type === "STATUS_CODE") {
    const statusCode = Number(record.statusCode);
    return Number.isFinite(statusCode)
      ? { type: "STATUS_CODE", statusCode }
      : null;
  }

  if (record.type === "JSON_MATCH") {
    const key = typeof record.key === "string" ? record.key.trim() : "";
    if (!key) return null;
    return { type: "JSON_MATCH", key, value: String(record.value ?? "") };
  }

  return null;
}

function asSuccessCriteria(value: unknown): Prisma.InputJsonValue | undefined {
  const parsed = parseSuccessCriteria(value);
  return parsed ? (parsed as unknown as Prisma.InputJsonValue) : undefined;
}

function resolveResponsePath(body: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[key];
  }, body);
}

// Decides success for a finished request. `criteria` is the action's raw stored
// value (may be null). Falls back to "any HTTP 2xx" when no valid criteria set.
export function evaluateActionSuccess(
  criteria: unknown,
  statusCode: number,
  body: unknown,
): boolean {
  const parsed = parseSuccessCriteria(criteria);

  if (!parsed) {
    return statusCode >= 200 && statusCode < 300;
  }

  if (parsed.type === "STATUS_CODE") {
    return statusCode === parsed.statusCode;
  }

  // JSON_MATCH
  const resolved = resolveResponsePath(body, parsed.key);
  if (resolved == null) return false;
  return String(resolved) === parsed.value;
}

// Encrypts each header VALUE before it's persisted, so the DB (and anyone
// reading it, including the agent) only ever sees ciphertext. Keys stay plain
// (they're not secret). Already-encrypted values are passed through untouched.
function encryptHeaders(value: unknown): Prisma.InputJsonValue | undefined {
  const record = asRecord(value);
  if (!record) return undefined;

  const out: Record<string, string> = {};
  for (const [name, raw] of Object.entries(record)) {
    const key = name.trim();
    if (!key) continue;
    const str = typeof raw === "string" ? raw : String(raw ?? "");
    out[key] = isEncrypted(str) ? str : encrypt(str);
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

// Merge headers on UPDATE using the write-only secret pattern: the client sends
// the desired header set as { name: value }. An EMPTY value means "keep the
// current (already-encrypted) value" — looked up by name from what's stored. A
// non-empty value is a replacement and gets encrypted. Headers absent from the
// incoming set are dropped. Returns undefined when no headers remain.
function mergeHeaders(
  existingValue: unknown,
  incomingValue: unknown,
): Prisma.InputJsonValue | undefined {
  const incoming = asRecord(incomingValue);
  if (!incoming) return undefined;

  const existing = asRecord(existingValue) ?? {};
  const out: Record<string, string> = {};

  for (const [name, raw] of Object.entries(incoming)) {
    const key = name.trim();
    if (!key) continue;
    const str = typeof raw === "string" ? raw : String(raw ?? "");

    if (str === "") {
      // Unchanged — reuse the stored ciphertext for this header name.
      const prev = existing[key];
      if (prev != null) out[key] = String(prev);
    } else {
      out[key] = isEncrypted(str) ? str : encrypt(str);
    }
  }

  return Object.keys(out).length > 0 ? out : undefined;
}

// Decrypts stored header values for the action processor. Legacy plaintext
// values (not in our envelope format) are returned as-is via isEncrypted().
// Server-only — never expose the result to the client/UI.
export function decryptHeaders(value: unknown): Record<string, string> {
  const record = asRecord(value);
  if (!record) return {};

  const out: Record<string, string> = {};
  for (const [name, raw] of Object.entries(record)) {
    if (isEncrypted(raw)) {
      out[name] = decrypt(raw);
    } else if (typeof raw === "string") {
      out[name] = raw;
    } else if (raw != null) {
      out[name] = String(raw);
    }
  }

  return out;
}

export async function listActions() {
  const actions = await prisma.action.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: actionSelect,
  });

  return actions.map((action) => ({
    ...action,
    createdAt: action.createdAt.toISOString(),
  }));
}

export async function createAction(input: CreateActionInput) {
  const action = await prisma.action.create({
    data: {
      name: input.name,
      method: asMethod(input.method),
      url: input.url,
      headers: encryptHeaders(input.headers),
      body: asJson(input.body),
      successCriteria: asSuccessCriteria(input.successCriteria),
      batchSize: asPositiveInt(input.batchSize, DEFAULT_BATCH_SIZE),
      concurrency: asPositiveInt(input.concurrency, DEFAULT_CONCURRENCY),
      advanceOnSuccess: asBool(input.advanceOnSuccess, true),
      onSuccessTags: asStringIdArray(input.onSuccessTags),
      onFailureTags: asStringIdArray(input.onFailureTags),
    },
    select: actionSelect,
  });

  return { ...action, createdAt: action.createdAt.toISOString() };
}

export async function updateAction(id: string, input: UpdateActionInput) {
  const existing = await prisma.action.findUnique({
    where: { id },
    select: { id: true, headers: true },
  });

  if (!existing) return null;

  const data: Prisma.ActionUpdateInput = {};

  if (typeof input.name === "string") data.name = input.name;
  if (input.method !== undefined) data.method = asMethod(input.method);
  if (typeof input.url === "string") data.url = input.url;
  if ("headers" in input) {
    data.headers = mergeHeaders(existing.headers, input.headers) ?? Prisma.JsonNull;
  }
  if ("body" in input) {
    data.body = asJson(input.body) ?? Prisma.JsonNull;
  }
  if ("successCriteria" in input) {
    data.successCriteria =
      asSuccessCriteria(input.successCriteria) ?? Prisma.JsonNull;
  }
  if ("batchSize" in input) {
    data.batchSize = asPositiveInt(input.batchSize, DEFAULT_BATCH_SIZE);
  }
  if ("concurrency" in input) {
    data.concurrency = asPositiveInt(input.concurrency, DEFAULT_CONCURRENCY);
  }
  if ("advanceOnSuccess" in input) {
    data.advanceOnSuccess = asBool(input.advanceOnSuccess, true);
  }
  if ("onSuccessTags" in input) {
    data.onSuccessTags = asStringIdArray(input.onSuccessTags);
  }
  if ("onFailureTags" in input) {
    data.onFailureTags = asStringIdArray(input.onFailureTags);
  }

  const action = await prisma.action.update({
    where: { id: existing.id },
    data,
    select: actionSelect,
  });

  return { ...action, createdAt: action.createdAt.toISOString() };
}

export async function deleteAction(id: string) {
  const action = await prisma.action.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!action) return null;

  await prisma.action.delete({ where: { id: action.id } });
  return { id: action.id };
}
