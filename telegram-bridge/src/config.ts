import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const bridgeDir = fileURLToPath(new URL(".", import.meta.url));

/** Repo root (fusionsyncai/), two levels up from telegram-bridge/src */
export const REPO_ROOT = resolve(bridgeDir, "../..");

export function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export function parseUserIds(raw: string): Set<number> {
  const ids = new Set<number>();
  for (const token of raw.split(",")) {
    const t = token.trim();
    if (!t) continue;
    const n = Number(t);
    if (Number.isFinite(n)) ids.add(n);
    else console.warn(`[tg-bridge] ignoring non-numeric user id: ${t}`);
  }
  return ids;
}

export function envFlag(name: string, defaultValue = false): boolean {
  const raw = process.env[name];
  if (raw === undefined) return defaultValue;
  return ["1", "true", "yes", "on"].includes(raw.trim().toLowerCase());
}

export const config = {
  botToken: () => requiredEnv("TELEGRAM_BOT_TOKEN"),
  allowedUserIds: () => {
    const ids = parseUserIds(requiredEnv("TELEGRAM_ALLOWED_USER_IDS"));
    if (ids.size === 0) {
      throw new Error("TELEGRAM_ALLOWED_USER_IDS resolved to empty set");
    }
    return ids;
  },
  cursorAgentBin: process.env.CURSOR_AGENT_BIN?.trim() || "cursor-agent",
  cursorAgentCwd: process.env.CURSOR_AGENT_CWD?.trim() || REPO_ROOT,
  cursorModel: process.env.CURSOR_AGENT_MODEL?.trim() || "auto",
  autoApprove: envFlag("CURSOR_AGENT_AUTO_APPROVE", true),
  approveMcps: envFlag("CURSOR_AGENT_APPROVE_MCPS", true),
  recallsyncMcpUrl:
    process.env.RECALLSYNC_MCP_URL?.trim() || "https://mcp.recallsync.com/mcp",
  maxReplyChunk: 3500,
  typingRefreshMs: 4500,
};
