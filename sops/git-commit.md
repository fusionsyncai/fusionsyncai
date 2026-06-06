---
id: sop_git_commit
title: Commit & push (with pre-commit sanity check)
status: active
owner: vishal
created: 2026-06-04
updated: 2026-06-04
---

# SOP: Commit & push (with pre-commit sanity check)

## Purpose
Make sure nothing sensitive (secrets, tokens, api keys, env files, MCP config)
ever reaches GitHub. Run this **every time** the user asks to commit/push.

## Trigger
User says something like "commit this", "push to development", "save this to git".

## Hard rule
**Never run `git commit` if the sanity check returns `UNSAFE` (exit code ≠ 0).**
Stop, report the finding, and fix it first.

## Steps

1. **Stage** the intended changes.

```bash
git add -A          # or stage specific paths the user asked for
```

2. **Run the sanity check.** It must print `RESULT: ✓ SAFE` and exit `0`.

```bash
bash scripts/precommit-sanity.sh
```

   The check verifies, against the **staged** diff:
   - **Sensitive files blocked** — `.env`, `.env.local`, `.env.*.local`,
     `.cursor/mcp.json`, `*.pem` are never committed (`.env.example` is allowed).
   - **No real secret values** — every value in `.env.local`
     (`RECALL_API_KEY`, `AIOS_N8N_WEBHOOK_TOKEN`, …) is searched for in the diff
     and must be absent. (Secrets are never printed.)
   - **No secret patterns** — raw `Bearer <token>`, `sk-…`, `ghp_…`, `xox..-…`,
     `AKIA…`, `AIza…`, inline `secret=`/`password=`. Doc placeholders
     (`${VAR}`, `<token>`, `api_key`, `your-…`, `example`) are ignored.
   - **Agent headers use placeholders** — any `agents/**` `Authorization` header
     must reference `${VAR}`, never a resolved value.

3. **If `UNSAFE`:** read the flagged lines, fix the leak (move the value to
   `.env.local`, replace with `${VAR}` placeholder, unstage the file, or add it
   to `.gitignore`), then go back to step 1. Do **not** proceed.

4. **If `SAFE`:** review the staged file list / diffstat printed by the check.
   Confirm only the files the user intended are included. If anything unexpected
   is staged, stop and ask.

5. **Confirm the target branch** before pushing. Current default branch is shown
   by `git rev-parse --abbrev-ref HEAD`. If the user names a branch (e.g.
   `development`) that differs, confirm with them before switching/pushing.

6. **Commit** with a clear message (HEREDOC).

```bash
git commit -m "$(cat <<'EOF'
<concise summary of what changed and why>
EOF
)"
```

7. **Push** only to the branch the user specified.

```bash
git push origin <branch>
```

8. **Verify** the push succeeded (`git status` shows "up to date") and report
   the result + commit hash to the user.

## Human-in-the-loop
- Step 3: any `UNSAFE` result — stop and surface it; do not auto-bypass.
- Step 4/5: unexpected staged files or branch mismatch — confirm before commit/push.
- Never `--force` push, never `--no-verify`, never edit git config.

## Output
A commit pushed to the requested branch with zero secrets leaked.

## Done criteria
- [ ] `scripts/precommit-sanity.sh` returned `SAFE` (exit 0)
- [ ] Staged file list reviewed; only intended files included
- [ ] Correct branch confirmed
- [ ] Commit created and pushed
- [ ] Push verified (`git status` clean / up to date)

## Related SOPs
- `sops/channel-agent/sync.md` — secret normalization (`${VAR}` ↔ real value)
