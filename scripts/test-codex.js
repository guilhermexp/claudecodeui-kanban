// Quick local test for Codex CLI integration using our spawnCodex helper
// Usage: node scripts/test-codex.js "your prompt here" [api-cli|api-env|subscription]

import { spawnCodex } from '../server/codex-cli.js';
// Prefer invoking the installed codex binary directly to mirror your terminal context
if (!process.env.CODEX_BIN) process.env.CODEX_BIN = 'codex';

const prompt = process.argv[2] || 'Say "pong" only.';
const mode = (process.argv[3] || 'api-cli').toLowerCase();

// Minimal fake WebSocket to capture events
const ws = {
  send: (msg) => {
    try {
      const obj = JSON.parse(msg);
      const type = obj.type;
      if (type === 'codex-exec-delta') {
        process.stdout.write(obj.text || '');
      } else {
        console.log('[WS]', obj);
      }
    } catch {
      console.log('[RAW]', msg);
    }
  }
};

const options = {
  projectPath: process.cwd(),
  cwd: process.cwd(),
  dangerous: false,
  plannerMode: 'Auto',
  modelLabel: 'gpt-5',
  authMode: mode, // 'api-cli' (default), 'api-env', or 'subscription'
};

console.log('--- Codex Test ---');
console.log('Prompt:', prompt);
console.log('Auth mode:', options.authMode);

spawnCodex(prompt, options, ws)
  .then(() => {
    console.log("\n[TEST] Completed successfully.");
    process.exit(0);
  })
  .catch((err) => {
    console.error('[TEST] Failed:', err.message);
    process.exit(1);
  });