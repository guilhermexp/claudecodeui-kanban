// Lightweight, pretty, and safe logger for server-side modules
// - Colorized output with timestamps and service tags
// - Supports levels: debug, info, success, warn, error
// - Respects LOG_LEVEL (debug|info|warn|error); default 'info'
// - Redacts sensitive paths/flags and user home directory

import os from 'os';

const COLORS = {
  reset: '\x1b[0m',
  gray: '\x1b[90m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

const LEVELS = ['debug', 'info', 'warn', 'error'];
const levelIndex = (lvl) => Math.max(0, LEVELS.indexOf((lvl || '').toLowerCase()));
const CURRENT_LEVEL = process.env.LOG_LEVEL || 'info';

const HOME = os.homedir?.() || '';

function redactSensitive(input) {
  if (!input) return input;
  try {
    let out = String(input);
    // Collapse user home directory
    if (HOME && out.includes(HOME)) {
      out = out.split(HOME).join('~');
    }
    // Hide explicit permission bypass flag
    out = out.replace(/--dangerously-skip-permissions/g, '--permissions=bypass');
    // Hide token-like strings
    out = out.replace(/[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/g, '[REDACTED_TOKEN]');
    // Hide full mcp-config absolute paths, keep basename
    out = out.replace(/--mcp-config\s+([^\s]+)/g, (m, p1) => `--mcp-config ${p1.split('/').pop()}`);
    return out;
  } catch {
    return input;
  }
}

function ts() {
  return new Date().toLocaleTimeString();
}

function format(service, level, msg) {
  const lvl = level.toUpperCase().padEnd(5);
  const tag = service ? `[${service}]` : '';
  let color = COLORS.white;
  if (level === 'debug') color = COLORS.gray;
  else if (level === 'info') color = COLORS.cyan;
  else if (level === 'warn') color = COLORS.yellow;
  else if (level === 'error') color = COLORS.red;
  return `${color}[${ts()}] ${tag} ${lvl} ${COLORS.reset}${redactSensitive(msg)}`;
}

function shouldLog(level) {
  const need = levelIndex(level);
  const cur = levelIndex(CURRENT_LEVEL);
  return need >= cur;
}

function base(service) {
  return {
    debug: (msg) => { if (shouldLog('debug')) console.log(format(service, 'debug', msg)); },
    info: (msg) => { if (shouldLog('info')) console.log(format(service, 'info', msg)); },
    success: (msg) => { if (shouldLog('info')) console.log(`${COLORS.green}[${ts()}] ${service ? '['+service+'] ' : ''}SUCCESS ${COLORS.reset}${redactSensitive(msg)}`); },
    warn: (msg) => { if (shouldLog('warn')) console.warn(format(service, 'warn', msg)); },
    error: (msg) => { if (shouldLog('error')) console.error(format(service, 'error', msg)); }
  };
}

export function createLogger(service) {
  return base(service);
}

export const logger = base();

export function printStartupBanner(ports = {}) {
  // Minimal banner inspired by the reference, but generic
  const { CLIENT, SERVER, VIBE } = ports;
  const lines = [
    ' ╭──────────────────────────── Services ────────────────────────────╮',
    ' │                                                                  │',
    ` │  Web:       http://localhost:${CLIENT ?? '9000'}                               │`,
    ` │  API:       http://localhost:${SERVER ?? '8080'}                               │`,
    ` │  Vibe:      http://localhost:${VIBE ?? '6734'}                                │`,
    ' │                                                                  │',
    ' ╰──────────────────────────────────────────────────────────────────╯'
  ];
  for (const l of lines) console.log(l);
}

