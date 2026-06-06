---
id: sop_channel_agent_testing
title: Test a channel agent (test lead)
status: draft
owner: vishal
created: 2026-06-04
updated: 2026-06-04
---

# SOP: Test a channel agent (test lead)

## Purpose
Exercise a channel agent (`BaseAgent`) end-to-end from AIOS by sending it a message **as the
business's designated test lead** and reading the agent's reply — **without** any real channel
delivery (nothing is sent to WhatsApp / Instagram / Email / GHL). Used to sanity-check behavior
before activation and after prompt/flow changes.

## Test lead is required (not optional)
The message is sent **on behalf of the test lead** — i.e. as if that lead messaged the agent. So a
test lead must exist first:
- There is exactly **one** test lead per business (the lead marked `isTestLead`).
- It is set in the **RecallSync UI** (mark a lead as the test lead). We only **read** it here.
- If no test lead is set, **stop and ask the owner to set one up** — do **not** create one.

## How it works (DB-only, safe)
`test-channel-agent` calls the same core the production inbound pipeline uses but **without**
real channel delivery (GHL / native send). For **STANDARD** agents it uses
`runStandardBaseAgentConversationTurn`; for **FLOW** agents it uses `runInstaOsFlowDmTurn` on the
draft graph (`currentFlow`, falling back to `flow`).

1. Resolves the business **test lead** (`isTestLead = true`) and ensures it has a conversation.
2. Persists the inbound message as that lead.
3. Runs the agent (STANDARD prompt or FLOW graph) using the business's LLM provider.
4. Persists the AI reply to the conversation and returns it.

The test lead's conversation is **shared and persistent** (mirrors the UI test chat): existing
history is included in context and accumulates across runs/agents. **Always clear it before a fresh
test** with `clear-test-conversation` so prior turns (names, scenarios, scheduling) don't leak into
the new run.

No provider send happens. Note: a FLOW with HTTP/tool nodes can still make outbound HTTP calls
from those nodes — "no delivery" only means no channel message is sent.

## Inputs (`test-channel-agent`)
| Field | Required | Notes |
|---|---|---|
| `baseAgentId` | yes | The channel agent to test. Must be attached to a primary agent. |
| `message` | yes | The inbound message, sent as if from the test lead. |

## Pre-checks (before sending)
1. **Test lead** — `get-test-lead`. If none → stop, ask the owner to set one up in RecallSync.
2. **LLM keys** — the reply is generated with the business's LLM keys. `test-channel-agent`
   enforces this server-side and errors if no active LLM key exists; if so, **stop** and ask the
   owner to add an LLM API key in RecallSync, then retry. (Use `list-integrations` to see whether
   the `LLM` provider is connected.)

## Steps
1. **Get the test lead** with `get-test-lead`.
   - If it returns no test lead → **stop** and ask the owner to set one up in RecallSync, then retry.
2. Get the `baseAgentId` (from `get-primary-agents`, which includes each primary's channel agents,
   or from the create step output).
3. **Clear history** with `clear-test-conversation` (pass `baseAgentId`) so the run starts fresh.
   Do this at the **start of every test session** — and again whenever you want a clean slate.
4. Run `test-channel-agent` with `baseAgentId` + `message`. It first verifies active LLM keys exist
   (errors clearly if not), then generates the reply.
5. Read the returned `replies`. Send follow-up turns as needed (history within this run is intended).
6. To review the full thread, run `get-conversation-messages` with the returned `conversationId`.

## Output
- `conversationId`, `leadId`, `leadName`, `outcomeReason`, and `replies[]` (the AI messages
  produced this turn).

## Notes
- The agent does **not** need to be active (`isActive`) to be tested.
- STANDARD agents reply from their `prompt`; FLOW agents run their `currentFlow` (falling back to
  `flow`). A freshly created agent uses its seeded default until you author/sync a real prompt/flow.
- Because the test lead's conversation accumulates, prior turns (even from other agents) are part
  of the context.

### FLOW-specific testing
- **Multi-turn is required** — routing (objectives), qualification, and `ba_http` handoffs only
  show up across several messages. Plan a short script (e.g. opener → interest → name/phone).
- **`clear-test-conversation`** also clears `baseAgentSession` state for that conversation, so the
  flow restarts from `entryNodeId` instead of resuming mid-graph.
- **Draft vs published:** tests use **`currentFlow`** (draft). Sync JSON edits to `currentFlow`
  before testing; publish to `flow` in the UI only after approval (see `prompting-flow.md`).
- **HTTP nodes still fire** — `ba_http` runs real outbound HTTP (e.g. n8n). Use a capture webhook
  or staging URL when validating handoff payloads.
- **Outcome routing** is not returned in the MCP test payload — infer from replies and n8n logs.
  Use `get-conversation-messages` to review the full thread.
- If the flow hits **`ba_end`** or an objective with no wired edge, the session may end; clear and
  retry with a fresh script.

## Done criteria
- [ ] Test lead confirmed via `get-test-lead` (or owner asked to set one up)
- [ ] History cleared via `clear-test-conversation` before the run
- [ ] `test-channel-agent` returned a non-empty reply (or an explained `outcomeReason`)
- [ ] Reply reviewed against the intended behavior
- [ ] Findings noted (feeds the prompt-update / conversation-analysis SOPs)
- [ ] FLOW only: multi-turn script exercised; handoff HTTP verified if applicable
