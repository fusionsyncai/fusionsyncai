---
id: sop_automation_configure
title: Configure an automation in RecallSync
status: active
owner: vishal
created: 2026-06-05
updated: 2026-06-05
---

# SOP: Configure an automation

## Purpose
Create and author a RecallSync **automation** from the repo: an outbound, multi-step, multi-channel
**cadence** (React-Flow `{ nodes, edges }`) bound to a **primary agent**. AIOS authors the
definition; it does not own the lead list and does not trigger runs.

> An automation's worker is a **primary agent** (`primaryAgentId`). Each channel step (email, sms,
> whatsapp, instagram, phone) is delivered by that primary agent's matching **channel agent**, so
> those channel agents must exist for the steps you use.

## How automations differ from campaigns
- **Campaign** = paces a conversational worker (the channel agent) through a lead list on a schedule.
- **Automation** = an explicit pre-built sequence: send X → wait → send Y → … A **lead reply
  terminates** the running sequence (handled server-side in `/api/agent/message`).

## Lifecycle
`DRAFT → ACTIVE → PAUSED → (TERMINATED | COMPLETED | FAILED)`

- Author in `DRAFT`. Going `ACTIVE` makes the automation **triggerable** for leads — treat it as an
  explicit, owner-approved step (same discipline as campaign activation).

## Flow shape (React-Flow JSON)
`{ nodes: [...], edges: [...] }`

- Exactly **one `trigger`** node (the entry; non-deletable). The interpreter drops it and starts
  from the node the trigger points to, then walks `edges` source→target.
- Step nodes by `type`:
  | `type` | Key `data` |
  |---|---|
  | `wait` | `delayAmount`, `delayUnit` (`minute|hour|day|week|month`) |
  | `email` | `emailSubject`, `messageContent`, `messageType` (`static|ai`) — also set `emailType` to match (runtime reads `emailType`) |
  | `sms` / `whatsapp` / `instagram` | `messageContent`, `messageType` |
  | `phone` | `variables` |
- `static` message content is variable-parsed (`{{firstName}}`, `{{user.x}}`); `ai` content is an
  instruction the model fills.

## Steps
1. **Pick the primary agent** (`get-primary-agents`) and confirm it has the channel agents the
   sequence needs (e.g. an EMAIL channel agent for email steps). Create them first if missing
   (`sops/channel-agent/creation.md`).
2. **Author the flow** in `automations/<slug>/automation-flow.json` (copy `_template/`). Keep one
   `trigger`, wire the chain with `edges`.
3. **Create** with `create-automation` `{ name, primaryAgentId, description?, status?, flow, flowSettings? }`.
   Default `DRAFT`. Save the returned `id` + `businessId` into `automation.yaml`.
4. **Edit later** with `update-automation` (name/description/status/flow). Pull current state first
   with `get-automation`.
5. **Mirror** the live values + sync metadata into `automation.yaml`.
6. **Commit** via `sops/git-commit.md` (run `scripts/precommit-sanity.sh` first). No secrets live in
   the flow JSON.

## Human-in-the-loop
- Going `ACTIVE` (and `PAUSED`/`TERMINATED`) are owner decisions. Confirm the bound primary agent +
  its channel agents are tested and the copy is approved before activating.

## MCP tools
`get-automations`, `get-automation`, `create-automation`, `update-automation`.

## Done criteria
- [ ] Bound primary agent exists and has the channel agents the steps require.
- [ ] `automation-flow.json` has one `trigger`, a valid chain, and correct node `data`.
- [ ] `create-automation` succeeded; `id` captured into `automation.yaml`.
- [ ] Status is intentional (`DRAFT` unless activation is explicitly approved).
- [ ] `automation.yaml` reconciled + committed.
