import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { getConfig, loadEnvFiles, REPO_ROOT } from "./config.js";
import { logInfo, logWarn } from "./logging.js";
import { researchCompany } from "./agent.js";
import {
  enrichRequestSchema,
  type EnrichRequest,
  type EnrichmentResult,
  type Job,
} from "./schema.js";

loadEnvFiles();

const config = getConfig();
const jobs = new Map<string, Job>();
const queue: Job[] = [];
let activeWorkers = 0;

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function methodNotAllowed(res: ServerResponse): void {
  json(res, 405, { error: "Method not allowed" });
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1024 * 1024) {
      throw new Error("Request body too large");
    }
    chunks.push(buffer);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : null;
}

function now(): string {
  return new Date().toISOString();
}

function summarizeJob(job: Job) {
  return {
    id: job.id,
    contactId: job.request.contactId,
    status: job.status,
    attempts: job.attempts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    error: job.error,
  };
}

function enqueue(request: EnrichRequest): Job {
  const timestamp = now();
  const job: Job = {
    id: randomUUID(),
    request,
    status: "queued",
    attempts: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    error: null,
  };
  jobs.set(job.id, job);
  queue.push(job);
  drainQueue();
  return job;
}

async function postCallback(
  job: Job,
  payload: {
    status: "RUNNING" | "ENRICHED" | "FAILED";
    enrichment?: EnrichmentResult;
    error?: string;
  },
): Promise<void> {
  if (!config.callbackSecret) {
    throw new Error("ENRICHMENT_CALLBACK_SECRET is not configured");
  }

  const response = await fetch(job.request.callbackUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.callbackSecret}`,
    },
    body: JSON.stringify({
      jobId: job.id,
      contactId: job.request.contactId,
      // Echo the caller's advancement gate so the CRM can decide whether to
      // advance the contact out of its parked (WAITING) stage.
      advanceWhen: job.request.advanceWhen ?? null,
      ...payload,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Callback failed (${response.status})${text ? `: ${text.slice(0, 500)}` : ""}`,
    );
  }
}

async function runJob(job: Job): Promise<void> {
  activeWorkers++;
  job.status = "running";
  job.attempts++;
  job.updatedAt = now();
  logInfo(`[enrichment] job ${job.id} contact ${job.request.contactId} started`);

  try {
    await postCallback(job, { status: "RUNNING" });
    const enrichment = await researchCompany(job.request);
    await postCallback(job, { status: "ENRICHED", enrichment });
    job.status = "succeeded";
    job.updatedAt = now();
    logInfo(`[enrichment] job ${job.id} contact ${job.request.contactId} succeeded`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    job.status = "failed";
    job.error = message;
    job.updatedAt = now();
    logWarn(`[enrichment] job ${job.id} failed: ${message}`);

    try {
      await postCallback(job, { status: "FAILED", error: message });
    } catch (callbackErr) {
      logWarn(`[enrichment] failure callback for ${job.id} failed:`, callbackErr);
    }
  } finally {
    activeWorkers--;
    drainQueue();
  }
}

function drainQueue(): void {
  while (activeWorkers < config.concurrency && queue.length > 0) {
    const next = queue.shift();
    if (!next) return;
    void runJob(next);
  }
}

async function handleEnrich(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.method !== "POST") return methodNotAllowed(res);

  const body = await readJson(req);
  const parsed = enrichRequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(res, 400, {
      error: "Invalid enrichment request",
      issues: parsed.error.issues,
    });
  }

  const job = enqueue(parsed.data);
  return json(res, 202, { jobId: job.id, status: job.status });
}

function handleJob(url: URL, res: ServerResponse): void {
  const id = url.pathname.split("/")[2];
  if (!id) return json(res, 404, { error: "Job not found" });
  const job = jobs.get(id);
  if (!job) return json(res, 404, { error: "Job not found" });
  return json(res, 200, { job: summarizeJob(job) });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

    if (url.pathname === "/health") {
      if (req.method !== "GET") return methodNotAllowed(res);
      return json(res, 200, {
        status: "healthy",
        queue: queue.length,
        activeWorkers,
      });
    }

    if (url.pathname === "/enrich") {
      return handleEnrich(req, res);
    }

    if (url.pathname.startsWith("/jobs/")) {
      if (req.method !== "GET") return methodNotAllowed(res);
      return handleJob(url, res);
    }

    return json(res, 404, { error: "Not found" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return json(res, 500, { error: message });
  }
}

const server = createServer((req, res) => {
  void handle(req, res);
});

server.listen(config.port, () => {
  logInfo(`[enrichment] listening on :${config.port}`);
  logInfo(`[enrichment] repo cwd: ${config.cursorAgentCwd}`);
  logInfo(`[enrichment] repo root: ${REPO_ROOT}`);
  logInfo(
    `[enrichment] cursor-agent: ${config.cursorAgentBin} (model=${config.cursorModel})`,
  );
  logInfo(`[enrichment] concurrency: ${config.concurrency}`);
});
