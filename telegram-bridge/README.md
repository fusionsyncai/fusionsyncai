# Telegram bridge (AIOS)

Lean **Node.js** bridge: Telegram DM → `cursor-agent` against this repo, with
per-chat session resume and RecallSync MCP wired automatically.

Same idea as
[`fusionsync-website/scripts/tg_bridge.py`](https://github.com/envisiontechai/envisiontechai-agency/blob/main/scripts/tg_bridge.py),
without Python, Docker, or the Next.js writing-room stack.

## Security

- Only **whitelisted** Telegram user IDs are processed.
- Treat this as **remote code execution** on the host running the bridge.
- Never commit `TELEGRAM_BOT_TOKEN` or share the bot username publicly.

## Prerequisites

1. [Cursor Agent CLI](https://docs.cursor.com/cli) on `PATH` (`cursor-agent --version`).
2. A Telegram bot token from [@BotFather](https://t.me/BotFather).
3. Your numeric Telegram user id (e.g. [@userinfobot](https://t.me/userinfobot)).
4. `RECALL_API_KEY` in repo-root `.env.local` (bridge renders `.cursor/mcp.json` on start).

## Setup

```bash
cd telegram-bridge
npm install
```

Add to repo-root `.env.local` (gitignored):

```bash
TELEGRAM_BOT_TOKEN=123456:ABC...
TELEGRAM_ALLOWED_USER_IDS=123456789
RECALL_API_KEY=your-recallsync-api-key
# optional
RECALLSYNC_MCP_URL=https://mcp.recallsync.com/mcp
CURSOR_AGENT_MODEL=auto
```

## Run

From repo root:

```bash
npm run bridge
```

Or from this folder:

```bash
npm start
```

DM the bot from Telegram. First message starts a session; follow-ups use `--resume`.

## Commands

| Command   | Action                                      |
|-----------|---------------------------------------------|
| `/new`    | Start a fresh cursor-agent session          |
| `/status` | Show repo path, model, session id           |
| `/cancel` | Abort the in-flight agent run (SIGINT)      |

## MCP

On startup, if `RECALL_API_KEY` is set, the bridge writes `.cursor/mcp.json`
(marked `"_renderedBy": "aios-telegram-bridge"`) so `cursor-agent` can call
**recallsync-primary** MCP tools (sync agents, test channel agents, etc.).

If you already maintain a hand-written `.cursor/mcp.json` (no marker), the
bridge leaves it untouched.

## Env reference

| Variable | Required | Default |
|----------|----------|---------|
| `TELEGRAM_BOT_TOKEN` | yes | — |
| `TELEGRAM_ALLOWED_USER_IDS` | yes | comma-separated numeric ids |
| `RECALL_API_KEY` | recommended | renders MCP config |
| `RECALLSYNC_MCP_URL` | no | `https://mcp.recallsync.com/mcp` |
| `CURSOR_AGENT_BIN` | no | `cursor-agent` |
| `CURSOR_AGENT_CWD` | no | repo root |
| `CURSOR_AGENT_MODEL` | no | `auto` |
| `CURSOR_AGENT_AUTO_APPROVE` | no | `1` (`--force --trust`) |
| `CURSOR_AGENT_APPROVE_MCPS` | no | `1` (`--approve-mcps`) |

## VPS / always-on (optional)

Run under `systemd`, `pm2`, or a minimal Docker container with the repo
bind-mounted and `cursor-agent` installed. No compose stack required for v1.
