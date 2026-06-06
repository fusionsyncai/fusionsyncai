---
id: sop_channel_agent_prompting_standard
title: Author a single-prompt (STANDARD) channel agent
status: draft
owner: vishal
created: 2026-06-04
updated: 2026-06-04
---

# SOP: Author a single-prompt (STANDARD) channel agent

## Purpose
Produce a high-quality **system prompt** for a `STANDARD` channel agent (`baseAgentType = STANDARD`)
and sync it to RecallSync. For a STANDARD `BaseAgent`, this single prompt is what the platform LLM
uses to generate replies, so the prompt *is* the agent's behavior.

> For multi-prompt / multi-step agents use `prompting-flow.md` (FLOW agents) instead.

## Golden rule: read context first
**Always** read the root `/context` folder before drafting (e.g. `context/fusionsyncai.base.md`,
`context/fusionsyncai-contact-info.md`). The prompt must reflect real brand positioning, offers,
contacts, and the "do NOT position as a chatbot/automation agency" guidance.

## What we lock (collaboratively, with the owner)
Prompt authoring is an **iterative back-and-forth**. We lock each of these before finalizing:
1. **Role & identity** — who the agent is and who it represents.
2. **Audience** — who it talks to (segment, intent, sophistication).
3. **Primary goal & success criteria** — the one outcome it drives toward.
4. **Channel norms** — medium conventions (EMAIL: subject, greeting, length, format).
5. **Scope & boundaries** — what it handles, what it refuses, what it must not claim.
6. **Knowledge it can rely on** — facts from `/context` (offers, CTAs, contacts); everything else
   is "don't invent".
7. **Response style & tone** — brand voice, concision, formatting; banned framings.
8. **Conversation arc** — typical steps (e.g. acknowledge → qualify → answer → CTA → handoff).
9. **Guardrails** — no hallucinated pricing/promises, compliance, safe fallbacks.
10. **Human-in-the-loop / escalation** — when and how to hand off to a human/closer.
11. **Call to action** — the default next step (e.g. Free AI Audit / 7-day pilot / book a call).

## Process
1. **Read `/context`.**
2. Identify the agent: get `baseAgentId` + channel (`get-primary-agents`), confirm `baseAgentType = STANDARD`.
3. **Pull latest first (mandatory).** Run pull-before-edit per `sync.md`: pull the live agent
   (`get-channel-agent`) so you edit on top of current live content. If the local copy has unsaved
   edits, stop and ask the owner before overwriting.
4. **Discovery Q&A** with the owner to lock the 11 elements above (iterate; don't assume).
5. Draft **prompt v1** in `agents/primary-agent/<primary-agent-name>/<channel>/channel-agent-prompt.md`.
6. Review with the owner; revise wording until approved.
7. **Sync** the approved prompt to the live `BaseAgent`:
   `update-channel-agent` with `{ id: <baseAgentId>, prompt: <file contents> }`.
8. Mark `channel-agent.yaml` `synced: true` + `last_synced_at`, and commit.
9. **Test** with `testing.md` (`test-channel-agent`) and refine based on real replies (re-sync on change).

## Related SOPs
- `sync.md` — pull-before-edit + push (run before and after editing)
- `tool-calls.md` — STANDARD tools + secret handling
- `testing.md` — test the agent after syncing

## Human-in-the-loop
The owner approves the final prompt before it is synced/activated.

## Output
- An approved `channel-agent-prompt.md` in the agent's repo folder (versioned).
- The same prompt synced to the live `BaseAgent` on RecallSync.

## Done criteria
- [ ] `/context` read and reflected in the prompt
- [ ] All 11 elements locked with the owner
- [ ] `channel-agent-prompt.md` drafted, reviewed, approved
- [ ] Synced to the live agent via `update-channel-agent`; `channel-agent.yaml` `synced: true`
- [ ] Tested via `test-channel-agent`; replies match intent
