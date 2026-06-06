---
id: sop_channel_agent_creation
title: Create a channel agent (BaseAgent)
status: draft
owner: vishal
created: 2026-06-04
updated: 2026-06-04
---

# SOP: Create a channel agent (BaseAgent)

## Purpose
Provision a **channel agent** on RecallSync and attach it to an existing **primary agent**.
Channel agents are created as **`BaseAgent`** records (the current builder/approach), not the
legacy `Agent` model.

> `BaseAgent` is a first-class RecallSync entity. Insta-OS has first-party support for it, but it
> is also used by RecallSync main — it is **not** Insta-OS-specific.

## Trigger
A primary agent exists and needs a worker for a specific channel (EMAIL, SMS, WHATSAPP, ...).

## Inputs (fields)
| Field | Required | Default | Notes |
|---|---|---|---|
| `primaryAgentId` | yes | — | The primary agent (wrapper) this agent attaches to |
| `name` | yes | — | Display name |
| `channel` | yes | — | `EMAIL` / `SMS` / `WHATSAPP` / `FACEBOOK` / `INSTAGRAM` / `LIVE_CHAT` / `VOICE_CALL` / `WP_VOICE_CALL` |
| `provider` | yes | — | Delivery provider — must be **allowed for the channel** AND **connected** |
| `description` | no | — | Short description |
| `baseAgentType` | **ask** | `STANDARD` | Builder type — **must be confirmed with the owner**: `STANDARD` (single prompt) or `FLOW` (multi-prompt). `RECALL` is special-purpose. |
| `type` | no | `INTEGRATED` | Agent type (`INTEGRATED` / `N8N` / `VAPI` / ...) |
| `isActive` | no | `false` | Created **paused** by default; activated explicitly later |
| `prompt` | no | seeded | STANDARD: defaults to `"You are a helpful agent."` if empty. FLOW: top-level prompt stays empty (prompt lives in the flow). Authored in the repo and synced later. |
| `n8nWorkflowId` | conditional | — | **Required when `provider = N8N`.** Pick from `list-n8n-workflows`; validated against the business N8N config |

## Builder type rule (always ask)
`baseAgentType` is **not** a silent default — always confirm it with the owner before creating:
- **`STANDARD` (single prompt)** — one system prompt drives the agent. Default for most channels.
- **`FLOW` (multi-prompt)** — a multi-step flow graph (multiple prompts / nodes).
- **`RECALL`** — special-purpose; only when explicitly required.

Ask: *"Standard (single prompt) or Flow (multi-prompt)?"* and use the answer for `baseAgentType`.

### Creation defaults (seeded server-side)
`create-channel-agent` seeds a working default so the agent is never created empty:
- **STANDARD** → `prompt` defaults to `"You are a helpful agent."` when none is provided (v1 fallback).
- **FLOW** → `flow` and `currentFlow` are seeded with the canonical default flow graph using the
  app's own `createDefaultInstaOsFlowV2()` factory (no duplicated JSON → never drifts from the
  builder). The default graph carries its own node prompt.

## Channel → allowed providers (mirrors the RecallSync UI)
- `EMAIL`: GHL, N8N
- `SMS`: TWILIO, GHL, N8N
- `WHATSAPP`: GHL, N8N, WHATSAPP
- `FACEBOOK`: GHL, N8N
- `INSTAGRAM`: GHL, N8N, INSTAGRAM
- `LIVE_CHAT`: GHL, N8N
- `VOICE_CALL`: VAPI, N8N, ELEVEN_LABS, RETELL, ULTRA_VOX
- `WP_VOICE_CALL`: INTEGRATED only (no provider picker)

## Provider connectivity rule
Simple: the requested provider must be **connected** to the business.
1. Call `list-integrations` to see connected providers (source of truth: the `Provider` table —
   both GHL and N8N live there).
2. If the provider is **not** in the list, **stop** and tell the user to connect it first
   (e.g. "GHL is not connected — set up the GHL integration in Integrations, then retry").
3. No conditional matrix beyond the channel→provider table above.

> The `create-channel-agent` tool also enforces both checks server-side and returns a clear error
> if the provider is not allowed for the channel or not connected.

## N8N provider rule
When `provider = N8N`, an **`n8nWorkflowId` is required** (same as the agent upsert UI, which shows
a required "N8N Workflow" dropdown whenever the provider is N8N).
1. Run `list-n8n-workflows` to get the business's workflows (`id` + `name`).
2. Pass the chosen `n8nWorkflowId` to `create-channel-agent`.
3. The server validates the id exists in the business N8N config; only the id is stored
   (url/token are resolved at runtime from the business config by id).

## Steps
1. Confirm the target **primary agent** (run `get-primary-agents` if you need the id).
2. Confirm the **channel** and **provider** with the owner.
3. **Confirm the builder type**: Standard (single prompt) or Flow (multi-prompt) → `baseAgentType`.
4. Run `list-integrations` and verify the provider is connected. If not → stop, ask to connect.
5. If provider is **N8N**, run `list-n8n-workflows` and pick the `n8nWorkflowId`.
6. Run `create-channel-agent` with at least `primaryAgentId`, `name`, `channel`, `provider`,
   `baseAgentType` (+ `n8nWorkflowId` for N8N). Created paused (`isActive: false`) with empty prompt.
7. Mirror it in the AIOS repo: add the channel folder
   (`agents/primary-agent/<primary-agent-name>/<channel>/`) with `channel-agent.yaml` +
   `channel-agent-prompt.md`, and write the returned `baseAgent.id` back. Commit.
8. Author behavior:
   - **STANDARD** → `channel-agent-prompt.md`, sync via `prompting-standard.md`.
   - **FLOW** → `channel-agent-flow.json` (exported bundle), sync via `prompting-flow.md`.
9. Test the agent with `sops/channel-agent/testing.md`.
10. After owner approval, activate with `update-channel-agent` using `{ id, isActive: true }`.

## Human-in-the-loop
Owner confirms channel + provider + builder type (steps 2–3) and prompt before activation.

## Output
- A live `BaseAgent` on RecallSync, attached to the primary. It is created paused and only
  activated after testing/approval.
- A committed AIOS channel-agent folder linked by `baseAgent.id`.

## Done criteria
- [ ] Builder type (Standard vs Flow) confirmed with owner
- [ ] Provider connectivity verified via `list-integrations`
- [ ] `create-channel-agent` succeeded; id captured
- [ ] AIOS channel-agent folder created at `agents/primary-agent/<name>/<channel>/` and id committed back
- [ ] Prompt authored (and later synced) before activation
- [ ] Agent tested and owner approved activation
- [ ] `update-channel-agent` set `isActive: true`
