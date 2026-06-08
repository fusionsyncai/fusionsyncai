#!/usr/bin/env bash
# Database backup helper for the AIOS lead-factory Postgres (docker-compose `db`).
#
# Runs pg_dump INSIDE the container, so:
#   - no local pg_dump install or version-match needed
#   - credentials come from the container's own env (always correct)
# Output: a gzipped plain-SQL dump in backup/history, named with a timestamp.
# Restore later with scripts/db-restore.sh (or: gunzip -c <file> | docker exec -i
# <container> psql -U <user> -d <db>).
#
# Usage (from anywhere):
#   bash scripts/db-backup.sh                 # take a backup
#   KEEP=20 bash scripts/db-backup.sh         # also prune to the newest 20 dumps
#   CONTAINER=aios-postgres bash scripts/db-backup.sh
#
# Env overrides:
#   CONTAINER  postgres container name (default: aios-postgres)
#   KEEP       if set to a number, keep only the newest N dumps (prune older)

set -euo pipefail

CONTAINER="${CONTAINER:-aios-postgres}"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || { cd "$(dirname "$0")/.." && pwd; })"
DEST_DIR="$ROOT/backup/history"
mkdir -p "$DEST_DIR"

# Verify the container is running.
if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "FAIL: postgres container '$CONTAINER' is not running." >&2
  echo "      Start it with: docker compose up -d" >&2
  exit 1
fi

# Pull the db name from the container's env so the filename matches reality.
DB_NAME="$(docker exec "$CONTAINER" sh -c 'printf %s "$POSTGRES_DB"')"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUT_FILE="$DEST_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "Backing up '$DB_NAME' from container '$CONTAINER'..."

# pg_dump over the local unix socket inside the container (trust auth, no password).
# --clean --if-exists makes the dump safe to re-import over an existing schema.
if docker exec "$CONTAINER" sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner' \
  | gzip > "$OUT_FILE"; then
  SIZE="$(du -h "$OUT_FILE" | cut -f1)"
  echo "OK: $OUT_FILE ($SIZE)"
else
  # Don't leave a half-written/empty file behind on failure.
  rm -f "$OUT_FILE"
  echo "FAIL: pg_dump failed; no backup written." >&2
  exit 1
fi

# Optional retention: keep only the newest $KEEP dumps for this db.
# Portable (bash 3.2 / macOS): list newest-first, delete everything past KEEP.
if [[ -n "${KEEP:-}" ]]; then
  if [[ "$KEEP" =~ ^[0-9]+$ ]]; then
    ls -1t "$DEST_DIR/${DB_NAME}_"*.sql.gz 2>/dev/null \
      | tail -n +"$((KEEP + 1))" \
      | while IFS= read -r old; do
          rm -f "$old" && echo "pruned: $old"
        done
  else
    echo "warn: KEEP='$KEEP' is not a number; skipping prune." >&2
  fi
fi
