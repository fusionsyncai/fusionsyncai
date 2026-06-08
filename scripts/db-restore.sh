#!/usr/bin/env bash
# Restore a Postgres backup produced by scripts/db-backup.sh.
#
# Streams a gzipped plain-SQL dump INTO the container's psql. The dumps are made
# with --clean --if-exists, so this drops & recreates objects before loading —
# i.e. it overwrites the current database with the backup's contents.
#
# Usage (from anywhere):
#   bash scripts/db-restore.sh backup/history/<file>.sql.gz
#   bash scripts/db-restore.sh --latest          # restore the newest dump
#   CONTAINER=aios-postgres bash scripts/db-restore.sh --latest
#
# This is DESTRUCTIVE — it asks for confirmation unless FORCE=1 is set.

set -euo pipefail

CONTAINER="${CONTAINER:-aios-postgres}"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || { cd "$(dirname "$0")/.." && pwd; })"
DEST_DIR="$ROOT/backup/history"

if [[ $# -lt 1 ]]; then
  echo "Usage: bash scripts/db-restore.sh <file.sql.gz | --latest>" >&2
  exit 2
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "FAIL: postgres container '$CONTAINER' is not running." >&2
  exit 1
fi

DB_NAME="$(docker exec "$CONTAINER" sh -c 'printf %s "$POSTGRES_DB"')"

# Resolve the dump file: explicit path or --latest for this db.
if [[ "$1" == "--latest" ]]; then
  FILE="$(ls -1t "$DEST_DIR/${DB_NAME}_"*.sql.gz 2>/dev/null | head -1 || true)"
  if [[ -z "$FILE" ]]; then
    echo "FAIL: no dumps found in $DEST_DIR for db '$DB_NAME'." >&2
    exit 1
  fi
else
  FILE="$1"
fi

if [[ ! -f "$FILE" ]]; then
  echo "FAIL: file not found: $FILE" >&2
  exit 1
fi

echo "About to RESTORE '$DB_NAME' (container '$CONTAINER') from:"
echo "  $FILE"
echo "This OVERWRITES the current database."

if [[ "${FORCE:-}" != "1" ]]; then
  read -r -p "Type 'yes' to continue: " CONFIRM
  if [[ "$CONFIRM" != "yes" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# Stream the gunzipped SQL into psql inside the container. ON_ERROR_STOP makes a
# bad dump fail loudly instead of half-applying silently.
gunzip -c "$FILE" | docker exec -i "$CONTAINER" sh -c \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "OK: restored from $FILE"
