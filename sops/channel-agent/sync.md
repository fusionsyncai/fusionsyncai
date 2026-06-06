---
id: sop_channel_agent_sync
title: Sync agents between AIOS and RecallSync (pull / push)
status: active
owner: vishal
created: 2026-06-04
updated: 2026-06-04
---

# SOP: Sync agents between AIOS and RecallSync

## Purpose
Keep the AIOS repo (`agents/`) and the live RecallSync business in agreement. Covers the three
distinct directions:

1. **Manual sync / pull** — mirror live → repo. **Live wins, full overwrite, then normalize secrets.**
2. **Pull-before-edit** — always pull latest before changing a prompt/flow; stop if the local copy
   has unsaved edits.
3. **Push** — repo → live. **Local wins**, but only after placeholders are reconciled to real
   values and the API guard confirms no `${...}` remains in headers.

> One AIOS repo = one RecallSync business. Operational data (leads, conversations) is never synced.

## Source of truth

| Field group | Source of truth | Notes |
|---|---|---|
| Authored behavior: STANDARD `prompt`, FLOW graph, primary `agentGoal`/`goalCompleteCriteria`/`stopScenarioDescription` | **Repo** (crafted + versioned) | pushed up via MCP |
| Runtime/integration: ids, `provider`, `channel`, `type`, `n8nWorkflowId`, account ids, `isActive`, `autoConnect`, calendar ids, timestamps | **RecallSync (MCP)** | mirrored read-only into frontmatter |
| Secrets (header tokens) | **RecallSync DB** at runtime; **never** in Git | Git stores `${ENV}` placeholders only |

On a **pull**, live is authoritative for everything (you are mirroring). Repo-authoritative fields
matter on **push** and conflict detection.

## Secret normalization (the golden rule)

Git **only ever** stores placeholders; the DB **only ever** stores **encrypted** values. **The agent
never reads `.env.local` / `.env` and never handles plaintext tokens** — local scripts do that.

| Surface | Header value |
|---|---|
| Git / local JSON+YAML | `Authorization: Bearer ${AIOS_N8N_WEBHOOK_TOKEN}` (placeholder) |
| Pushed to RecallSync | `Authorization: <ivHex:cipherHex>` (AES-256-CBC ciphertext) |
| RecallSync runtime | decrypts the ciphertext at call time |

- Real values live in `.env.local` / `.env` (gitignored), only ever read by `scripts/*.mjs`.
  Names + purpose are documented in `.env.example`.
- **Pull:** after writing the live JSON, replace every secret value with its `${NAME}` placeholder.
  If a value is ambiguous or unknown, **stop and confirm the env var name with the owner** (never
  commit a raw or encrypted secret to Git).
- **Push:** run `scripts/reconcile-flow.mjs` (FLOW) — it loads env, substitutes `${NAME}`, and
  **encrypts** Authorization bearer values, printing reconciled JSON. The agent passes that JSON to
  the MCP push tool. If a referenced var is missing, the script fails — **ask the owner to add it**.
- **API guard (server-side backstop):** RecallSync rejects any push whose header value still
  contains `${` (scans `headersJson` on flow `ba_http` nodes and tool `headers`). A rejection means
  reconciliation was missed — re-run the script and retry.
- Env var naming has **no fixed convention** (a business may use different tokens per agent/tool) —
  confirm the name with the owner when introducing a new secret, and register it in `.env.example`.

## Scripts (the only thing that touches plaintext secrets)

| Script | Purpose |
|---|---|
| `scripts/reconcile-flow.mjs --flow <path>` | Substitute `${NAME}` + encrypt bearer headers → print reconciled FLOW JSON for the MCP push tool. |
| `scripts/smoke-webhook.mjs --url <url> --var <NAME>` | Curl-verify a webhook with a bearer token from env. Prints only `HTTP <status>` + PASS/FAIL. |
| `scripts/secret.mjs encrypt` / `decrypt` | Mint/inspect a single header ciphertext (plaintext on stdin only). |

All RecallSync writes go through **MCP** — there is no REST URL in this repo.

## Tools used (MCP)

| Operation | MCP tool |
|---|---|
| Pull whole tree (all primary + channel agents) | `get-primary-agents` |
| Pull one channel agent (prompt, flow, currentFlow, tools, metadata) | `get-channel-agent` |
| Push STANDARD prompt / metadata / activation | `update-channel-agent` |
| Push STANDARD tools | `set-channel-agent-tools` |
| Push FLOW draft (+ optional publish) | `set-channel-agent-flow-draft` |

---

## Operation 1 — Manual sync / pull (live wins, full overwrite)

Use when the owner says "sync" / "pull". **Default behavior: overwrite local entirely, then
normalize.** Do NOT attempt node-level merges — a flow graph is a single artifact and partial
reconciliation is fragile when several nodes/positions change.

### Steps
1. **Fetch live.**
   - Whole repo: `get-primary-agents`.
   - Single agent: `get-channel-agent { id }`.
2. **For each primary agent** → upsert `agents/primary-agent/<slug(name)>/primary-agent.yaml`
   (metadata + authored intent). Match by `id`, not folder name; if a live name changed, **flag** —
   do not auto-rename folders.
