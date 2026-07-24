# Agents

**RecallSync is the source of truth.** Primary agents and channel agents are **not** stored in this
repo. Create, edit, test, and activate them live via **MCP** or the **`recallsync` CLI**.

## Mental model (RecallSync schema)

- **Business** → one RecallSync sub-account (fixed by the MCP api key / `RECALL_API_KEY`).
- **PrimaryAgent** → wrapper that groups channel agents. Carries `agentGoal`,
  `goalCompleteCriteria`, `stopScenarioDescription`, and calendar linkage. **No prompt.**
- **BaseAgent** (channel agent) → per-channel worker with `channel`, `provider`, and
  `baseAgentType` (`STANDARD` | `FLOW` | `RECALL`).

## How to work with agents

| Task | MCP tool | CLI |
|------|----------|-----|
| List primary agents | `get-primary-agents` | `primary-agent list` |
| Get one channel agent | `get-channel-agent` | `channel-agent get --id` |
| Create primary agent | `create-primary-agent` | `primary-agent create` |
| Create channel agent | `create-channel-agent` | `channel-agent create` |
| Update STANDARD prompt | `update-channel-agent` | `channel-agent update` |
| Push FLOW draft | `set-channel-agent-flow-draft` | `channel-agent set-flow-draft` |
| Test (DB-only) | `test-channel-agent` | `channel-agent test` |

Always pass **`--json`** on CLI commands. Wrapper: `node scripts/recallsync-cli.mjs --json …`

## SOPs

- Create: `sops/channel-agent/creation.md`, `sops/create-agent.md`
- STANDARD prompts: `sops/channel-agent/prompting-standard.md`
- FLOW graphs: `sops/channel-agent/prompting-flow.md`
- Test: `sops/channel-agent/testing.md`
- Troubleshoot flows: `sops/channel-agent/flow-troubleshooting.md`

## What stays out of the repo

- Agent configs, prompts, and flow graphs (live in RecallSync only).
- Operational data (leads, conversations, results).
- Secrets (API tokens, encrypted HTTP headers) — set in RecallSync / `.env.local` for local scripts only.
