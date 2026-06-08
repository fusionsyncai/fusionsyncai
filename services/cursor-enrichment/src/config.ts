import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const serviceDir = fileURLToPath(new URL(".", import.meta.url));

/** Repo root (fusionsyncai/), three levels up from services/cursor-enrichment/src. */
export const REPO_ROOT = resolve(serviceDir, "../../..");

export function loadEnvFiles(): void {
  loadEnv({ path: resolve(REPO_ROOT, ".env.local") });
  loadEnv({ path: resolve(REPO_ROOT, ".env") });
  loadEnv({ path: resolve(REPO_ROOT, "services", "cursor-enrichment", ".env") });
}

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function envInt(name: string, defaultValue: number): number {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : defaultValue;
}

export function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

// crawl4ai base URL: defaults to the docker-compose service on :11235. Set
// CRAWL4AI_URL="" to disable (the agent then won't be told the tool exists).
function crawl4aiUrl(): string {
  const raw = process.env.CRAWL4AI_URL?.trim();
  return raw === undefined ? "http://localhost:11235" : raw;
}

export function getConfig() {
  const port = envInt("CURSOR_ENRICHMENT_PORT", 5070);
  const concurrency = Math.min(envInt("ENRICH_CONCURRENCY", 3), 10);

  return {
    port,
    concurrency,
    cursorAgentBin: process.env.CURSOR_AGENT_BIN?.trim() || "cursor-agent",
    cursorAgentCwd: process.env.CURSOR_AGENT_CWD?.trim() || REPO_ROOT,
    cursorModel: process.env.CURSOR_AGENT_MODEL?.trim() || "auto",
    autoApprove: envFlag("CURSOR_AGENT_AUTO_APPROVE", true),
    requestTimeoutMs: envInt("ENRICH_AGENT_TIMEOUT_MS", 10 * 60_000),
    callbackSecret: process.env.ENRICHMENT_CALLBACK_SECRET?.trim() || "",
    // JS-rendering crawler the agent can shell out to for social/profile pages.
    crawl4aiUrl: crawl4aiUrl(),
    crawl4aiToken: process.env.CRAWL4AI_API_TOKEN?.trim() || "",
  };
}
