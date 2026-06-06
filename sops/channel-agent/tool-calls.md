---
id: sop_channel_agent_tool_calls
title: Add a tool call (HTTP) to a channel agent
status: draft
owner: vishal
created: 2026-06-04
updated: 2026-06-04
---

# SOP: Add a tool call (HTTP) to a channel agent

## Purpose
Give a channel agent the ability to call an external HTTP endpoint during a conversation — e.g.
**after qualification, hand off the captured lead** by POSTing `name`, `phone`, and a short
`summary` to a CRM / n8n webhook.

> Scope: STANDARD (single-prompt) agents, whose tools live on `BaseAgent.tools` (JSON). FLOW agents
> use **`ba_http` nodes** in the flow graph — see `prompting-flow.md`.

## Golden rule: read context first
Read the root `/context` before drafting tool names/descriptions so they match brand + intent.

## Secrets live in env vars (the agent never reads or pastes them)
We do **not** paste auth secrets or hardcode them in the repo, and **the agent never reads `.env` /
`.env.local`**. Instead:

1. The owner adds the secret to **`.env.local`** (or `.env`, both gitignored) under a stable name.
2. The committed **`.env.example`** registry documents `name -> purpose` (no values). Default auth
   scheme: **Header `Authorization: Bearer <token>`**.
3. Repo artifacts (FLOW `ba_http` headersJson, STANDARD tool headers) **reference the var by name**,
   e.g. `Authorization: Bearer ${AIOS_N8N_WEBHOOK_TOKEN}` — no secret in Git.
4. At push time, local **scripts** read env, substitute the placeholder, and **encrypt** the value
   before it goes to RecallSync via MCP (ciphertext in the DB, decrypted at runtime). Plaintext never
   reaches the agent or Git.

Default secret for FunAway / n8n webhooks: **`AIOS_N8N_WEBHOOK_TOKEN`**. When wiring a new tool, ask
the owner *which env var* to use as the bearer (suggest from `.env.example`); if a new one is needed,
ask them to add it to `.env.local` and to `.env.example` (name + purpose).

## Mandatory: smoke-test the endpoint BEFORE wiring it
**Whenever the owner gives a tool/webhook URL, verify it first** — before adding it to any agent
(STANDARD `tools` or FLOW `ba_http`). This catches dead endpoints, 404s (wrong/unregistered path),
and **auth errors** early, instead of debugging them through a flow test later. Use the script (it
reads the token from env; the agent never sees it, and only the status is printed):

```bash
node scripts/smoke-webhook.mjs --url "<serverUrl>" --var AIOS_N8N_WEBHOOK_TOKEN
```

Pass criteria: `RESULT: PASS` (HTTP `2xx`). If you see:
- **`404` / "webhook not registered"** → wrong path or the workflow isn't active. Ask the owner.
- **`401` / `403`** → the token is wrong or the auth scheme doesn't match. NOTE: n8n returns
  `WWW-Authenticate: Basic` on *any* webhook-auth failure, even when the node uses Header/Bearer auth
  — so a 403 usually means the **token value is wrong**, not that you must switch to Basic. Confirm
  the correct env token with the owner.

Do **not** push a tool/flow that failed smoke verification — report the status to the owner and
resolve auth/path first. (If the owner verified it themselves, ask them to confirm it passed.)

## How a tool call works (STANDARD agent)
Each tool is one HTTP definition:

| Field | Required | Notes |
|---|---|---|
| `name` | yes | Short identifier, e.g. `handoff_qualified_lead` |
| `description` | yes | Tells the LLM **when** to call it (e.g. "Call once you have the person's name and phone, to hand the qualified lead to the team"). |
| `serverUrl` | yes | The endpoint. **http(s) only.** |
| `headers` | no | Auth / content headers (e.g. `Authorization`). **Secrets — not committed to the repo.** |
| `parameters` | for dynamic data | Fields the **LLM fills from the conversation** (e.g. `name`, `phone`, `summary`). Sent in the JSON body. |

Runtime behavior:
- The platform always appends `leadId`, `baseAgentId`, `baseAgentChannel` as **query params**.
- Method is **POST** with a JSON body when there are parameters/body, else GET.
- 15s timeout; the response (status + truncated body) is returned to the LLM so it can react.
- The LLM decides **when** to call based on the `description` + the agent prompt — we do **not**
  hardcode "call the tool" mechanics into the prompt.

## Intake (what we ask the owner)
When adding a tool, collect:
1. **serverUrl** — the endpoint to call.
2. **headers** — any auth/content headers (or "none"). Secrets entered at push time, not committed.
3. **body fields (parameters)** — the data to send. Default for receptionist handoff:
   `name`, `phone`, `summary`.
4. **when to call** — the trigger condition (we draft the `description`, owner confirms).

## Steps
1. Read `/context`.
2. Confirm the target agent: `baseAgentId` + `baseAgentType = STANDARD` (`get-primary-agents`).
3. **Smoke-verify** the provided URL + auth via `scripts/smoke-webhook.mjs` (see "Mandatory" above).
   Resolve any 404/auth error with the owner before continuing.
4. Gather the intake (serverUrl, headers, parameters, trigger) and lock `name` + `description`.
5. Author the tool spec in the repo (non-secret) under the channel agent folder; keep secrets out.
6. Push the tool(s) to the live agent with `set-channel-agent-tools` (replaces the full tool set;
   send an empty array to clear all tools).
7. Make sure the prompt nudges the handoff after qualification (intent only, not mechanics).
8. **Test** with `sops/channel-agent/testing.md`: clear history, run a full qualification, and
   confirm the tool fires with `name`/`phone`/`summary` (+ `leadId`). For first validation point
   `serverUrl` at a capture URL (e.g. webhook.site) to inspect the exact payload.
9. Repoint `serverUrl` to the real endpoint; re-test; iterate on `description` if it fires too
   early/late.

## Human-in-the-loop
Owner confirms `serverUrl`, headers, body fields, and the trigger condition before the tool is
pushed/activated.

## Security & storage
- **http(s) only.** Secrets live in `headers`, stored on the agent in RecallSync — **never commit
  secrets to the repo** (mirrors brain/runtime separation: authored intent in Git, secrets in RecallSync).
- The repo keeps a **non-secret** tool spec (name, description, serverUrl, parameter list) for review
  and re-push; header values are supplied at push time.

## Done criteria
- [ ] Trigger condition + `description` locked with owner
- [ ] Tool spec authored in repo (no secrets)
- [ ] Tool pushed to the live agent
- [ ] Test fired the tool with the expected payload (verified at a capture URL)
- [ ] `serverUrl` repointed to the real endpoint and re-tested
