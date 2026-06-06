---
id: sop_channel_agent_flow_troubleshooting
title: Troubleshoot a flow-based (FLOW) channel agent
status: active
owner: vishal
created: 2026-06-04
updated: 2026-06-04
---

# SOP: Troubleshoot a flow-based (FLOW) channel agent

## Purpose
A catalog of **real failure patterns** seen when authoring/testing `FLOW` agents, each with the
symptom, root cause, and the fix that worked. Use this when a flow "almost works" but behaves
subtly wrong in testing.

> Author/structure reference: `prompting-flow.md`. Testing loop: `testing.md`. HTTP/secrets:
> `tool-calls.md`.

## How to use this guide
1. Reproduce the issue with a clean run — **always** `clear-test-conversation` before
   `test-channel-agent` (otherwise prior turns contaminate routing).
2. Match the symptom below.
3. Apply the fix in `channel-agent-flow.json`, re-push the draft
   (`set-channel-agent-flow-draft`), clear history, and re-test.
4. Only `publish: true` after the owner signs off.

---

## Pattern 1 — First objective routes too eagerly (skips the question)

**Symptom:** On the very first message (e.g. "Hi, just saw your post"), the agent jumps straight
to a later stage (e.g. pitching destinations) instead of *asking* its opening question.

**Root cause:** The entry node is a `ba_objective` with outcomes. The runtime classifies the
thread **on the same turn** and, for a vague opener, still picks the "closest" outcome
(`just_exploring`) instead of `no_match`. So it transitions and replies from the next node — the
opening question is never asked.

**Fix:** Make the opening turn **deterministic**. Put a `ba_sendMessage` (prompt mode,
`standalone: true`) as the `entryNodeId`, wired `out → <greeting objective>`. The sendMessage
always asks the intent question first; routing happens on the *next* user message.

```text
agent → msg-intent (ba_sendMessage, standalone) → obj-greeting (router) → ...
```

- Tightening outcome `description`s alone is **not** reliable for turn 1 — the classifier still
  leans toward a match. Use the deterministic sendMessage gate.
- Keep `entryNodeId` and the single `agentRoot → entry` edge in sync when you do this.

---

## Pattern 2 — A "negative" outcome misfires before the question is asked

**Symptom:** A stage is skipped entirely. Example: Ibiza budget step never asks for budget — it
routes straight to post-handoff as if the user *declined*.

**Root cause:** On entering an objective, the runtime evaluates outcomes against the existing
thread **before** the stage's question is asked. A loosely-worded decline/negative outcome
(`budget_declined: "customer didn't share a budget"`) matches simply because no budget is present
yet.

**Fix:** Scope negative/decline outcomes so they require the question to have been **asked and
answered**. Also tell the objective its first job is to ask.

```json
{ "id": "budget_declined",
  "description": "ONLY after the customer has been asked for their budget and they explicitly refuse, say they don't know, or dodge it. If the question has NOT been asked yet, or no budget is mentioned, do NOT use this outcome — stay here and ask." }
```

- Add to `instructions`: *"When you arrive here, your FIRST job is to ASK ... Do NOT conclude or
  move on until they have actually responded."*
- General rule: any outcome that means "user opted out" must reference **the act of being asked**,
  not just the absence of data.

---

## Pattern 3 — Convergent post-handoff leaks branch-specific content

**Symptom:** An Ibiza lead is told to "book on the shop" — but the shop is only for
Corfu/Saranda. Branch-specific copy bleeds across destinations.

**Root cause:** Multiple branches (Ibiza budget path + Corfu/Saranda shop path) **merge into one
shared `ba_objective`** for post-handoff. Its instructions necessarily contain both branches'
rules, so the LLM applies the wrong one.

**Fix:** **Do not merge branches that need different content.** Split into one post-handoff node
per branch and wire each branch to its own:

