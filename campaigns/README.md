# Campaigns

A **campaign** is a configured outreach run in RecallSync: a named record bound to a **primary
agent** (its worker), optionally linked to an **automation** cadence, with a schedule, retry policy,
and concurrency. AIOS *configures* campaigns — it does not run them. The actual contacting
(calls/messages, retries, lead state) happens inside RecallSync once a campaign is activated.

> One AIOS repo = one RecallSync business. Operational data (the lead list, call results,
> conversations) lives in RecallSync, **never** in Git.

## Where a campaign lives

```
campaigns/
  <slug>/
    campaign.yaml      # the campaign's config + sync metadata (mirrors the live Campaign)
```

`_template/campaign.yaml` is the starting point — copy it to `campaigns/<slug>/campaign.yaml`.

## The model (from recallsync-app)

A `Campaign` has two layers:

1. **Identity** — `name`, `description`, `status`.
2. **Settings** — `primaryAgentId` (the main binding), optional `automationId`, `timeZone`, retry policy
   (`withRetries`, `maxRetryAttempts`, `retryInterval` + `retryIntervalType`), `concurrentCalls`,
   optional `assistantIds`, and a `weeklySchedule`. Saving settings sets `settingsUpdated = true`,
   which RecallSync requires before a campaign can go `ACTIVE`.

If `automationId` is set, it must belong to the selected primary agent. Automations are explicit
cadences such as `email -> wait -> email`; lead replies terminate active automation sessions
server-side.

Status lifecycle: `DRAFT → TESTING → ACTIVE → PAUSED → COMPLETED | FAILED`.

## What AIOS does (and does not) do

- **Does:** create the campaign, write its `name`/`description`, bind a primary agent, optionally
  attach an automation, set the schedule/retry/concurrency, and leave it in `DRAFT` or `TESTING`.
- **Does not:** flip a campaign to `ACTIVE` on its own. Activation is an explicit, owner-approved
  step (see the SOP). AIOS never manages the lead list as data in Git.

## How to configure one

Follow [`sops/campaign/configure-campaign.md`](../sops/campaign/configure-campaign.md). All writes
go through MCP campaign tools (`create-campaign`, `configure-campaign-settings`,
`update-campaign`, `update-campaign-status`, `get-campaign`, `get-all-campaigns`).
