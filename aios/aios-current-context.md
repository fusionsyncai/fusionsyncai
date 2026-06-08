# AIOS — Current Context

> Rolling scratchpad for the **current** focus. Keep it minimal. When focus shifts,
> replace stale sections — do not append history. This is a fresh-session primer, not a changelog.

_Last updated: 2026-06-08_

## Now
On the **correct prod business account** (`97f02e22-8758-4957-805f-1964da89419d`). Current focus:
building lightweight AIOS CRM contact enrichment. The chosen v1 shape is a local
`services/cursor-enrichment` sidecar that spawns `cursor-agent` (`model=auto`) for company
firmographics + signals, then calls back into the CRM; no crawl4ai/Playwright in v1.

Previous campaign focus remains **North India Dev Agency Outreach** primary agent (partnership
email outreach to North Indian agencies serving US clients).

> NOTE: earlier work (dev account `2c541e53…`) is orphaned — Brain Email `8579cb0d…` and the first
> "North India Dev Agency Outreach" `80904c62…` live on the OLD account and are not used.

## Active agents (North India Dev Agency Outreach)
- **Primary agent** `405450a6-5482-48f8-9755-d7403b797b74` (prod).
  Mirror: `agents/primary-agent/north-india-dev-agency-outreach/primary-agent.yaml`.
- **Email channel agent** `North India Outreach Email` `406cbb17-34e9-4353-bc2d-a59df03bf109` —
  FLOW, N8N (`Recall - Fusion - Send Email - SK Brevo` `c372cd48…`), **paused**. 3 objectives
  (Outreach & Engage → Explore Overlap & Offer Next Step → Confirm & Hand Off). Draft in
  `currentFlow`, not published. Mirror: `…/north-india-dev-agency-outreach/email/`.
- **Campaign** `North India Dev Agency Outreach` `d8949f6e-ec4e-4259-a089-e5fd81fdeffa` — TESTING,
  bound to the primary agent, settingsUpdated=true (IST, weekdays 09:00–17:00, retries off,
  concurrency 5), linked to automation `9cca136d-db7c-4bb8-817b-6d3ac70ac59f`. **`channels: ["NONE"]`
  is intentional** — see design note below. Mirror: `campaigns/north-india-dev-agency-outreach/campaign.yaml`.
- **Automation** `North India Dev Agency Outreach` `9cca136d-db7c-4bb8-817b-6d3ac70ac59f` —
  ACTIVE. React-Flow cadence: trigger → wait 10s → Email 1 (static) → wait 2 days → Email 2 (static).
  Both emails are STATIC (solo-founder / technical-growth-partner positioning, low-commitment pilot
  offer). Bound to the primary agent; replies terminate the running sequence server-side. Mirror:
  `automations/north-india-dev-agency-outreach/` (`automation.yaml` + `automation-flow.json`).

## Local AIOS CRM staging
- Root Next.js app (`app/`, `prisma/`) runs on `http://localhost:3010` and stores scraped/enriched
  contacts in local Postgres. Use its `/api/*` route handlers for CRM data access.
- Contact enrichment v1:
  - Service: `services/cursor-enrichment` (`npm run enrichment` from repo root), default port `5070`.
  - Runtime: spawns `cursor-agent -p --model auto --output-format json --force --trust`; reads
    `CURSOR_API_KEY` from root `.env`.
  - Flow: pipeline Action triggers `POST /enrich` and expects HTTP `202`; service later calls
    `POST /api/contacts/[id]/enrichment` with `ENRICHMENT_CALLBACK_SECRET`.
  - Status fields: `Contact.enrichmentStatus` + `enrichedAt`; result/provenance stored under
    `customData.enrichment`.
- Local campaign `North India Dev Agency Outreach` `eef5581e-8a62-41d2-9bc0-a70f8e48f600` maps to
  RecallSync campaign `d8949f6e-ec4e-4259-a089-e5fd81fdeffa`.
- Campaign requirement: each staged contact must include `customData.personalizedHighlight`; also
  mirror the same text as `customData.personalizationHighlight` for the current automation template.
- Seeded local contacts (not email-verified yet): Soft Erector Team (`info@softerector.com`),
  Sandeep Kurien / Technodweep (`sandeep@technodweep.com`), Vishnu Gupta / LastingLabs
  (`info@lastinglabs.com`). All are linked to the local campaign with source URLs in `customData`.

> **Design note — who sends what (this campaign):** The **automation** is the sender (it owns the
> outbound emails). The **campaign** sets `channels: ["NONE"]` on purpose so campaign processing does
> NOT also send (avoids duplicate outbound). The channel agent just **waits** for a reply. When the
> lead replies, the running automation sequence terminates server-side (`/api/agent/message`) and the
> DRAFT-mode channel agent processes the reply (HITL approve/reject). Do **not** flip `channels` to
> `["EMAIL"]` for this setup.

