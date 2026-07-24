---
id: sop_create_agent
title: Create a new agent
status: draft
owner: vishal
created: 2026-06-04
updated: 2026-07-01
---

# SOP: Create a new agent

## Purpose
Provision a new **primary agent** and its **channel agents** on RecallSync. Agent config lives
**only in RecallSync** (MCP or CLI) — not in this repo.

## Trigger
A new business need requires an agent that does not yet exist.

> Umbrella SOP. For channel-agent specifics use the dedicated SOPs:
> `sops/channel-agent/creation.md`, `prompting-standard.md`, `testing.md`.

## Inputs
- Primary agent name + goal (what outcome the wrapper is responsible for)
- Channel(s) needed (EMAIL / SMS / WHATSAPP / VOICE_CALL / ...) and provider per channel
- Builder type per channel (`STANDARD` vs `FLOW`) — confirm with owner
- **Agent mode per channel** (`AUTO` vs `DRAFT` / human-in-the-loop) — confirm with owner (see below)
- Whether a human must approve provisioning before the agent goes live

## Steps

### A. Primary agent (wrapper)
1. Confirm name and goal with the owner.
2. Run `create-primary-agent` (MCP) or `primary-agent create` (CLI) with at least `name`.
3. Capture the returned `id`.

### B. Channel agent(s) — see `sops/channel-agent/creation.md` for full detail
4. For each channel, run `create-channel-agent` with `primaryAgentId`, `name`, `channel`,
   `provider`, `baseAgentType`, `agentMode`.
5. Capture each returned `baseAgent.id`.

### C. Author behavior & activate
6. Review positioning against `/context` for tone and offers.
7. **[Human review]** Owner approves behavior before activation.
8. Author and push behavior live:
   - **STANDARD** → `update-channel-agent` with `prompt` (see `prompting-standard.md`).
   - **FLOW** → `set-channel-agent-flow-draft` (see `prompting-flow.md`).
9. Test per `testing.md`.
10. Activate with `update-channel-agent` `{ id, isActive: true }` after approval.

## Agent mode (human-in-the-loop)
Each channel agent has an `agentMode` (`AUTO` default, or `DRAFT`) — **always confirm it with the
owner at creation time**:
- **`AUTO`** — the agent sends its replies automatically (hands-off).
- **`DRAFT`** — human-in-the-loop: the agent's reply is **not** sent but held as **pending** in the
  **classic RecallSync conversation inbox**, where a human can **Approve** (send) or **Reject**
  (discard) it. Use for sensitive/high-value conversations or while testing.

Full detail and the exact question to ask the owner live in `sops/channel-agent/creation.md`
("Agent mode — human-in-the-loop").

## Human-in-the-loop
Step 7 (approval before activation) is mandatory. Separately, `agentMode: DRAFT` keeps a human in
the loop on every outbound reply at runtime.

## Output
- Live PrimaryAgent + channel agents (BaseAgents) on RecallSync, with ids noted in the session or
  task tracker (not committed to `agents/`).

## Done criteria
- [ ] Primary agent created on RecallSync; id captured
- [ ] Channel agent(s) created; ids captured
- [ ] Behavior authored and pushed live (prompt or flow)
- [ ] Prompts/flows reviewed and approved
- [ ] Tested via `test-channel-agent`
- [ ] `update-channel-agent` set `isActive: true` after approval
