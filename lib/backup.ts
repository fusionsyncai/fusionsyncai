import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

// Hourly backups add up fast, so keep only the newest N dumps. At 1/hour this is
// ~3 days of history. The db-backup.sh script does the pruning via KEEP.
const BACKUP_RETENTION = 72;
const BACKUP_TIMEOUT_MS = 120_000;

export type DatabaseBackupResult = {
  file: string | null;
  output: string;
};

// Runs scripts/db-backup.sh (pg_dump inside the docker container -> gzipped SQL
// in backup/history). Throws if the script exits non-zero, so the cron job marks
// itself FAILED and logs the error. Returns the written file path on success.
export async function runDatabaseBackup(): Promise<DatabaseBackupResult> {
  const root = process.cwd();
  const script = path.join(root, "scripts", "db-backup.sh");

  const { stdout } = await execFileAsync("bash", [script], {
    cwd: root,
    env: { ...process.env, KEEP: String(BACKUP_RETENTION) },
    timeout: BACKUP_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  });

  // Parse the "OK: <path> (<size>)" line the script prints on success.
  const okLine = stdout
    .split("\n")
    .find((line) => line.startsWith("OK:"));
  const file = okLine
    ? okLine.replace(/^OK:\s*/, "").replace(/\s*\([^)]*\)\s*$/, "").trim()
    : null;

  return { file, output: stdout.trim() };
}
