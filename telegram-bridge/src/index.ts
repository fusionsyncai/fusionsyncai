/**
 * Telegram bridge → cursor-agent for the AIOS repo.
 *
 * WARNING: whitelisted Telegram users can run arbitrary agent work on this
 * machine (MCP tools, git, etc.). Keep the bot token private.
 *
 * Commands: /new  /status  /cancel
 */
import type { ChildProcess } from "node:child_process";
import { config, REPO_ROOT } from "./config.js";
import { runCursorAgent } from "./cursor-agent.js";
import { logInfo, logWarn } from "./logging.js";
import { renderRecallsyncMcp } from "./mcp.js";

import { config as loadEnv } from "dotenv";
import { resolve } from "node:path";
import { Bot, Context } from "grammy";

loadEnv({ path: resolve(REPO_ROOT, ".env.local") });
loadEnv({ path: resolve(REPO_ROOT, ".env") });
loadEnv({ path: resolve(REPO_ROOT, "telegram-bridge", ".env") });

type ChatState = {
  sessionId: string | null;
  proc: ChildProcess | null;
  startedAt: number | null;
};

const chatState = new Map<number, ChatState>();

function stateFor(chatId: number): ChatState {
  let s = chatState.get(chatId);
  if (!s) {
    s = { sessionId: null, proc: null, startedAt: null };
    chatState.set(chatId, s);
  }
  return s;
}

function isAllowed(ctx: Context, allowed: Set<number>): boolean {
  const id = ctx.from?.id;
  return id !== undefined && allowed.has(id);
}

async function sendChunks(
  bot: Bot["api"],
  chatId: number,
  text: string
): Promise<void> {
  const body = text.trim() || "(empty agent response)";
  for (let i = 0; i < body.length; i += config.maxReplyChunk) {
    const chunk = body.slice(i, i + config.maxReplyChunk);
    try {
      await bot.sendMessage(chatId, chunk);
    } catch (err) {
      logWarn(`failed to send chunk to ${chatId}:`, err);
      break;
    }
  }
}

function startTypingLoop(
  bot: Bot["api"],
  chatId: number,
  signal: AbortSignal
): void {
  const tick = async () => {
    while (!signal.aborted) {
      try {
        await bot.sendChatAction(chatId, "typing");
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, config.typingRefreshMs));
    }
  };
  void tick();
}

async function main(): Promise<void> {
  renderRecallsyncMcp(REPO_ROOT);

  const allowed = config.allowedUserIds();
  const bot = new Bot(config.botToken());

  bot.command("new", async (ctx) => {
    if (!isAllowed(ctx, allowed) || ctx.chat?.id === undefined) return;
    stateFor(ctx.chat.id).sessionId = null;
    await ctx.reply("Started a fresh cursor-agent session.");
  });

  bot.command("status", async (ctx) => {
    if (!isAllowed(ctx, allowed) || ctx.chat?.id === undefined) return;
    const s = stateFor(ctx.chat.id);
    const lines = [
      `Repo: ${config.cursorAgentCwd}`,
      `Model: ${config.cursorModel}`,
      `Session: ${s.sessionId ?? "(none yet)"}`,
    ];
    if (s.proc && s.startedAt) {
      lines.push(
        `In-flight run: elapsed ${Math.floor((Date.now() - s.startedAt) / 1000)}s`
      );
    }
    await ctx.reply(lines.join("\n"));
  });

  bot.command("cancel", async (ctx) => {
    if (!isAllowed(ctx, allowed) || ctx.chat?.id === undefined) return;
    const s = stateFor(ctx.chat.id);
    if (!s.proc) {
      await ctx.reply("No agent run in progress.");
      return;
    }
    s.proc.kill("SIGINT");
    s.proc = null;
    s.startedAt = null;
    await ctx.reply("Cancelled in-flight run.");
  });

  bot.on("message:text", async (ctx) => {
    const userId = ctx.from?.id;
    if (userId === undefined || !allowed.has(userId)) {
      logInfo(`ignored message from non-whitelisted user ${userId ?? "?"}`);
      return;
    }
    const chatId = ctx.chat?.id;
    if (chatId === undefined) return;

    const prompt = ctx.message.text.trim();
    if (!prompt || prompt.startsWith("/")) return;

    const state = stateFor(chatId);
    if (state.proc) {
      await ctx.reply(
        "An agent run is still in progress. Send /cancel to abort or wait."
      );
      return;
    }

    const typingAbort = new AbortController();
    state.startedAt = Date.now();
    startTypingLoop(ctx.api, chatId, typingAbort.signal);

    try {
      const { reply, sessionId, exitCode } = await runCursorAgent(
        prompt,
        state.sessionId,
        (proc) => {
          state.proc = proc;
        }
      );
      if (sessionId) state.sessionId = sessionId;

      let out = reply;
      if (exitCode !== 0 && !out.trim()) {
        out = `(cursor-agent exited with code ${exitCode})`;
      }
      await sendChunks(ctx.api, chatId, out);
      if (sessionId) logInfo(`chat ${chatId} -> session ${sessionId}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("ENOENT")) {
        await ctx.reply(
          `Could not find \`${config.cursorAgentBin}\` on PATH. Install Cursor Agent CLI or set CURSOR_AGENT_BIN.`
        );
      } else {
        logWarn("agent run crashed:", err);
        await ctx.reply(`Agent run crashed: ${msg}`);
      }
    } finally {
      typingAbort.abort();
      state.proc = null;
      state.startedAt = null;
    }
  });

  logInfo("starting telegram bridge (AIOS)");
  logInfo(`repo cwd: ${config.cursorAgentCwd}`);
  logInfo(`allowed user ids: ${[...allowed].sort((a, b) => a - b).join(", ")}`);
  logInfo(
    `cursor-agent: ${config.cursorAgentBin} (model=${config.cursorModel})`
  );
  logInfo(
    `auto approvals: force/trust=${config.autoApprove}, approve_mcps=${config.approveMcps}`
  );

  await bot.start({ drop_pending_updates: true });
}

main().catch((err) => {
  console.error("[tg-bridge] fatal:", err);
  process.exit(1);
});
