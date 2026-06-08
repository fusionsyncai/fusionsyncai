---
id: sop_db_backup_and_import
title: Database backup & import (Postgres / Docker)
status: active
owner: vishal
created: 2026-06-08
updated: 2026-06-08
---

# SOP: Database backup & import (Postgres / Docker)

## Purpose
Take portable, timestamped snapshots of the local lead-factory Postgres database
and restore (import) them later. Run a backup before risky changes (schema
migrations, bulk deletes, resetting the repo for a new business) and whenever you
want a restore point.

## Trigger
- Before a Prisma schema change / `db push` that could lose data.
- Before bulk operations (deleting campaigns, contacts, logs, pipelines).
- On a routine cadence (manual, or automated later — see "Notes").
- Before/after migrating the DB to another machine.

## Inputs
- Running Postgres container (`aios-postgres`) from `docker-compose.yml`.
- The repo's `backup/history/` folder (auto-created if missing).

## How it works
Both scripts run `pg_dump` / `psql` **inside the container**, so:
- no local Postgres install or version match is needed,
- credentials come from the container's own env (nothing hardcoded).

Dumps are **gzipped plain SQL** written with `--clean --if-exists --no-owner`,
so a dump can be re-imported over an existing database (it drops & recreates
objects first). Files are named `backup/history/<db>_<YYYYMMDD_HHMMSS>.sql.gz`.

## Steps

### A. Take a backup
1. Make sure the DB container is up: `docker compose up -d`.
2. From the repo root, run:
   ```bash
   npm run db:backup
   ```
3. Confirm the output line `OK: backup/history/<db>_<timestamp>.sql.gz (<size>)`.

   Optional — keep only the newest N dumps (prune older ones):
   ```bash
   KEEP=20 npm run db:backup
   ```

### B. Import / restore a backup (DESTRUCTIVE — overwrites current DB)
1. Make sure the DB container is up.
2. Restore the newest dump:
   ```bash
   npm run db:restore -- --latest
   ```
   …or a specific file:
   ```bash
   npm run db:restore -- backup/history/<db>_<timestamp>.sql.gz
   ```
3. Type `yes` at the confirmation prompt (skip the prompt with `FORCE=1`).
4. After restoring, restart the CRM app so it picks up the restored data
   (see `recallsync-app-run` / aios crm run rules for the stop → build → start cycle).

### C. Verify a dump (optional sanity check)
```bash
f=$(ls -1t backup/history/*.sql.gz | head -1)
gunzip -t "$f" && echo "gzip OK"                 # archive integrity
gunzip -c "$f" | grep -E "^CREATE TABLE"          # tables captured
```

## Human-in-the-loop
- **Restore is destructive.** It overwrites the current database. Always confirm
  the target container and file before typing `yes` (or before setting `FORCE=1`).
- Don't restore a production DB from an unverified dump — run the step C check first.

## Output
- A new `backup/history/<db>_<timestamp>.sql.gz` file (for backup), or
- The database restored to the contents of the chosen dump (for import).

## Reference
- Backup script: `scripts/db-backup.sh` (`npm run db:backup`)
- Restore script: `scripts/db-restore.sh` (`npm run db:restore`)
- Env overrides: `CONTAINER` (default `aios-postgres`), `KEEP` (backup prune),
  `FORCE=1` (skip restore confirmation).

## Notes
- Manual restore without npm:
  ```bash
  gunzip -c backup/history/<file>.sql.gz \
    | docker exec -i aios-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
  ```
- Dumps may contain real data — treat `backup/history/` as sensitive and keep it
  out of Git if the DB holds anything you wouldn't commit.
- A scheduled `BACKUP_DB` cron job (in-app scheduler, see the Cronjobs page) can
  be added later to automate step A on an interval.

## Done criteria
- [ ] DB container is running.
- [ ] Backup produced a `*.sql.gz` in `backup/history/` (size > 0, `gunzip -t` passes).
- [ ] (If importing) restore completed without errors and the CRM app was restarted.
