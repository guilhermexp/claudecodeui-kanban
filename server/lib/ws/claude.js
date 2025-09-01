// Claude WebSocket helpers (scaffold for future extraction)
// Goal: move /claude endpoint logic from server/index.js into this module
// incrementally without behavior changes.

import { createLogger } from '../../utils/logger.js';

const log = createLogger('CLAUDE-WS');

// Placeholder types for future refactor. For now we only log important events
// to verify wiring when integrated.

export function onStartSession(options = {}) {
  try {
    log.info(`start-session requested (mode: ${options?.permissionMode || (options?.bypass ? 'bypass' : 'default')})`);
  } catch {}
}

export function onEndSession(sessionId = null) {
  try { log.info(`end-session requested${sessionId ? ` (${sessionId})` : ''}`); } catch {}
}

export function onError(err) {
  try { log.error(`error: ${err?.message || err}`); } catch {}
}

export function notifySessionStarted(ws, sessionId, temporary = false) {
  try { ws.send(JSON.stringify({ type: 'claude-session-started', sessionId, temporary })); } catch {}
}

export function notifySessionClosed(ws) {
  try { ws.send(JSON.stringify({ type: 'claude-session-closed' })); } catch {}
}
