#!/usr/bin/env bash
# Pre-commit sanity check for the AIOS repo.
#
# Verifies that what's about to be committed is safe to push to GitHub:
#   1. No gitignored secret files are staged (.env, .env.local, .cursor/mcp.json, *.pem)
#   2. No real secret VALUES from .env.local appear in the staged diff
#   3. No common secret patterns (Bearer <real>, api keys) in the staged diff
#   4. Committed agent headers use ${PLACEHOLDER}, not resolved values
#
# Usage (from repo root, after `git add`):
#   bash scripts/precommit-sanity.sh
# Exit code 0 = safe to commit; non-zero = STOP, do not commit.

set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "FAIL: not inside a git repo"; exit 2;
}
cd "$ROOT"

FAILED=0
fail() { echo "  ✗ $1"; FAILED=1; }
ok()   { echo "  ✓ $1"; }

STAGED="$(git diff --cached --name-only)"
if [ -z "$STAGED" ]; then
  echo "Nothing staged. Run 'git add' first."; exit 2
fi

echo "== 1. Staged file list =="
echo "$STAGED" | sed 's/^/   /'
echo

# ---------------------------------------------------------------------------
echo "== 2. Block sensitive / ignored files =="
# Files that must NEVER be committed (even if force-added).
while IFS= read -r f; do
  case "$f" in
    .env|.env.local|.env.*.local|*/.env|*/.env.local) fail "sensitive env file staged: $f" ;;
    .cursor/mcp.json|*/.cursor/mcp.json)              fail "MCP config (contains api key) staged: $f" ;;
    *.pem)                                            fail "private key staged: $f" ;;
  esac
done <<< "$STAGED"
# .env.example is allowed (registry, no values).
[ "$FAILED" -eq 0 ] && ok "no sensitive env / config / key files staged"
echo

# ---------------------------------------------------------------------------
echo "== 3. No real secret VALUES from .env.local in the staged diff =="
if [ -f .env.local ]; then
  # Read each VALUE from .env.local and search the staged diff for it.
  # We never print the secret itself — only the file/line count if leaked.
  leak=0
  while IFS= read -r line; do
    case "$line" in ''|\#*) continue ;; esac
    val="${line#*=}"
    # strip surrounding quotes and whitespace
    val="${val%\"}"; val="${val#\"}"; val="${val%\'}"; val="${val#\'}"
    val="$(printf '%s' "$val" | xargs 2>/dev/null || printf '%s' "$val")"
    [ -z "$val" ] && continue
    # ignore trivially short values to avoid noise (still catches admin-1234)
    [ "${#val}" -lt 4 ] && continue
    if git diff --cached -G"$(printf '%s' "$val" | sed 's/[].[^$*\/]/\\&/g')" --name-only \
         | grep -q .; then
      hits="$(git diff --cached --name-only -G"$(printf '%s' "$val" | sed 's/[].[^$*\/]/\\&/g')")"
      key="${line%%=*}"
      fail "value of \$$key appears in staged changes: $(echo "$hits" | tr '\n' ' ')"
      leak=1
    fi
  done < .env.local
  [ "$leak" -eq 0 ] && ok "no .env.local values found in staged diff"
else
  echo "  (no .env.local present; skipping value scan)"
fi
echo

# ---------------------------------------------------------------------------
echo "== 4. Secret-pattern heuristics in staged diff =="
# Added lines only.
ADDED="$(git diff --cached | grep -E '^\+' || true)"
# Documentation placeholders we should NOT flag (api_key, <token>, your-token, etc.)
PLACEHOLDER='\$\{|<|>|api[_-]?key|your[_-]|example|placeholder|redacted|sample|dummy|xxx|\.\.\.'
patt='0'
check_pat() {
  # $1 = grep -Ei pattern, $2 = label. Skips lines that look like doc placeholders.
  local m
  m="$(printf '%s' "$ADDED" | grep -Ein "$1" | grep -Eiv "$PLACEHOLDER" || true)"
  if [ -n "$m" ]; then
    fail "$2 found in added lines:"
    printf '%s\n' "$m" | sed 's/^/      /'
    patt=1
  fi
}
# Bearer token that is NOT a ${PLACEHOLDER} / doc placeholder
check_pat 'bearer[[:space:]]+[a-z0-9._-]{6,}' "raw Bearer token"
check_pat 'sk-[a-z0-9]{16,}'                  "OpenAI-style key (sk-...)"
check_pat 'ghp_[a-z0-9]{20,}'                 "GitHub token (ghp_...)"
check_pat 'xox[bap]-[a-z0-9-]{10,}'           "Slack token (xox..-)"
check_pat 'akia[a-z0-9]{16}'                  "AWS access key (AKIA...)"
check_pat 'aiza[a-z0-9_-]{20,}'               "Google API key (AIza...)"
check_pat '(secret|password|passwd)[\"'\'' ]*[:=][\"'\'' ]*[a-z0-9._-]{12,}' "inline secret/password assignment"
[ "$patt" -eq 0 ] && ok "no obvious secret patterns in added lines"
echo

# ---------------------------------------------------------------------------
echo "== 5. Agent headers must use placeholders (not resolved values) =="
# Any staged agents/** file whose added lines contain an Authorization header
# without a ${...} placeholder is suspicious.
badhdr="$(git diff --cached -- 'agents/**' | grep -E '^\+' \
          | grep -Ei 'authorization' | grep -vi '\${' || true)"
if [ -n "$badhdr" ]; then
  fail "agents/** has an Authorization header without a \${...} placeholder"
else
  ok "agent Authorization headers use \${...} placeholders (or none changed)"
fi
echo

# ---------------------------------------------------------------------------
echo "== 6. Summary =="
git diff --cached --stat | sed 's/^/   /'
echo
if [ "$FAILED" -ne 0 ]; then
  echo "RESULT: ✗ UNSAFE — fix the issues above before committing."
  exit 1
fi
echo "RESULT: ✓ SAFE — staged changes look clean to commit/push."
