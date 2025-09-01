// Lightweight browser logger with level gating and simple redaction
// Usage:
//   import { createLogger, logger } from '../utils/logger';
//   const log = createLogger('OverlayChatClaude');
//   log.info('message'); log.debug('details'); log.error('oops');

const LEVELS = ['debug', 'info', 'warn', 'error'];

function levelIndex(level) {
  const idx = LEVELS.indexOf(String(level || '').toLowerCase());
  return idx >= 0 ? idx : 1; // default to 'info'
}

function currentLevel() {
  try {
    const fromStorage = window.localStorage?.getItem('log-level');
    if (fromStorage) return fromStorage;
  } catch {}
  try {
    // Vite replaces import.meta.env during build
    return import.meta.env?.MODE === 'development' || import.meta.env?.DEV ? 'debug' : 'info';
  } catch {}
  return 'info';
}

function shouldLog(level) {
  return levelIndex(level) >= levelIndex(currentLevel());
}

function ts() {
  try {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()].map(v => String(v).padStart(2, '0')).join(':');
  } catch { return '00:00:00'; }
}

function redact(msg) {
  try {
    let out = String(msg);
    // redact common token-like strings
    out = out.replace(/[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, '[REDACTED_TOKEN]');
    return out;
  } catch { return msg; }
}

function base(ns = '') {
  const prefix = ns ? `[${ns}]` : '';
  return {
    debug: (...args) => { if (shouldLog('debug')) console.log(`[${ts()}] ${prefix}`, ...args.map(redact)); },
    info: (...args) => { if (shouldLog('info')) console.log(`[${ts()}] ${prefix}`, ...args.map(redact)); },
    warn: (...args) => { if (shouldLog('warn')) console.warn(`[${ts()}] ${prefix}`, ...args.map(redact)); },
    error: (...args) => { if (shouldLog('error')) console.error(`[${ts()}] ${prefix}`, ...args.map(redact)); },
  };
}

export function createLogger(namespace) { return base(namespace); }
export const logger = base();

