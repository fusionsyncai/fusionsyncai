---
id: sop_create_agent
title: Create a new agent
status: draft
owner: vishal
created: 2026-06-04
updated: 2026-06-04
---

# SOP: Create a new agent

## Purpose
Define a new agent in the AIOS brain and provision it on RecallSync. Agents follow RecallSync's
shape: a **primary agent** (wrapper) with one or more **channel agents** under it.

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
1. Copy `agents/_template/` into `agents/primary-agent/<primary-agent-name>/`.
2. Fill `primary-agent.yaml`: `name`, `type`, `goal`, `goalCompleteCriteria`, `stopScenario`,
   and calendar reference if used. Leave `primaryAgent.id` blank until created.

### B. Channel agent(s) — see `sops/channel-agent/creation.md` for full detail
3. Under the primary folder, copy `_channel/` to `<channel>/` (e.g. `email`), so the path is
   `agents/primary-agent/<primary-agent-name>/<channel>/`.
4. Fill `channel-agent.yaml`: `name`, `channel`, `provider`, `baseAgentType`, `agentMode`. Leave
   `agent.id` blank until created.
5. Write the behavior in `channel-agent-prompt.md` (role, context, responsibilities, output, guardrails).
6. Add the channel to the `channelAgents` index in `primary-agent.yaml`.

### C. Review & provision
7. Review prompts against `/context` for positioning and tone.
8. **[Human review]** Owner approves `primary-agent.yaml` + each `channel-agent-prompt.md` before provisioning.
9. Provision on RecallSync via MCP: create the PrimaryAgent first (`create-primary-agent`), then each
   channel agent (`create-channel-agent`), then sync prompts (`update-channel-agent` with `prompt`).
10. Write the returned ids back: `primaryAgent.id` and each `baseAgent.id`. Set `synced: true` and
    `last_synced_at`. Commit.

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
Step 8 (approval before provisioning) is mandatory. Separately, `agentMode: DRAFT` keeps a human in
the loop on every outbound reply at runtime.

## Output
- A committed `agents/primary-agent/<primary-agent-name>/` folder (primary + channel agents + prompts).
- Live PrimaryAgent + channel agents (BaseAgents) on RecallSync, linked by id.

## Done criteria
- [ ] Primary agent folder created and filled
- [ ] Channel agent(s) created with `channel-agent-prompt.md`
- [ ] Prompts reviewed and approved
- [ ] Provisioned on RecallSync and ids committed back
