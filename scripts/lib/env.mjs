import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(__dirname, '../..');

function loadEnvFile(filename) {
  const envPath = path.join(repoRoot, filename);
  if (!fs.existsSync(envPath)) return false;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
  return true;
}

/** Load .env then .env.local (.env.local wins). Script-side only — agent must not read these. */
export function loadEnvLocal() {
  const loadedEnv = loadEnvFile('.env');
  const loadedLocal = loadEnvFile('.env.local');
  if (!loadedEnv && !loadedLocal) {
    throw new Error(
      'No .env or .env.local found — copy from .env.example and fill values'
    );
  }
}
