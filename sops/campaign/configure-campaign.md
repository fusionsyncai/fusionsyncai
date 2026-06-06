---
id: sop_campaign_configure
title: Configure a campaign in RecallSync
status: active
owner: vishal
created: 2026-06-05
updated: 2026-06-05
---

# SOP: Configure a campaign

## Purpose
Create and configure a RecallSync **campaign** from the repo: name it, bind it to a **primary
agent**, optionally attach an **automation** cadence, and set its schedule, retry policy, and
concurrency — leaving it in `DRAFT` or `TESTING`. AIOS *configures* campaigns; it does not run them
and does not own the lead list.

> A campaign's worker is a **primary agent** (`primaryAgentId`) — that is the main binding. The
> agent's channels (WhatsApp/Instagram/Email/Voice) and behavior are configured separately via the
> channel-agent SOPs.
>
> A campaign may also link an optional **automation** (`automationId`). The automation must belong
> to the same business and the selected primary agent. It represents an outbound cadence such as
> `email -> wait -> email`; lead replies terminate active automation sessions server-side.

## Trigger
The owner wants a new managed outreach run, or wants to change an existing campaign's
agent/schedule/retry settings.

## Inputs
- A campaign objective + short description, and a name.
- The **primary agent id** to bind (use `get-primary-agents` to find it; it must belong to this
  business).
- Optional **automation id** to bind (use `get-automations`; it must belong to the selected primary
  agent).
- Schedule (timezone + weekly time slots), retry policy, and concurrency — or accept the template
  defaults.

## Lifecycle (where this SOP stops)
`DRAFT → TESTING → ACTIVE → PAUSED → COMPLETED | FAILED`

**This SOP only ever leaves a campaign in `DRAFT` or `TESTING`.** Flipping a campaign to `ACTIVE`
starts real outreach and is a **separate, explicitly owner-approved step** (see Human-in-the-loop).

## Steps

1. **Pull current state first.** If the campaign already exists, run `get-campaign` (by id) and
   reconcile `campaigns/<slug>/campaign.yaml` to the live values before editing. For a brand-new
   campaign, copy `campaigns/_template/campaign.yaml` to `campaigns/<slug>/campaign.yaml`.

2. **Pick the primary agent.** Run `get-primary-agents`, confirm the right worker, and record its
   id in `settings.primaryAgentId`. If the needed agent/channels don't exist yet, create them via
   the channel-agent SOPs first.

3. **Create the campaign (if new).** Call `create-campaign` with `{ name, description, status }`
   where status is `DRAFT` (default) or `TESTING`. Save the returned `id` and `businessId` into
   `campaign.yaml`.

4. **Configure settings (the binding).** Call `configure-campaign-settings` with:
   - `campaignId`
   - `primaryAgentId` (required — the main binding)
   - optional: `automationId` (use `null` to clear)
   - optional: `timeZone`, `withRetries`, `maxRetryAttempts`, `retryInterval`,
     `retryIntervalType` (`hour`|`day`), `concurrentCalls`, `assistantIds`, `weeklySchedule`.
   This marks `settingsUpdated = true` server-side (required before activation). Mirror the saved
   values + `sync.settings_updated: true` into `campaign.yaml`.

5. **Edit name/description/status later** with `update-campaign` (status here is limited to
   `DRAFT`/`TESTING`).

6. **Verify.** Run `get-campaign` and confirm `status`, `primaryAgentId`, optional `automationId`,
   `settingsUpdated`, and the schedule match the repo. Update `campaign.yaml` sync metadata (`last_synced_at`,
   `sync.live_updated_at`, `sync.last_pulled_at`).

7. **Commit.** Follow `sops/git-commit.md` (run `scripts/precommit-sanity.sh` first). `campaign.yaml`
   holds no secrets — campaign config has no header tokens — but still go through the gate.

## Human-in-the-loop
- **Activation is gated.** Do **not** call `update-campaign-status` with `ACTIVE` unless the owner
  explicitly approves it in that turn. Going `ACTIVE` begins real contacting of leads.
- Before activation, confirm with the owner: the lead list is loaded in RecallSync, the bound
  primary agent + its channels are tested, and `settingsUpdated` is true.
- `PAUSED`/`COMPLETED`/`FAILED` transitions are also owner decisions.

## Tools (MCP)
- `get-all-campaigns`, `get-campaign` — read.
- `create-campaign`, `update-campaign` — identity (name/description, DRAFT|TESTING status).
- `configure-campaign-settings` — bind primary agent + optional automation + schedule/retry/concurrency.
- `update-campaign-status` — lifecycle changes incl. `ACTIVE` (**owner-approved only**).
- `find-campaign-lead`, `add-lead-to-campaign`, `get-campaign-lead`, `find-lead-to-call` — lead
  helpers (operational; lead data stays in RecallSync).

## Output
- A `campaigns/<slug>/campaign.yaml` committed to the repo, mirroring a live RecallSync campaign in
  `DRAFT`/`TESTING` with `settingsUpdated = true` and a bound primary agent.

## Done criteria
- [ ] Campaign exists in RecallSync with the intended name/description.
- [ ] `primaryAgentId` is bound and belongs to this business.
- [ ] Optional `automationId` is bound only when it belongs to the selected primary agent.
- [ ] Schedule / retry / concurrency configured; `settingsUpdated = true`.
- [ ] Status is `DRAFT` or `TESTING` (not `ACTIVE`).
- [ ] `campaign.yaml` reconciled + committed via the git-commit SOP.
