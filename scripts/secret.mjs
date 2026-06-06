#!/usr/bin/env node
// Mint / inspect AIOS header secrets WITHOUT exposing plaintext to the agent.
//
// The plaintext is read from STDIN (never argv) so it doesn't land in shell
// history or `ps`. Output is ONLY the transformed value.
//
// Usage:
//   node scripts/secret.mjs encrypt   # stdin: plaintext  -> stdout: <ivHex>:<cipherHex>
//   node scripts/secret.mjs decrypt   # stdin: ciphertext -> stdout: plaintext
//
// Typical: paste the value, press Enter, then Ctrl-D.
//   node scripts/secret.mjs encrypt
//
// ENCRYPTION_KEY is loaded from .env / .env.local and MUST match recallsync-app.
import { encrypt, decrypt } from './lib/encryption.mjs';
import { loadEnvLocal } from './lib/env.mjs';

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const mode = process.argv[2];
  if (mode !== 'encrypt' && mode !== 'decrypt') {
    console.error('Usage: node scripts/secret.mjs <encrypt|decrypt>  (value on stdin)');
    process.exit(2);
  }
  loadEnvLocal();
  const input = (await readStdin()).replace(/\r?\n$/, '');
  if (!input) {
    console.error('No input received on stdin.');
    process.exit(2);
  }
  try {
    process.stdout.write((mode === 'encrypt' ? encrypt(input) : decrypt(input)) + '\n');
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

main();
