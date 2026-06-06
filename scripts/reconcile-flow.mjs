#!/usr/bin/env node
// Reconcile a FLOW agent's header secrets for pushing via the RecallSync MCP.
//
// The agent NEVER reads .env or .env.local. This script (run locally) loads them,
// replaces every ${VAR} placeholder in ba_http headersJson with the real value,
// then ENCRYPTS Authorization bearer values (AES-256-CBC, byte-compatible with
// recallsync-app) so only ciphertext leaves this machine. It prints the reconciled
// v2 flow JSON to stdout — pipe/paste that into the MCP `set-channel-agent-flow-draft`
// tool. Plaintext tokens are never printed.
//
// Usage:
//   node scripts/reconcile-flow.mjs --flow agents/primary-agent/<name>/<channel>/channel-agent-flow.json
//   node scripts/reconcile-flow.mjs --flow <path> --out /tmp/flow.json
import fs from 'node:fs';
import path from 'node:path';
import { encrypt } from './lib/encryption.mjs';
import { loadEnvLocal, repoRoot } from './lib/env.mjs';

const PLACEHOLDER_RE = /\$\{([A-Z0-9_]+)\}/g;

function parseArgs(argv) {
  let flowPath = '';
  let outPath = '';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--flow' && argv[i + 1]) flowPath = argv[++i];
    else if (argv[i] === '--out' && argv[i + 1]) outPath = argv[++i];
  }
  if (!flowPath) {
    console.error(
      'Usage: node scripts/reconcile-flow.mjs --flow <path> [--out <file>]'
    );
    process.exit(2);
  }
  return { flowPath, outPath };
}

function resolvePlaceholders(value) {
  return value.replace(PLACEHOLDER_RE, (_match, varName) => {
    const secret = process.env[varName]?.trim();
    if (!secret) {
      throw new Error(
        `${varName} is referenced in the flow but is not set in .env / .env.local`
      );
    }
    return secret;
  });
}

/** After env substitution, encrypt Bearer Authorization values for storage. */
function encryptBearerHeaderValue(value) {
  if (typeof value !== 'string') return value;
  const m = value.match(/^Bearer\s+(.+)$/i);
  if (!m) return value;
  return encrypt(`Bearer ${m[1]}`);
}

function reconcileFlowSecrets(flowDoc) {
  const nodes = flowDoc?.nodes ?? [];
  for (const node of nodes) {
    if (node?.type !== 'ba_http' || !node?.data?.headersJson) continue;
    let headers;
    try {
      headers = JSON.parse(node.data.headersJson);
    } catch {
      throw new Error(`Node "${node.id}" has invalid headersJson`);
    }
    if (!headers || typeof headers !== 'object' || Array.isArray(headers)) continue;

    for (const [key, raw] of Object.entries(headers)) {
      let value = resolvePlaceholders(String(raw));
      if (key.toLowerCase() === 'authorization') {
        value = encryptBearerHeaderValue(value);
      }
      headers[key] = value;
    }
    node.data.headersJson = JSON.stringify(headers);
  }
  return flowDoc;
}

function main() {
  const { flowPath, outPath } = parseArgs(process.argv);
  loadEnvLocal();

  const absFlow = path.isAbsolute(flowPath)
    ? flowPath
    : path.join(repoRoot, flowPath);
  const bundle = JSON.parse(fs.readFileSync(absFlow, 'utf8'));
  const rawFlow =
    bundle?.flow && typeof bundle.flow === 'object' ? bundle.flow : bundle;

  const flowDoc = reconcileFlowSecrets(structuredClone(rawFlow));
  const json = JSON.stringify(flowDoc);

  if (outPath) {
    const absOut = path.isAbsolute(outPath)
      ? outPath
      : path.join(repoRoot, outPath);
    fs.writeFileSync(absOut, json);
    console.error(`OK: wrote reconciled flow to ${absOut}`);
  } else {
    process.stdout.write(json);
  }
}

try {
  main();
} catch (err) {
  console.error(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
}
