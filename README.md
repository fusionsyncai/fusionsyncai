<div align="center">

# FusionSync AIOS

**A repository-driven AI Operating System for running a business's AI agents from Git.**

Define your agents, their prompts, their conversation flows, and your operating procedures as
plain files in this repo — then push them to the live runtime ([RecallSync](#the-runtime-recallsync))
over [MCP](https://modelcontextprotocol.io). Your AI workforce becomes **version-controlled,
reviewable, and reproducible**.

</div>

---

## Table of contents

- [The idea](#the-idea)
- [Vision](#vision)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Core concepts](#core-concepts)
- [Getting started](#getting-started)
- [Standard Operating Procedures (SOPs)](#standard-operating-procedures-sops)
- [Security & secrets](#security--secrets)
- [Roadmap & sprints](#roadmap--sprints)
- [Conventions](#conventions)

---

## The idea

Most teams operate AI agents through dashboards: prompts live in a web UI, flows are edited in a
canvas, and there is no history, no review, and no single source of truth. When something breaks,
nobody knows what changed.

**AIOS treats the business's AI operations as code.** Everything that defines _behavior_ —
agent prompts, conversation flows, tool specs, and the procedures for running campaigns — lives in
this Git repository. The live platform becomes a **runtime**, not the source of truth. You change a
prompt in a Markdown file, review it like any other code change, and sync it to production.

> One repo = **one business** = one RecallSync sub-account.

What stays out of the repo: **operational data** (leads, conversations, results) and **secrets**
(API tokens, auth headers). Those live in the runtime. The repo only holds _authored intent_.

---

## Vision

- **Git as the brain.** Prompts and flows are reviewed, diffed, and versioned like source code.
- **Repeatable operations.** Anything done more than once becomes an [SOP](#standard-operating-procedures-sops) — a checklist a human _or_ an AI agent can follow literally.
- **AI-native workflow.** The repo is designed to be driven from [Cursor](https://cursor.com): an agent reads the context, follows the SOPs, and pushes changes through MCP tools.
- **Safe by construction.** Secrets are normalized to `${PLACEHOLDER}` in committed files and only resolved at push time; a [pre-commit sanity check](#security--secrets) blocks leaks.
- **Composable.** Once the core loop (_define → push → run_) works for one agent, every future agent and campaign is "more of the same on the same rails."

---

## How it works

The core loop AIOS is built around:

```
   define in repo  ──▶  push via MCP  ──▶  run on RecallSync
   (prompt / flow)      (Cursor agent)     (live channel agent)
        ▲                                         │
        └──────────────  pull / sync  ◀───────────┘
                     (live → repo, secrets normalized)
```

1. **Define** an agent's behavior in `agents/` (a Markdown prompt or a JSON flow graph).
2. **Pull** the latest live state first (so you never edit a stale copy).
3. **Edit & review** the change as a normal Git diff.
4. **Push** it to RecallSync through an MCP tool — a local script reconciles + encrypts secrets first.
5. **Test** the agent in-place using the test harness, iterate, commit.

---

## Architecture

AIOS sits on top of a three-repo chain. This repo is the **client / brain**; it never talks to the
database directly.

```
AIOS (this repo)  ──MCP (StreamableHTTP /mcp)──▶  recallsync-mcp  ──REST (Bearer api_key)──▶  recallsync-app  ──Prisma──▶  DB
   Cursor calls tool          forwards api_key header        thin tool → fetch              tRPC business router        MySQL
```

- **AIOS** — this repository. Authored prompts/flows/SOPs. Driven from Cursor via MCP tools.
- **recallsync-mcp** — an Express [MCP](https://modelcontextprotocol.io) server. Thin tools:
  validate input → call REST → return result. The `/mcp` route forwards the caller's `api_key`.
- **recallsync-app** — Next.js app. REST routes under `/api/rest/*` wrap business-context tRPC
  routers, which resolve the business from `Authorization: Bearer <api_key>`.

See [`recallsync/`](./recallsync) for the system/engineering layer, including
[`add-mcp-operation.md`](./recallsync/add-mcp-operation.md) — how to add a new MCP tool end-to-end.

---

## Repository structure

```
fusionsyncai/
├── agents/                 # AI agents as files (mirrors RecallSync's model)
│   ├── _template/          # copy this to create a new primary agent
│   └── primary-agent/
│       └── <name>/         # = a RecallSync PrimaryAgent (wrapper; no prompt)
│           ├── primary-agent.yaml
│           └── <channel>/  # email | whatsapp | sms | voice-call ... (= a BaseAgent)
│               ├── channel-agent.yaml          # link: id, channel, provider, type, sync state
│               ├── channel-agent-prompt.md     # STANDARD agents — single system prompt
│               ├── channel-agent-flow.json     # FLOW agents — exported flow graph (v2)
│               └── tools/                      # non-secret tool specs
├── context/                # business context the agents read before acting
├── sops/                   # Standard Operating Procedures (repeatable checklists)
│   └── channel-agent/      # creation, prompting, tool-calls, testing, sync, troubleshooting
├── playbooks/              # campaign definitions (objective, ICP, offer, sequence)
├── sprints/                # what we're building now + decision log
├── recallsync/             # system layer: MCP integration docs & how-tos
├── scripts/                # repo tooling (e.g. precommit-sanity.sh)
├── telegram-bridge/        # Node.js Telegram → cursor-agent bridge (optional)
└── .env.example            # secret registry — names + purpose only (no values)
```

---

## Core concepts

The folder model mirrors the RecallSync schema:

| Concept                       | In the repo                    | What it is                                                                                                         |
| ----------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| **Business**                  | the whole repo                 | One RecallSync sub-account, fixed by the api key.                                                                  |
| **PrimaryAgent**              | `agents/primary-agent/<name>/` | A wrapper that groups channel agents. Carries the goal, completion criteria, and stop scenario. **Has no prompt.** |
| **BaseAgent** (channel agent) | `<name>/<channel>/`            | The actual per-channel worker. Has a `channel`, a `provider`, and a `baseAgentType`.                               |

**Channel agent types:**

- **`STANDARD`** — a single system prompt (`channel-agent-prompt.md`). Best for simpler,
  single-objective agents.
- **`FLOW`** — a graph of nodes (`channel-agent-flow.json`) for scalable, reliable, multi-step
  logic. Node types include objective, send-message, condition, HTTP/tool-call, and end.

---

## Getting started

### Prerequisites

- [Cursor](https://cursor.com) (this repo is designed to be operated by its agent).
- Access to a RecallSync sub-account and its **api key**.
- The `recallsync-mcp` server running (or its hosted endpoint).

### 1. Configure secrets

Secrets never get committed. Copy the registry and fill values locally:

```bash
cp .env.example .env.local   # .env.local is gitignored
```

`.env.local` holds the real values for the names declared in `.env.example`, e.g.
`RECALL_API_KEY` and `AIOS_N8N_WEBHOOK_TOKEN`.

### 2. Connect the MCP

Add the RecallSync primary MCP to Cursor. A template lives at
[`.cursor/.mcp.example.json`](./.cursor/.mcp.example.json); your real config goes in
`.cursor/mcp.json` (**gitignored** — it holds the api key).

### 3. Drive it from Cursor

Ask the agent to do work — it reads `context/`, follows the relevant SOP, and calls MCP tools.
Typical first tasks:

- "List the primary agents." → confirms the MCP connection.
- "Create an email channel agent for Brain." → follows [`sops/channel-agent/creation.md`](./sops/channel-agent/creation.md).
- "Update the WhatsApp agent flow." → pulls latest, edits the flow JSON, pushes the draft.

### 4. Telegram bridge (optional)

Run AIOS from your phone: a whitelisted Telegram DM spawns `cursor-agent` against
this repo with RecallSync MCP tools available.

```bash
# Add TELEGRAM_BOT_TOKEN + TELEGRAM_ALLOWED_USER_IDS to .env.local (see .env.example)
npm run bridge
```

Lean Node.js port of the
[fusionsync-website Telegram bridge](https://github.com/envisiontechai/envisiontechai-agency/blob/main/scripts/tg_bridge.py) —
no Python venv or Docker stack required for local use. See
[`telegram-bridge/README.md`](./telegram-bridge/README.md).

---

## Standard Operating Procedures (SOPs)

An SOP is a **repeatable, documented process** written as a checklist that a human or an AI agent
can follow literally. If something is done more than once, it becomes an SOP.

| SOP                                                                                     | Purpose                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| [`channel-agent/creation.md`](./sops/channel-agent/creation.md)                         | Create a new channel agent (channel/provider rules, defaults).      |
| [`channel-agent/prompting-standard.md`](./sops/channel-agent/prompting-standard.md)     | Author a great system prompt for a STANDARD agent.                  |
| [`channel-agent/prompting-flow.md`](./sops/channel-agent/prompting-flow.md)             | Design a FLOW agent's graph (nodes, objectives, routing).           |
| [`channel-agent/tool-calls.md`](./sops/channel-agent/tool-calls.md)                     | Wire and verify HTTP tool calls (with auth).                        |
| [`channel-agent/testing.md`](./sops/channel-agent/testing.md)                           | Test agents in-place with a clean conversation each run.            |
| [`channel-agent/sync.md`](./sops/channel-agent/sync.md)                                 | Pull/push agents between repo and RecallSync; secret normalization. |
| [`channel-agent/flow-troubleshooting.md`](./sops/channel-agent/flow-troubleshooting.md) | Common flow failure patterns and fixes.                             |
| [`git-commit.md`](./sops/git-commit.md)                                                 | Commit & push with a mandatory pre-commit sanity check.             |

Start a new one by copying [`sops/_template.md`](./sops/_template.md).

---

## Security & secrets

Keeping secrets out of Git is a first-class concern:

- **Gitignored:** `.env*` (except `.env.example`), `.cursor/mcp.json`, `*.pem`.
- **Placeholders in committed files:** agent headers reference `${AIOS_N8N_WEBHOOK_TOKEN}`, never a
  raw token. The agent never reads env files — local scripts (`scripts/reconcile-flow.mjs`,
  `scripts/smoke-webhook.mjs`) resolve and **encrypt** values at push time.
- **API-layer guard:** RecallSync rejects any header still containing a `${...}` placeholder, so a
  missed reconciliation fails loudly instead of pushing broken config.
- **Pre-commit sanity check:** run before every commit. It inspects the **staged** diff for env
  files, real `.env.local` values, and common secret patterns, and refuses to pass if anything
  looks unsafe.

```bash
git add -A
bash scripts/precommit-sanity.sh   # must print "RESULT: ✓ SAFE"
```

Full procedure: [`sops/git-commit.md`](./sops/git-commit.md).

---

## Roadmap & sprints

Work is organized into focused sprints with clear tasks and a decision log. See [`sprints/`](./sprints).

- **Sprint 01 — [RecallSync MCP + Email Campaign](./sprints/sprint-01-recallsync-email-campaign.md)**
  Prove the core loop end-to-end: connect this repo to one business's RecallSync over MCP, define an
  agent in `agents/`, push it, and launch a managed email campaign — all driven from the repo.

---

## Conventions

- **Agents** are folders: `*.yaml` for metadata + linking ids, Markdown/JSON for the big text
  blocks (prompts/flows). `id` fields are filled after creation and committed back.
- **SOPs / playbooks / sprints** are Markdown. SOPs are checklists, not essays — every step
  should be executable, and human-approval steps are called out explicitly.
- **Pull before you edit.** Always sync the latest live state before changing a prompt or flow.
- **Never commit secrets or operational data.** When in doubt, run the sanity check.

---

<div align="center">
<sub>Built by operators. Driven from a repo. Run on RecallSync.</sub>
</div>
