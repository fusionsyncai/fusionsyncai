---
sprint: 01
title: Connect RecallSync via MCP and launch an email campaign from AIOS
status: planning      # planning | in-progress | review | done
owner: vishal
started: 2026-06-04
updated: 2026-06-04
---

# Sprint 01 — RecallSync MCP + Email Campaign

## Goal
Stand up the brain → runtime link: connect this AIOS repo to **one business's** RecallSync
account via MCP, create an agent on RecallSync from a repo-defined `prompt.md`, and launch a
managed email campaign — all driven from this repo.

## Why this first
It proves the core loop end-to-end: **define in repo → push to RecallSync via MCP → run**.
Once this works, every future agent/campaign is just "more of the same on the same rails."

## Scope
**In**
- RecallSync MCP connection (single business / sub-account)
- One email agent defined in `agents/` and provisioned on RecallSync
- One email campaign defined as a playbook and launched
- The two SOPs needed to do the above

**Out (later sprints)**
- Multiple businesses / multi-account routing
- Lead enrichment, conversation analysis, voice agents
- Any operational data storage in the repo

## Tasks
- [x] Confirm RecallSync MCP is available and document its tools/auth
- [x] Enable `recallsync-primary` MCP in Cursor and list its tools
- [ ] Write `sops/sync-agent-to-recallsync.md` (how to push prompt.md → RecallSync agent)
- [ ] Write `sops/run-email-campaign.md` (how to define + launch a campaign)
- [ ] Create the first email agent: `agents/primary-agent/<name>/email/` (channel-agent.yaml + channel-agent-prompt.md)
- [ ] Define `human_in_loop` checkpoints for outreach (draft approval before send)
- [ ] Provision the agent on RecallSync via MCP; commit back `recallsync.agent_id`
- [ ] Create `playbooks/<campaign>.md` (objective, ICP, offer, sequence)
- [ ] Launch the email campaign through RecallSync from the repo
- [ ] Capture learnings / decisions below

## Open questions
- Which RecallSync sub-account is this repo bound to?
- What is the campaign target (ICP) and offer for the first run?
- Exact human-in-loop boundary for sends (approve each / approve sequence / fully auto)?

## Decisions log
- 2026-06-04: Repo = one business = one RecallSync MCP/sub-account.
- 2026-06-04: Agents stored as folder (agent.yaml + prompt.md); SOPs/playbooks/sprints as Markdown.
- 2026-06-04: Connected to RecallSync **primary** MCP via StreamableHTTP at `/mcp` (ngrok tunnel).
  Config in `.cursor/mcp.json` (gitignored — holds `api_key`).
- 2026-06-04: Finalized agent layout →
  `agents/primary-agent/<primary-agent-name>/<channel>/channel-agent-prompt.md`
  (flat, no `channel-agents/` wrapper). Channel agents are `BaseAgent`s. Prompts authored in-repo
  then pushed via `update-channel-agent` (`prompt`).
- 2026-06-04: Auth updated — the primary `/mcp` route now forwards the caller's `api_key`
  header into tool calls, and tools pass it to RecallSync REST as `Authorization: Bearer <api_key>`.
  Business identity is now resolved per request by RecallSync's REST layer.
- 2026-06-04: Primary MCP tool surface includes lead, tag, meeting, note, follow-up,
  voice-campaign, and `get-primary-agents`.

## Notes
-
