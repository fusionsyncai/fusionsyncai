#!/usr/bin/env node
/**
 * AIOS wrapper — loads .env/.env.local and runs the global `recallsync` CLI.
 * Usage: node scripts/recallsync-cli.mjs [--json] leads list ...
 */
import { spawnSync } from "node:child_process";
import { loadEnvLocal } from "./lib/env.mjs";

loadEnvLocal();

process.env.RECALLSYNC_API_KEY ??=
  process.env.RECALL_API_KEY ?? process.env.RECALLSYNC_API_KEY;

// Default localhost only when nothing else is configured (agent sessions use .env.local).
if (!process.env.RECALLSYNC_BASE_URL?.trim()) {
  process.env.RECALLSYNC_BASE_URL = "http://localhost:3000/api/rest";
}

if (!process.env.RECALLSYNC_API_KEY) {
  console.error(
    JSON.stringify({
      error:
        "Missing RECALL_API_KEY in .env.local (or RECALLSYNC_API_KEY). Copy from .env.example.",
    })
  );
  process.exit(4);
}

const args = process.argv.slice(2);
const bin = process.env.RECALLSYNC_CLI_BIN ?? "recallsync";
const result = spawnSync(bin, args, {
  stdio: "inherit",
  env: process.env,
});

process.exit(result.status ?? (result.error ? 127 : 0));
