# Agents

The folder structure mirrors RecallSync's model. This repo = **one Business** (one RecallSync sub-account).

```
agents/
  primary-agent/
    <primary-agent-name>/              # = RecallSync PrimaryAgent (a wrapper; no prompt)
      primary-agent.yaml               # wrapper metadata + authored intent (goal, calendar ref)
      <channel>/                       # email | sms | whatsapp | voice-call | ... (= a BaseAgent)
        channel-agent.yaml             # minimal link: id, name, channel, provider, baseAgentType
        channel-agent-prompt.md        # STANDARD only — single system prompt
        channel-agent-flow.json        # FLOW only — exact exported flow bundle (v2)
        tools/                         # optional — non-secret STANDARD tool specs
```

> Flat layout: `agents/primary-agent/<name>/<channel>/`. STANDARD → `channel-agent-prompt.md`.
> FLOW → `channel-agent-flow.json` (edit JSON in place, sync to `currentFlow`). No nested
> `channel-agents/` wrapper folder.

## Mental model (from the RecallSync schema)

- **Business** → this repo.
- **PrimaryAgent** → the wrapper that groups channel agents. Carries `agentGoal`,
  `goalCompleteCriteria`, `stopScenarioDescription`, and calendar linkage. **No prompt.**
- **BaseAgent** → the actual per-channel worker (current builder/approach). Has a `channel`, a
  `provider`, and a `baseAgentType`.
  - `channel`: `EMAIL | SMS | WHATSAPP | FACEBOOK | INSTAGRAM | LIVE_CHAT | VOICE_CALL | WP_VOICE_CALL`
  - `provider`: `GHL | N8N | WHATSAPP | INSTAGRAM | TWILIO | VAPI | ...`
  - `baseAgentType`: `STANDARD` (single prompt) | `FLOW` (multi-prompt graph)

A PrimaryAgent has a one-to-many relation to channel agents (BaseAgents).

## What the brain stores (and does not)

- **Stores (authored, versioned):** STANDARD prompts (`channel-agent-prompt.md`), FLOW graphs
  (`channel-agent-flow.json`), the primary agent's goal/criteria/stop intent, and linking ids.
- **Does NOT store:** secrets (HTTP auth headers, API tokens). Those are set at sync/push time in
  RecallSync. Other runtime config (GHL ids, calendar secrets) also lives in RecallSync.

## Notes

- `id` fields are filled **after** creation on RecallSync, then committed back so the repo can
  always resolve repo prompt ↔ live agent.
- Operational data (leads, conversations, results) never lives here.
- To create one, follow `sops/channel-agent/creation.md`. Copy `_template/` into
  `agents/primary-agent/<primary-agent-name>/` and rename `_channel/` to the channel slug.