## Prod primary agents (snapshot, 15)
Many pre-built demo/appointment-setter agents with live channel agents (Email/Voice/SMS), e.g.
`FusionSync Primary` (4 channels), `Qualification Agent` (5), HVAC/Dental/Med Spa/Travel/etc demos.
New: **North India Dev Agency Outreach** (`405450a6…`, email channel agent `406cbb17…`).

## Secret model (important)
- Git stores only `${PLACEHOLDER}` in headers. The **agent never reads `.env` / `.env.local`**.
- Local scripts touch plaintext:
  - `scripts/smoke-webhook.mjs --url <u> --var <NAME>` — verify a webhook (prints status only).
  - `scripts/reconcile-flow.mjs --flow <path>` — substitute + **encrypt** headers → JSON for MCP push.
  - `scripts/secret.mjs encrypt|decrypt` — single header ciphertext (stdin).
- All RecallSync writes go through **MCP** (no REST URL in this repo). Server encrypts/decrypts
  with `ENCRYPTION_KEY` (must match recallsync-app).

## Key paths
- Agents: `agents/primary-agent/<name>/<channel>/` (`channel-agent.yaml`, `*-prompt.md` or `*-flow.json`).
- Campaigns: `campaigns/<slug>/campaign.yaml` (config + sync meta; template in `campaigns/_template/`).
- Automations: `automations/<slug>/automation.yaml` + `automation-flow.json` (React-Flow cadence).
- SOPs: `sops/channel-agent/` (creation, prompting-standard, prompting-flow, tool-calls, testing, sync, flow-troubleshooting), `sops/campaign/configure-campaign.md`, `sops/automation/configure-automation.md`, `sops/git-commit.md`.
- Scripts: `scripts/` (secret, reconcile-flow, smoke-webhook, precommit-sanity, `lib/`).
- Telegram bridge: `telegram-bridge/` (`npm run bridge`).
- Context: `context/` (business), this file (`aios/aios-current-context.md`).

## Campaigns (configure-only)
- A campaign = a RecallSync `Campaign`: identity (name/description/status) + settings
  (`primaryAgentId` is the main binding, optional `automationId`, plus
  timezone/retry/concurrency/weeklySchedule).
- Optional `automationId` must belong to the selected primary agent; it links an outbound cadence
  (`email -> wait -> email`, etc.) to the campaign. Lead replies terminate active automation sessions.
- AIOS configures up to `DRAFT`/`TESTING` only. `ACTIVE` is owner-approved (real outreach starts).
- Synced campaign: `campaigns/fusion-default/campaign.yaml` mirrors RecallSync `Fusion [DEFAULT]`
  (`TESTING`, settings updated, bound to primary agent `a00d52ba-dc4e-4401-99a9-d122c6b01adb`).
- MCP tools: `get-all-campaigns`, `get-campaign`, `create-campaign`, `update-campaign`,
  `configure-campaign-settings` (now accepts optional `automationId`), `update-campaign-status`, plus lead helpers
  (`find-campaign-lead`, `add-lead-to-campaign`, `get-campaign-lead`, `get-campaign-leads`, `remove-lead-from-campaign`, `find-lead-to-call`).
  Channel agents: `create-channel-agent` / `update-channel-agent` accept **`agentMode`** (`AUTO` | `DRAFT`).
  (Renamed from the old `voiceCampaign` / `*-voice-*` tools — "voice" was just a legacy name.)

## Automations
- A RecallSync automation = an outbound multi-channel sequence stored as React-Flow `{ nodes, edges }`
  and bound to a `primaryAgentId`. Example: `trigger -> email -> wait -> email`.
- Each channel step uses the bound primary agent's matching channel agent. Lead replies terminate
  active automation sessions via `/api/agent/message`.
- MCP tools: `get-automations`, `get-automation`, `create-automation`, `update-automation`.
- Runtime quirk: email nodes should store both `messageType` and `emailType` (same value) because
  the builder uses `messageType` while the worker reads `emailType`.

## Conventions
- One repo = one business = one RecallSync sub-account (MCP api key).
- FLOW = `currentFlow` is the repo's source; publish to `flow` only after owner approval.
- Pull-before-edit; commit only when asked (run `scripts/precommit-sanity.sh` first).

