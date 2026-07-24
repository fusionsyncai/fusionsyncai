---
id: sop_channel_agent_sync
title: Agent state lives in RecallSync (no local mirror)
status: active
owner: vishal
created: 2026-06-04
updated: 2026-07-01
---

# SOP: Agent state lives in RecallSync (no local mirror)

## Purpose
Define how to read and write agent configuration. **RecallSync is the only source of truth** for
primary agents, channel agents, prompts, and flows. This repo does **not** mirror agents under
`agents/`.

## Source of truth

| What | Where |
|---|---|
| Primary agents, channel agents, prompts, flows | **RecallSync** (MCP or CLI) |
| Business context, SOPs, playbooks | **This repo** (`context/`, `sops/`, …) |
| Leads, conversations, campaign results | **RecallSync** (never in Git) |
| Secrets (API tokens, webhook auth) | **RecallSync DB** + `.env.local` for local scripts only |

## Before editing an agent

1. **Fetch live state** — `get-channel-agent` (MCP) or `channel-agent get --id` (CLI).
2. Edit in RecallSync UI, or push via MCP/CLI (`update-channel-agent`, `set-channel-agent-flow-draft`).
3. **Test** with `test-channel-agent` / `channel-agent test` (see `testing.md`).

There is no pull-to-repo or commit-back step.

## Push FLOW drafts

1. Optionally reconcile HTTP header placeholders with `scripts/reconcile-flow.mjs --flow <exported-json-path>`.
2. Push via `set-channel-agent-flow-draft` (MCP) or `channel-agent set-flow-draft` (CLI).
3. Use `publish: true` only after owner approval.

## Push STANDARD prompts

`update-channel-agent` with `{ id, prompt }` (MCP) or `channel-agent update` (CLI).

## Secret handling

- Git must **never** contain raw tokens.
- For FLOW `ba_http` nodes: use `${ENV_VAR}` placeholders in exported JSON when authoring offline;
  run `scripts/reconcile-flow.mjs` locally to encrypt before push (see `tool-calls.md`).
- The Cursor agent must **not** read `.env.local`; only local scripts do.

## Done criteria

- [ ] Live agent fetched before edit
- [ ] Change pushed via MCP or CLI (not saved to `agents/`)
- [ ] Tested per `testing.md`
- [ ] FLOW: published only after owner sign-off
