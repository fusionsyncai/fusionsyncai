---
id: sop_reset_repo_for_new_business
title: Reset the repo for a new business (template clean)
status: active
owner: vishal
created: 2026-06-05
updated: 2026-06-05
---

# SOP: Reset the repo for a new business (template clean)

## Purpose
Turn a copy of this repo into a **fresh AIOS instance for a different business**. One repo =
one business = one RecallSync sub-account (fixed by its own MCP api key). This SOP strips out the
previous business's data and identity while keeping the reusable **framework** intact, so the new
business starts clean.

> Mental model: separate the **AIOS framework** (reusable IP — keep) from the **business instance**
> (the previous business's data — delete). Cloning = keep the framework, wipe the instance, swap
> identity + keys.

## Trigger
The owner explicitly asks to "clean / reset the repo for a new business" (e.g. onboarding a new
client sub-account). **Do not run any of the deletions in this SOP unless explicitly asked.**

## Inputs
- The new business's **name** and a short **slug** (e.g. `acme-events`).
- The new business's **RecallSync MCP api key** (resolves its sub-account).
- The new business's **context source** (website, brief, or docs) to author fresh context.
- New secret values for `.env.local` (see `.env.example`).

## What gets DELETED / replaced (business instance)
- `agents/primary-agent/*` — all live agents of the previous business. **Always wipe** — never
  carry agents across businesses (their encrypted header secrets are tied to the old
  `ENCRYPTION_KEY` and won't decrypt under the new key).
- `context/<old-business>*.md` (and any other previous-business context) — replace with new context.
- `sprints/sprint-*.md` — previous business's work log / decisions.
- `playbooks/*` (except `README.md`) — previous business's campaign definitions.
- Local-only / gitignored (won't exist in a fresh clone; recreate per new business):
  `.env.local`, `.cursor/mcp.json`.

## What gets KEPT (framework — do NOT touch)
- `sops/**` — these procedures (including this one).
- `recallsync/**`, `scripts/**`.
- `agents/_template/**` and every `README.md`.
- Registry / config templates: `.env.example`, `.cursor/.mcp.example.json`, `.gitignore`,
  `.cursorignore`, `LICENSE`.
- `telegram-bridge/` source (it's configured via env, not committed secrets).

## Gray-area items (confirm with owner)
- **SOP worked-examples** (`sops/channel-agent/prompting-*.md`, `tool-calls.md` reference
  Brain/FunAway): these are teaching material, not config. **Keep by default.** Only genericize if
  the new repo is client-facing and must not show the prior brand.
- **Branding** (`README.md` title, `package.json` / `telegram-bridge` name): keep the framework
  brand by default; genericize only if white-labeling for a client.

## Steps

### 1. Confirm scope (human approval)
- [ ] Owner has explicitly asked to reset for a named new business.
- [ ] Confirm git history strategy:
  - Preferred: the repo was created via the **GitHub "template repository"** feature (fresh
    history already). Nothing to do.
  - Otherwise, to start history fresh: `git checkout --orphan main && git add -A && git commit`.
- [ ] Confirm gray-area decisions (keep vs genericize SOP examples / branding).

### 2. Wipe the business instance
> Destructive. Re-confirm with the owner before running.
```bash
# agents (keep the template + README)
git rm -r --cached agents/primary-agent/* 2>/dev/null || true
rm -rf agents/primary-agent/*

# context (remove previous-business context files)
rm -f context/*.md            # you will re-author new context in step 4

# sprints (keep README)
rm -f sprints/sprint-*.md

# playbooks (keep README)
find playbooks -type f ! -name 'README.md' -delete
```

### 3. Establish the new identity
- [ ] Create/refresh a single canonical identity file `context/business.yaml` with at least:
  `name`, `slug`, `domain`, `timezone`, `recallsync_subaccount_note`, `primary_webhook_host`.
- [ ] (If white-labeling) update `README.md` title and `package.json` `name` to the new slug.

### 4. Author fresh context
- [ ] Write `context/<slug>.base.md` (what the business is, positioning, offers, audience) and a
  contact-info file, from the new business's source material.
- [ ] Keep operational data OUT of the repo (no leads/conversations).

### 5. Reset secrets (never commit real values)
- [ ] `cp .env.example .env.local` and fill the new values: `RECALL_API_KEY`, `ENCRYPTION_KEY`
  (must match the new business's recallsync-app key), `AIOS_N8N_WEBHOOK_TOKEN`, telegram tokens.
- [ ] Set `.cursor/mcp.json` from `.cursor/.mcp.example.json` with the new MCP api key.
- [ ] The agent must NOT read `.env.local`. Mint any header secrets as ciphertext via
  `scripts/secret.mjs` so the repo only ever holds encrypted values (see
  `sops/channel-agent/sync.md`).

### 6. Reset the sprint log
- [ ] Create a fresh `sprints/sprint-01-*.md` from the sprint conventions (new goal, empty
  decision log). Do not carry over the previous business's decisions.

### 7. Verify the clean (no previous-business leakage)
- [ ] Run a leakage grep for the previous business's tokens (replace with the actual old
  slug/brand):
```bash
rg -i 'fusionsync|funaway|brain' \
  --glob '!**/node_modules/**' --glob '!sops/**' --glob '!agents/_template/**'
```
  Expected: **no hits** outside intentionally-kept framework/example files. Investigate any hit.
- [ ] Confirm `agents/primary-agent/` contains only what you intend (typically empty until the
  first new agent is created via `sops/channel-agent/creation.md`).

### 8. Smoke-test the new connection (MCP)
- [ ] List primary agents for the new sub-account (e.g. `get-primary-agents`). The result must be
  the **new** business (its own / empty agents) — it must **not** show the previous business's
  agents (e.g. no `Brain` / `FunAway`). If it shows the old agents, the api key in
  `.cursor/mcp.json` is still the old one — fix before continuing.

### 9. First commit
- [ ] Stage changes, run the pre-commit sanity check, and commit the clean baseline:
```bash
git add -A
bash scripts/precommit-sanity.sh   # must print "RESULT: ✓ SAFE"
git commit -m "chore: reset AIOS repo for <new business>"
```

## Human-in-the-loop
- Step 1: explicit owner approval that a reset for a named business is intended.
- Step 2: re-confirm before destructive deletes.
- Step 5: never commit real secret values; missing/ambiguous secrets → ask the owner.
- Step 8: if the smoke test shows the old business, STOP — the api key was not swapped.

## Output
A repo containing only the framework + the new business's identity, context, secrets, and a fresh
sprint log; the MCP resolves the **new** sub-account; no traces of the previous business remain
outside intentionally-kept framework/example files.

## Done criteria
- [ ] `agents/primary-agent/*` wiped (only `_template/` + `README.md` remain under `agents/`)
- [ ] Previous-business `context/`, `sprints/sprint-*`, and `playbooks/*` removed/replaced
- [ ] `context/business.yaml` + new context authored
- [ ] `.env.local` + `.cursor/mcp.json` set with the new business's values (not committed)
- [ ] Leakage grep returns only allow-listed framework/example hits
- [ ] MCP smoke test returns the NEW sub-account (not the old agents)
- [ ] Clean baseline committed after pre-commit sanity check

## Related SOPs
- `channel-agent/creation.md` — create the new business's first agent.
- `channel-agent/sync.md` — pull/push + secret handling (ciphertext headers).
- `git-commit.md` — commit + mandatory pre-commit sanity check.
```
