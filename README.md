<div align="center">

# FusionSync

**White-label tech partner for agency owners.**

FusionSync builds and operates the software layer that marketing and service agencies cannot deliver
in-house. Agency owners keep the client relationship, the brand, and the revenue. We build,
integrate, and run the technology behind it — invisibly.

> You bring the clients. We bring the technology.

**Live site:** [fusionsync.ai](https://www.fusionsync.ai) · **Primary CTA:** [WhatsApp partnership conversation](https://wa.me/+917973151386)

</div>

---

## Table of contents

- [Who FusionSync is for](#who-fusionsync-is-for)
- [Who FusionSync is not for](#who-fusionsync-is-not-for)
- [The partnership model](#the-partnership-model)
- [How FusionSync scales — infrastructure, not automations](#how-fusionsync-scales--infrastructure-not-automations)
- [Product stack](#product-stack)
- [What this repository is (AIOS)](#what-this-repository-is-aios)
- [AIOS + RecallSync — how we operate at scale](#aios--recallsync--how-we-operate-at-scale)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Getting started (operators & developers)](#getting-started-operators--developers)
- [Standard Operating Procedures (SOPs)](#standard-operating-procedures-sops)
- [Security & secrets](#security--secrets)
- [Contact & credibility](#contact--credibility)

---

## Who FusionSync is for

FusionSync partners with **agency owners** who already have **paying clients in one vertical** and
a **daily tech gap** — clients ask for software, CRM bridges, integrations, or AI workflows the
agency cannot ship in-house.

**Ideal partner profile:**

| Signal | Why it matters |
| --- | --- |
| Active clients in one vertical (dental, insurance, real estate, creator monetization, etc.) | Demand is proven; we fulfil behind your brand |
| Recurring requests for software the agency turns down or cobbles together | Clear gap FusionSync fills |
| Enough client volume that white-label fulfilment beats hiring devs | Economics work for phased rollout |
| Local integration knowledge (what PMS/CRM/compliance the market runs) | We build the bridge; you bring domain context |

**Positioning in one line:** FusionSync partners with agency owners who already serve a vertical,
white-labels the product, wires the integrations, and runs white-glove implementation for each of
their clients — so the agency can productize an offer it could not build alone.

---

## Who FusionSync is not for

FusionSync is **not** a freelancer marketplace, chatbot agency, or solo-founder prototype shop.
We do not cold-pitch strangers with no client base.

| Not a fit | Why |
| --- | --- |
| Idea-stage founders with no signed clients | Partnership requires proven demand |
| Generic "need a developer" / body-shop outsourcing | We are a vertical fulfilment partner, not staff aug |
| Pure design-only or one-off MVPs | Our model is repeat rollout across a client base |
| Enterprise RFP / procurement cycles | Operator-to-operator partnership, not vendor RFP |

---

## The partnership model

FusionSync does not sell software to end clients directly. It partners with agency owners who
already have paying clients in a vertical.

| Phase | What happens |
| --- | --- |
| **Free POC** | Working demo on the proven stack (GoHighLevel + n8n + relevant integrations), scoped to the partner's vertical — a sales asset to pitch existing clients |
| **Per-client rollout** | Implementation starts only once a client is paying. Productized tiers (simple → mid-complexity → full stack) |
| **White-label vertical software** | After demand is proven, production-grade software under the partner's brand: auth, billing, tenant isolation, UI that reads as theirs |
| **Ownership milestones** | Optional ownership at **25 active clients** (geography) or **100 active clients** (global), or stay on recurring white-glove ops indefinitely |

**Typical partner engagement:** $20k+ (scope depends on vertical, client count, and phase).

**Division of work:**

| Agency owner | FusionSync (silent partner) |
| --- | --- |
| Client relationships & trust | Product architecture & core build |
| Vertical & geography knowledge | Integration bridges & owned infrastructure |
| Local software/compliance context | White-glove implementation per client |
| Sales to existing base | Replication into new geographies |

FusionSync stays the silent technical partner throughout. The agency owner stays the face of the
business.

**Current flagship vertical:** dental patient acquisition — GoHighLevel, n8n, CRMBridge (HIPAA-compliant
access to 27+ dental PMS systems), and WaCRM. Proof-of-model before replication into other verticals.

**Proof on site:** UK dental agency partner, creator monetization build, real estate underwriting,
vertical SaaS fulfilment. Shubham Kashyap leads every partnership; team of 5 ships.

---

## How FusionSync scales — infrastructure, not automations

Most agencies scale tech delivery by stacking more automations — another n8n workflow, another Zap,
another SaaS seat. That works for the first few clients. It breaks at ten.

**FusionSync scales on owned infrastructure:**

1. **Automations are the wedge, not the ceiling.** GoHighLevel + n8n prove demand fast (free POC,
   per-client rollout). They are the sales demo and first fulfilment layer — not the long-term
   product.
2. **Production runs on self-hosted, open-source stack we control.** RecallSync (CRM + AI agents +
   MCP), WaCRM (WhatsApp CRM + flows), Dograh (self-hosted voice agents), CRMBridge (dental PMS
   API layer), LiveKit, PostgreSQL, and Next.js — deployed under the partner's brand, not rented
   per-seat from closed vendors.
3. **Repeatable fulfilment, not bespoke quotes every week.** Productized tiers, fixed timelines,
   volume discounts on support — because the stack is the same; only vertical config changes.
4. **AI-native operations.** This repo (AIOS) drives agents, campaigns, and SOPs from Git via
   RecallSync MCP/CLI — so scaling delivery means scaling procedures and infrastructure, not
   headcount on manual prompt editing.

```
   Phase 1 — prove demand          Phase 2+ — own the stack
   ─────────────────────          ──────────────────────────
   GHL · n8n · integrations  ──▶  RecallSync · WaCRM · Dograh · CRMBridge
   (POC + first clients)          (white-label product + tenant isolation)
                                         ▲
                                         │
                              AIOS (this repo) — SOPs, context, agent ops via MCP
```

**Why infrastructure beats automation-only scaling:**

| Automation-only | Infrastructure-first |
| --- | --- |
| Per-client custom flows; hard to maintain | Shared platform; vertical config |
| Vendor lock-in (Vapi, Retell, closed CRMs) | Self-hosted OSS; data stays in partner perimeter |
| Margins shrink as client count grows | Volume discounts + optional ownership milestones |
| No path to product | White-label software the partner can own |

---

## Product stack

| Product | Role |
| --- | --- |
| **RecallSync** | Core CRM platform — leads, campaigns, conversations, AI channel agents. MCP-first architecture; Twilio SIP; LiveKit voice; two-way GoHighLevel sync |
| **WaCRM** | Open-source WhatsApp CRM — flow automation, AI agent chat, voice via LiveKit |
| **Dograh** | Open-source, self-hostable voice agent platform (Vapi/Retell alternative) — visual workflows, MCP-native, on-prem/VPC deployment |
| **CRMBridge** | HIPAA-compliant REST API layer to 27+ dental practice management systems (Dentrix, Eaglesoft, Open Dental, and others) |

**Delivery & integration layer:** GoHighLevel · n8n · Make · Next.js · TypeScript · PostgreSQL ·
Prisma · Supabase · Stripe · OpenAI · Claude · LiveKit · Restack · Vercel

**Roadmap:** Google Reviews automation, content/social automation, local SEO tracking, Meta Ads
integration.

---

## What this repository is (AIOS)

This repo is the **AI Operating System (AIOS)** for FusionSync — the Git-driven control plane for
running a business's AI agents, campaigns, and repeatable operations.

**One repo = one business = one RecallSync sub-account.**

| Lives in Git (AIOS) | Lives in RecallSync (runtime) | Never in Git |
| --- | --- | --- |
| SOPs, business context, playbooks | Agent prompts & flow graphs | Operational data (leads, conversations) |
| Campaign definitions & sprint plans | Channel agent configs | Secrets (API tokens, auth headers) |
| Enrichment schemas & outreach copy | Live delivery on WhatsApp, email, voice, etc. | |

Most teams operate AI agents through dashboards with no history, no review, and no single source of
truth. **AIOS treats business operations as code where it helps** — while agent behavior stays in
RecallSync, driven via [MCP](https://modelcontextprotocol.io) or the **`recallsync` CLI**.

---

## AIOS + RecallSync — how we operate at scale

RecallSync is the **runtime**. AIOS is the **brain and playbook layer**. Together they let FusionSync
fulfil many clients without scaling manual ops linearly.

```
   define in RecallSync  ──▶  test via MCP/CLI  ──▶  run on channels
   (prompt / flow)          (test lead)            (live delivery)
        ▲
        └──  SOPs + context in Git guide how agents are built & operated
```

**Core loop:**

1. **Define** agent behavior in RecallSync (UI, MCP, or CLI).
2. **Fetch** the latest live state before editing (`get-channel-agent`).
3. **Test** in-place using the test lead harness; iterate until approved.
4. **Activate** when ready (`update-channel-agent` / UI).
5. **Operate** using SOPs and context files in this repo — repeatable across partners and verticals.

**Local lead factory:** The root Next.js CRM app (`localhost:3010`) stages and enriches agency
partnership prospects before outreach. Enrichment reflects vertical, client count, tech gap, and
integration targets — not generic founder MVP copy.

**FusionSync Primary** channel agents (live-chat, WhatsApp, Instagram, WP Call) carry the public
partnership positioning; they are authored and tested live in RecallSync via MCP/CLI.

---

## Architecture

AIOS sits on a three-repo chain. This repo never talks to the database directly.

```
AIOS (this repo)  ──MCP──▶  recallsync-mcp  ──REST (Bearer api_key)──▶  recallsync-app  ──Prisma──▶  DB
   Cursor / CLI              thin tool layer         business routers              MySQL
```

| Layer | Purpose |
| --- | --- |
| **AIOS** (this repo) | SOPs, context, playbooks. Agents driven via MCP/CLI against RecallSync |
| **recallsync-mcp** | Express MCP server — validate input → call REST → return result |
| **recallsync-app** | Next.js app — REST under `/api/rest/*` wraps business-context tRPC routers |

See [`recallsync/`](./recallsync) for the system/engineering layer, including
[`add-mcp-operation.md`](./recallsync/add-mcp-operation.md).

**Core concepts (RecallSync schema):**

| Concept | Where | What |
| --- | --- | --- |
| **Business** | RecallSync sub-account | Fixed by API key — one per AIOS repo |
| **PrimaryAgent** | RecallSync | Groups channel agents; goal & stop criteria; **no prompt** |
| **BaseAgent** (channel agent) | RecallSync | Per-channel worker — `STANDARD` (single prompt) or `FLOW` (graph) |

---

## Repository structure

```
fusionsyncai/
├── aios/                   # rolling session context & intent-signal monitor
├── agents/                 # README only — agents live in RecallSync
├── context/                # business context agents read before acting
├── sops/                   # Standard Operating Procedures (repeatable checklists)
│   └── channel-agent/      # creation, prompting, tool-calls, testing, troubleshooting
├── playbooks/              # campaign definitions (objective, ICP, offer, sequence)
├── sprints/                # current build focus + decision log
├── recallsync/             # MCP integration docs & coverage map
├── scripts/                # recallsync CLI wrapper, reconcile-flow, precommit-sanity
├── telegram-bridge/        # optional Telegram → cursor-agent bridge
├── app/                    # local AIOS CRM (lead factory, port 3010)
└── .env.example            # secret registry — names + purpose only (no values)
```

---

## Getting started (operators & developers)

### Prerequisites

- [Cursor](https://cursor.com) — this repo is designed to be operated by its agent
- RecallSync sub-account and **API key**
- `recallsync-mcp` server running (or hosted endpoint)

### 1. Configure secrets

```bash
cp .env.example .env.local   # .env.local is gitignored
```

Set `RECALL_API_KEY` and `RECALLSYNC_BASE_URL` (hosted RecallSync domain, or
`http://localhost:3000/api/rest` for local `recallsync-app`).

### 2. Connect MCP

Template: [`.cursor/.mcp.example.json`](./.cursor/.mcp.example.json). Real config:
`.cursor/mcp.json` (gitignored).

### 3. Drive from Cursor

Typical first tasks:

- "List the primary agents." → confirms MCP/CLI connection
- "Create a WhatsApp channel agent." → follows [`sops/channel-agent/creation.md`](./sops/channel-agent/creation.md)
- "Update the live-chat agent flow." → fetch live, edit, push draft via MCP/CLI

**CLI (preferred for agent sessions):**

```bash
node scripts/recallsync-cli.mjs --json primary-agent list
node scripts/recallsync-cli.mjs --json channel-agent get --id <id>
```

### 4. Telegram bridge (optional)

Run AIOS from your phone — whitelisted Telegram DM spawns `cursor-agent` with RecallSync MCP tools.
See [`telegram-bridge/README.md`](./telegram-bridge/README.md).

---

## Standard Operating Procedures (SOPs)

An SOP is a **repeatable checklist** a human or AI agent can follow literally. If something is done
more than once, it becomes an SOP.

| SOP | Purpose |
| --- | --- |
| [`channel-agent/creation.md`](./sops/channel-agent/creation.md) | Create a channel agent |
| [`channel-agent/prompting-standard.md`](./sops/channel-agent/prompting-standard.md) | Author a STANDARD agent prompt |
| [`channel-agent/prompting-flow.md`](./sops/channel-agent/prompting-flow.md) | Design a FLOW agent graph |
| [`channel-agent/tool-calls.md`](./sops/channel-agent/tool-calls.md) | Wire HTTP tool calls |
| [`channel-agent/testing.md`](./sops/channel-agent/testing.md) | Test with clean conversation each run |
| [`channel-agent/sync.md`](./sops/channel-agent/sync.md) | Live-only workflow (RecallSync is source of truth) |
| [`channel-agent/flow-troubleshooting.md`](./sops/channel-agent/flow-troubleshooting.md) | Common flow failures |
| [`git-commit.md`](./sops/git-commit.md) | Commit with pre-commit sanity check |

Start a new SOP from [`sops/_template.md`](./sops/_template.md).

---

## Security & secrets

- **Gitignored:** `.env*` (except `.env.example`), `.cursor/mcp.json`, `*.pem`
- **Placeholders in committed files:** `${AIOS_N8N_WEBHOOK_TOKEN}` — resolved and encrypted at push time
- **API guard:** RecallSync rejects headers still containing `${...}` placeholders
- **Pre-commit:** `bash scripts/precommit-sanity.sh` must print `RESULT: ✓ SAFE` before commit

Full procedure: [`sops/git-commit.md`](./sops/git-commit.md).

---

## Contact & credibility

| | |
| --- | --- |
| **Website** | [fusionsync.ai](https://www.fusionsync.ai) |
| **Partnership CTA** | [WhatsApp +91 79731 51386](https://wa.me/+917973151386) |
| **Email** | info@fusionsync.ai |
| **Founder** | Shubham Kashyap — leads every partnership |
| **Credibility** | Top Rated Plus on Upwork · 35+ deliveries · team of 5 |
| **Location** | Mohali, Punjab, India |

**For agency owners with paying clients in a vertical:** message on WhatsApp with your vertical,
client count, and the tech gap you cannot fill today. We map phased partnership fit before you
commit.

---

<div align="center">

<sub>Built by operators in Mohali, India · Git for ops · RecallSync for agents · Infrastructure for scale</sub>

</div>