```text
cond-destination --ibiza--> obj-budget --> http-budget --> obj-post-ibiza        (team only, no shop)
cond-destination --corfu_or_saranda--> msg-shop --> obj-post-corfu-saranda       (shop)
```

- Give each node an exclusion rule when relevant: the Ibiza post-handoff explicitly says *"NEVER
  mention or link the shop — it is ONLY for Corfu/Saranda."*
- Only merge branches when the post-state truly is identical.

---

## Pattern 4 — Post-handoff agent keeps asking new questions

**Symptom:** After handoff ("the team will reach out"), the agent keeps opening new loops —
"what experiences are you after?", "any other thoughts before they reach out?" — instead of just
answering.

**Root cause:** The post-handoff objective's goal is "stay helpful," which the model interprets as
"keep the conversation going" → it asks questions.

**Fix:** Make the post-handoff **answer-only** with explicit, enumerated bans in `instructions`:

> (1) NEVER ask the customer a question of any kind. (2) NEVER end a message with a question mark
> unless directly answering a question they just asked. (3) NEVER invite them to share more
> ("anything else?", "let me know if…"). (4) Do NOT request details or try to plan/"lock down" the
> trip — that's the team's job. End every message on a statement, not a prompt.

- Negative, enumerated rules outperform a soft "be concise" hint here.
- Re-test by asking a question (should answer + stop) **and** by sending a non-question
  ("sounds good") — it should reassure without asking back.

---

## Pattern 5 — `ba_http` handoff doesn't fire / returns 403

**Symptom:** The flow advances past the HTTP node but no webhook hit lands; or curl returns
`403` with `WWW-Authenticate: Basic realm="Webhook"`.

**Root cause / fix:**
- **Always smoke-verify the endpoint before wiring** (`scripts/smoke-webhook.mjs`, see
  `tool-calls.md`). A `403` with `WWW-Authenticate: Basic` on an n8n webhook usually means the
  **Bearer token value is wrong**, not that Basic auth is required.
- Secrets are **never committed**. Keep `headersJson` as `Bearer ${AIOS_N8N_WEBHOOK_TOKEN}` in the
  repo JSON; `scripts/reconcile-flow.mjs` substitutes + encrypts the value at **push time** only.
  Document the env name in `.env.example`.

---

## Pattern 6 — "All LLM keys failed" on flow runs

**Symptom:** A flow turn crashes with an LLM/keys error during body extraction or outcome
classification.

**Root cause:** The runtime forced `toolChoice: 'required'`; some models (e.g. `gpt-oss-20b`)
reply in plain text instead of calling the tool, which throws and cascades.

**Fix:** This was resolved in the RecallSync runtime (`base-agent-flow-runner.ts`) by removing
`toolChoice: 'required'` and relying on strong prompts + graceful fallback. If it recurs, check
that change is present rather than editing the flow JSON.

---

## Pattern 7 — Tests give contaminated / weird routing

**Symptom:** A re-test behaves differently than a fresh conversation; the agent "remembers" a
previous run's stage.

**Root cause:** The test lead reuses one persistent conversation.

**Fix:** Call `clear-test-conversation` (also clears `ChatLog`) **before every**
`test-channel-agent` run. Make this reflexive.

---

## Quick checklist when a flow "almost works"
- [ ] Cleared history before testing?
- [ ] Does turn 1 *ask* before routing? (Pattern 1)
- [ ] Any stage skipped because a decline/negative outcome is too loose? (Pattern 2)
- [ ] Do two branches share a node that needs different copy? (Pattern 3)
- [ ] Is the post-handoff truly answer-only? (Pattern 4)
- [ ] HTTP endpoint curl-verified; secrets via env var? (Pattern 5)
- [ ] Runtime `toolChoice` fix in place? (Pattern 6)

## Related SOPs
- `prompting-flow.md` — author/structure FLOW agents
- `sync.md` — pull-before-edit + push, secret normalization
- `testing.md` — test lead, clear history, multi-turn runs
- `tool-calls.md` — curl-verify endpoints, secrets via env vars
