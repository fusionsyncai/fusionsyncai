# AIOS — Current Context

> Rolling scratchpad for the **current** focus. Keep it minimal. When focus shifts,
> replace stale sections — do not append history. This is a fresh-session primer, not a changelog.

_Last updated: 2026-06-05_

## Now
On the **correct prod business account** (`97f02e22-8758-4957-805f-1964da89419d`). Focus:
**North India Dev Agency Outreach** primary agent (partnership email outreach to North Indian
agencies serving US clients).

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
  concurrency 5), linked to automation `9cca136d-db7c-4bb8-817b-6d3ac70ac59f`. Mirror:
  `campaigns/north-india-dev-agency-outreach/campaign.yaml`.
- **Automation** `North India Dev Agency Outreach` `9cca136d-db7c-4bb8-817b-6d3ac70ac59f` —
  ACTIVE. React-Flow cadence: trigger → Email 1 (dummy) → wait 2 days → Email 2 (dummy).
  Bound to the primary agent; replies terminate the running sequence server-side. Mirror:
  `automations/north-india-dev-agency-outreach/` (`automation.yaml` + `automation-flow.json`).

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
  (`find-campaign-lead`, `add-lead-to-campaign`, `get-campaign-lead`, `find-lead-to-call`).
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

## Next / open
- Test **North India Outreach Email** per `sops/channel-agent/testing.md` (multi-turn: outreach →
  interested → next step → handoff); refine tone/length, then publish flow + activate after approval.
- Replace dummy automation email copy with real cadence copy before sending production traffic.
- Load leads into RecallSync.
- Campaign is DRAFT — activate (`update-campaign-status` → ACTIVE) only after owner approval.