3. **For each channel agent** → pick the source by type and **overwrite the local artifact fully:**
   - **STANDARD** → rewrite `channel-agent-prompt.md` from live `prompt`; rewrite `tools/<slug>.yaml`
     from live `tools[]`.
   - **FLOW** → rewrite `channel-agent-flow.json` from live **`currentFlow`** (the editable draft is
     our primary). The published `flow` is tracked separately (see frontmatter) — note if it differs
     from `currentFlow` (`published_flow_state`).
   - Always rewrite the `channel-agent.yaml` metadata block from live.
4. **Normalize secrets** across everything just written: real/encrypted values → `${NAME}`
   placeholders. (The agent does not read env files; if a live secret value can't be mapped to a
   known placeholder name, stop and confirm the name with the owner.)
5. **Verify** no raw/encrypted secret remains under `agents/**` (only `${NAME}` placeholders).
   The pre-commit sanity check (`scripts/precommit-sanity.sh`) is the backstop.
6. **Update the `sync:` block** (see schema) with `live_updated_at` + `last_pulled_at`.
7. Report what changed (which agents/artifacts), and flag any rename or unknown-secret cases.

### Scope
Materialize **all** primary agents (full mirror), including empty wrappers.

### Conflict on bulk pull
**Live wins** — overwrite local. (Push your local edits *before* a bulk pull if you want to keep
them.)

---

## Operation 2 — Pull-before-edit (precondition for any prompt/flow change)

**Always run this before editing a prompt or flow.** It stops you from pushing stale content over a
newer live version (e.g. a UI edit made since your last pull).

### Steps
1. **Check for local unsaved edits:** is the local artifact different from what we last pulled
   (compare against the recorded `sync.*` base / git status)?
   - If **yes** (local has uncommitted changes) → **STOP and ask the owner** whether to keep local
     (push) or discard and pull. Do not overwrite silently.
2. If local is clean → **pull latest** for that agent (`get-channel-agent`), full overwrite +
   normalize (Operation 1, single-agent).
3. Make the requested edit on top of the freshly pulled content.
4. Proceed to **Push** (Operation 3).

> Rationale: the pull is destructive (live wins). The only thing we protect is *uncommitted local
> work*, which we never discard without asking.

---

## Operation 3 — Push (local wins, reconcile + guard)

Use when publishing authored changes to RecallSync.

### Steps
1. **Pull-before-edit already done?** If you haven't pulled latest this session, do Operation 2 first.
2. **Reconcile secrets (FLOW):** run `scripts/reconcile-flow.mjs --flow <path>`. It substitutes
   `${NAME}` from env and **encrypts** Authorization headers, printing the reconciled JSON. The agent
   never sees plaintext. For STANDARD tool headers, mint ciphertext with `scripts/secret.mjs encrypt`.
   - If a referenced var is missing, the script fails → **STOP, ask the owner to add it**, then retry.
3. **Push by type (MCP only):**
   - STANDARD prompt/metadata/activation → `update-channel-agent`.
   - STANDARD tools → `set-channel-agent-tools` (encrypted header values).
   - FLOW draft → `set-channel-agent-flow-draft` with the reconciled JSON
     (`publish: true` only after owner approval).
4. **If the API guard rejects** (`${...}` found in a header) → reconciliation was missed at step 2.
   Re-run the script and retry. Never disable the guard.
5. After a successful push, **re-pull** to refresh the `sync:` base, or update `sync.live_updated_at`
   from the push response.
6. Never let a real or encrypted secret value get written back into a committed file (reconciliation
   output is fed straight to MCP, never saved under `agents/**`).

---

## Frontmatter `sync:` block (per channel agent)

Recorded in `channel-agent.yaml`:

```yaml
synced: true
last_synced_at: 2026-06-04T16:04:00Z
sync:
  source: recallsync
  local_flow_source: currentFlow      # FLOW only: which live graph the repo mirrors
  live_updated_at: 2026-06-04T16:02:19.808Z   # BaseAgent.updatedAt at last pull (drift gate)
  last_pulled_at: 2026-06-04T16:04:00Z
  published_flow_state: stale_default # FLOW only: in_sync | stale_default | diverged
```

- `live_updated_at` is the cheap "did live move?" gate: if it matches the live `updatedAt`, nothing
  changed; otherwise pull.
- `local_flow_source` documents that the repo mirrors the **draft** `currentFlow` (not published).

## Human-in-the-loop
- Pull-before-edit conflict (local unsaved changes) → owner decides keep vs discard.
- Missing env var on push → owner adds it before retry.
- Unknown/ambiguous secret on pull → owner confirms the env var name.
- `publish: true` on a FLOW push → owner approval.
- Live folder rename (name changed) → owner confirms; never auto-rename.

## Done criteria
- [ ] Local artifacts overwritten from live (pull) or pushed to live (push)
- [ ] Secrets normalized to `${ENV}` in Git; no raw values under `agents/**`
- [ ] `sync:` block updated (`live_updated_at`, `last_pulled_at`)
- [ ] FLOW: `channel-agent-flow.json` mirrors `currentFlow`; published state noted
- [ ] Push only after reconciliation; API guard passed
- [ ] Changes/flags reported to owner

## Related SOPs
- `prompting-standard.md` — STANDARD prompts (run pull-before-edit first)
- `prompting-flow.md` — FLOW graphs (run pull-before-edit first)
- `tool-calls.md` — tool headers + secret handling
- `flow-troubleshooting.md` — failure patterns
- `creation.md` — provision agents + folder layout
