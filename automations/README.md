# Automations

An **automation** is a RecallSync `Automation`: a React-Flow **outbound cadence** bound to a
**primary agent**. Unlike a campaign (which paces a conversational worker through a lead list), an
automation is an explicit multi-step, multi-channel sequence — e.g.

```
Email 1  →  wait 2 days  →  Email 2  →  wait 1 day  →  SMS  →  Voice Call
```

Each channel step is delivered by the bound primary agent's matching **channel agent** (the EMAIL
step uses the primary's EMAIL agent, etc.). A **lead reply terminates** the running sequence
(handled server-side in `/api/agent/message`).

## Directory layout

```
automations/
  README.md                         # this file
  _template/automation.yaml         # copy when adding a new automation
  <slug>/
    automation.yaml                 # link + metadata mirror (id, primaryAgent, status, sync)
    automation-flow.json            # the React-Flow cadence ({ nodes, edges })
```

## Model (RecallSync `Automation`)

| Field | Notes |
|---|---|
| `name`, `description` | identity |
| `status` | `DRAFT | ACTIVE | PAUSED | TERMINATED | COMPLETED | FAILED` |
| `flow` | React-Flow JSON: `{ nodes, edges }` |
| `flowSettings` | optional builder settings |
| `primaryAgentId` | **required** — the worker whose channel agents deliver each step |

## Flow node types (builder)

| `type` | Purpose | Key `data` |
|---|---|---|
| `trigger` | fixed entry (exactly one, non-deletable) | `label` |
| `wait` | delay | `delayAmount`, `delayUnit` (`minute|hour|day|week|month`) |
| `email` | send email | `emailSubject`, `messageContent`, `messageType` (`static|ai`) |
| `sms` / `whatsapp` / `instagram` | send message | `messageContent`, `messageType` |
| `phone` | voice call | `variables` |

> Runtime note: the `email` step is read by the worker as `emailType` (not `messageType`). Author
> email nodes with **both** `messageType` and `emailType` set to the same value so the builder UI
> and the runtime agree.

## AIOS role

AIOS **configures** automations (create + author the flow). It does not own the lead list and does
not trigger runs. Activation (`ACTIVE`) makes an automation triggerable; treat going live as an
explicit, owner-approved step. See `sops/automation/configure-automation.md`.

## MCP tools

`get-automations`, `get-automation`, `create-automation`, `update-automation`.