## MCP coverage
- `recallsync/coverage.md` = living map of what AIOS can control via MCP + prioritized backlog.
  Batch A complete (P0+P1): conversation get/search/update, message create/update/delete, and draft
  approve/reject via MCP. Batch B complete: `update-campaign-lead` (status only), `delete-campaign`,
  and **automation runtime control** — `trigger-automation` / `stop-automation` for a lead
  plus `get-lead-automation-sessions` (defaults to ACTIVE; sessions key on `primaryAgentId` + `leadId`,
  not `automationId`). Also `test-n8n-workflow` — POST simulated production payload to an N8N workflow.
  Batch C done: `get-primary-agent` by id, meeting `get-upcoming-meetings-by-lead` +
  `set-all-overdue-no-show`, and **`send-message`** — real human-send via the conversation's channel
  agent provider (reuses extracted `dispatchBaseAgentMessageToProvider`, shared with approve-draft;
  records HUMAN_AGENT msg, flips SENT/SCHEDULED).   Batch D done: full pipeline/stage/opportunity MCP
  CRUD — `get-pipelines`, `get-stages`, `get-opportunities` (paginated + select + createdAt filter),
  create/update/delete for each; move opportunity between stages via `update-opportunity` `stageId`.
  Batch E done: calls — `get-calls` (paginated + leadId/campaignId filter + createdAt date filter),
  `get-call`, `create-call`, `update-call` (new tRPC getCalls/getCallById + REST GET routes + MCP).
  Batch F done: custom fields — new API-key `businessCustomField` router (the existing `customFields`
  router is dashboard-only `privateProcedure`). Definitions CRUD (`get-custom-fields` paginated +
  select + createdAt filter, `get-custom-field`, `create/update/delete-custom-field`) + per-lead values
  (`get-lead-custom-field-values`, `set-lead-custom-field-value`, `bulk-set-lead-custom-field-values`,
  `delete-lead-custom-field-value`; reuses `bulkUpsertLeadCustomFieldValuesForLead` incl. GHL sync).
  Remaining deferred (P2/P3): provider connect/configure, knowledge base, delete primary/automation.
- **List standard** (`sops/list-pagination-and-field-selection.md`): list endpoints/tools must
  support `page`/`pageSize`, `select` (lean default when omitted), date filters when the model has a
  date field (`gte/lte/gt/lt/eq`), and server-side domain filters. No date filters if the model lacks
  `createdAt` (e.g. CampaignLead) — pagination + select only; never change Prisma for this. Wired:
  `get-conversation-messages`, `get-leads`, `get-meetings`, `get-all-follow-ups` (lean default),
  `get-all-campaigns`, `get-campaign-leads`, `get-automations`, `get-pipelines`, `get-stages`,
  `get-opportunities`, `get-calls`, `get-custom-fields`. MCP helpers:
  `recallsync-mcp/src/schema/list-query.ts` + `src/utils/list-query.util.ts`. Response shape:
  `{ <items>, total, totalPages, hasNextPage }`.

## recallsync-app / dev infra (sibling repos, outside this workspace)
- **recallsync-app** (`/Users/vishalchauhan/Desktop/developer/recall/recallsync-app`): Next.js,
  runs **production** on **port 3000**. Manage it: if running, kill the proc on 3000, then
  `npm run build` && `npm run start` (never `next dev`). Code changes aren't live until rebuild+restart.
  Type-check with `npm run ts:check` (not raw `tsc`). Enum imports come from
  `@/generated/prisma/client` (e.g. `CHANNEL`, `MESSAGE_SENDER`) — `Prisma.$Enums.*` does NOT exist.
- **recallsync-mcp** (`/Users/vishalchauhan/Desktop/developer/recall/recallsync-mcp`): MCP runs on
  **port 3008 only** (exposed via ngrok). Production run is `npm run build` then `npm run start`.
  Dev run is `npm run dev`, which now watches `server.ts` + `src/**` (`--watch src --ext ts,json`).
  Tools live in `src/tools/*`, schemas in `src/schema/tool.ts`, endpoints in `src/constants/tool.ts`,
  registration in `src/servers/primary.server.ts`.
- Cursor rules (`.cursor/rules/`): `recallsync-mcp-only` (all RecallSync via MCP, never REST),
  `recallsync-app-typecheck` (`npm run ts:check`), `recallsync-app-run` (port 3000 build+start),
  `recallsync-list-endpoints` (pagination/select/filter standard).

## Next / open
- Test **North India Outreach Email** per `sops/channel-agent/testing.md` (multi-turn: outreach →
  interested → next step → handoff); refine tone/length, then publish flow + activate after approval.
- Replace dummy automation email copy with real cadence copy before sending production traffic.
- Load leads into RecallSync.
- Campaign is DRAFT — activate (`update-campaign-status` → ACTIVE) only after owner approval.
