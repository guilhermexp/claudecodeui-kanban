#!/usr/bin/env node
// Simple verification script for the refactor
import { promises as fs } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(root, '..');

async function read(rel) {
  const p = path.join(repo, rel);
  return fs.readFile(p, 'utf8');
}

async function exists(rel) {
  try { await fs.access(path.join(repo, rel)); return true; } catch { return false; }
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
}

async function main() {
  const results = [];

  // 1) Required files exist
  const required = [
    'src/utils/logger.js',
    'src/hooks/claude/useClaudeSessionState.js',
    'src/hooks/useActivityTimer.js',
    'src/hooks/claude/useClaudeStreamHandler.js',
    'server/lib/ws/claude.js',
  ];
  for (const f of required) {
    const ok = await exists(f);
    results.push([`exists:${f}`, ok]);
    assert(ok, `Missing ${f}`);
  }

  // 2) OverlayChatClaude imports and uses the new hook
  const overlay = await read('src/components/OverlayChatClaude.jsx');
  const usesStreamHook = overlay.includes("useClaudeStreamHandler") && overlay.includes("processClaudeMessage(lastMsg)");
  results.push(['overlay-uses-stream-hook', usesStreamHook]);
  assert(usesStreamHook, 'OverlayChatClaude does not use useClaudeStreamHandler');

  // 3) MainContent uses logger (no raw console.log in this file)
  const mc = await read('src/components/MainContent.jsx');
  const mcHasLogger = mc.includes("createLogger('MainContent')");
  const mcNoConsole = !/console\.(log|error|warn)\(/.test(mc);
  results.push(['maincontent-logger', mcHasLogger]);
  results.push(['maincontent-no-console', mcNoConsole]);
  assert(mcHasLogger && mcNoConsole, 'MainContent logger checks failed');

  // 4) WebSocket util uses logger
  const wsutil = await read('src/utils/websocket.js');
  const wsHasLogger = wsutil.includes("createLogger('WebSocket')");
  results.push(['wsutil-logger', wsHasLogger]);
  assert(wsHasLogger, 'websocket.js missing logger usage');

  // 5) Server WS notify functions are used for started/closed
  const serverIdx = await read('server/index.js');
  const usesStarted = serverIdx.includes('wsClaudeNotifySessionStarted');
  const usesClosed = serverIdx.includes('wsClaudeNotifySessionClosed');
  results.push(['server-notify-started', usesStarted]);
  results.push(['server-notify-closed', usesClosed]);
  assert(usesStarted && usesClosed, 'Server index missing notify calls');

  // 6) Ensure removed files truly gone
  const removed = [
    'src/components/ProjectsModalNew.jsx',
    'src/hooks/useShellSessions.js',
    'src/hooks/useAudioRecorder.js',
    'src/components/.OverlayChatClaude.jsx.swp',
  ];
  for (const f of removed) {
    const gone = !(await exists(f));
    results.push([`removed:${f}`, gone]);
    assert(gone, `File should be removed: ${f}`);
  }

  // 7) Import backend module to ensure syntax loads
  const modUrl = pathToFileURL(path.join(repo, 'server/lib/ws/claude.js')).href;
  const mod = await import(modUrl);
  const hasFns = mod && typeof mod.onStartSession === 'function' && typeof mod.notifySessionStarted === 'function';
  results.push(['import-server-ws-module', hasFns]);
  assert(hasFns, 'server/lib/ws/claude.js missing expected exports');

  // Print summary
  console.log('Refactor verification passed:');
  for (const [name, ok] of results) {
    console.log(` - ${name}: ${ok ? 'OK' : 'FAIL'}`);
  }
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

