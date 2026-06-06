#!/usr/bin/env node
// Smoke-test an n8n webhook using a bearer token from .env / .env.local.
// Prints ONLY status code + pass/fail — never the token or response body secrets.
//
// Usage:
//   node scripts/smoke-webhook.mjs \
//     --url https://n8n.fusionsync.ai/webhook/... \
//     --var AIOS_N8N_WEBHOOK_TOKEN_V2
import { loadEnvLocal } from './lib/env.mjs';

function parseArgs(argv) {
  let url = '';
  let varName = '';
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--url' && argv[i + 1]) url = argv[++i];
    else if (argv[i] === '--var' && argv[i + 1]) varName = argv[++i];
  }
  if (!url || !varName) {
    console.error(
      'Usage: node scripts/smoke-webhook.mjs --url <webhook-url> --var <ENV_VAR_NAME>'
    );
    process.exit(2);
  }
  return { url, varName };
}

async function main() {
  const { url, varName } = parseArgs(process.argv);
  loadEnvLocal();

  const token = process.env[varName]?.trim();
  if (!token) {
    console.error(`FAIL: ${varName} is not set in .env / .env.local`);
    process.exit(1);
  }

  const body = {
    name: 'smoke-test',
    destination: 'Ibiza',
    when: 'August',
    groupType: 'solo',
    groupSize: 1,
    flightsBooked: false,
    summary: 'AIOS webhook smoke test',
    note: 'automated smoke test — safe to ignore',
  };

  let status = 0;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    status = res.status;
  } catch (err) {
    console.error(
      `FAIL: request error — ${err instanceof Error ? err.message : String(err)}`
    );
    process.exit(1);
  }

  const ok = status >= 200 && status < 300;
  console.log(`HTTP ${status}`);
  console.log(ok ? 'RESULT: PASS' : 'RESULT: FAIL');
  process.exit(ok ? 0 : 1);
}

main();
