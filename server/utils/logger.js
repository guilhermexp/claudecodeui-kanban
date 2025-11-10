// Enhanced Visual Logger with Beautiful Formatting
// - Colorized output with timestamps and service tags
// - Box drawing characters for visual appeal
// - Supports levels: debug, info, success, warn, error
// - Respects LOG_LEVEL (debug|info|warn|error); default 'info'
// - Redacts sensitive paths/flags and user home directory

import os from 'os';

const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Foreground colors
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  
  // Bright colors
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
  
  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m'
};

// Box drawing characters for beautiful borders
const BOX = {
  topLeft: '╭',
  topRight: '╮',
  bottomLeft: '╰',
  bottomRight: '╯',
  horizontal: '─',
  vertical: '│',
  cross: '┼',
  teeLeft: '├',
  teeRight: '┤',
  teeTop: '┬',
  teeBottom: '┴'
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
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

function getLevelColor(level) {
  switch(level) {
    case 'debug': return COLORS.gray;
    case 'info': return COLORS.brightCyan;
    case 'success': return COLORS.brightGreen;
    case 'warn': return COLORS.brightYellow;
    case 'error': return COLORS.brightRed;
    default: return COLORS.white;
  }
}

function format(service, level, msg) {
  const timeStr = ts();
  const levelColor = getLevelColor(level);
  const timeColor = COLORS.gray;
  
  // Format: [HH:MM:SS] [SERVICE] Message
  let output = `${timeColor}[${timeStr}]${COLORS.reset} `;
  
  if (service) {
    // Special colors for CLAUDE-CLI service
    if (service === 'CLAUDE-CLI') {
      // Use cyan for CLAUDE-CLI service tag
      output += `${COLORS.brightCyan}[${service}]${COLORS.reset} `;
      
      // Apply special formatting for Claude messages
      if (msg.includes('💬 Claude:')) {
        // Assistant messages in bright blue
        output += msg.replace('💬 Claude:', `${COLORS.brightBlue}${COLORS.bold}💬 Claude:${COLORS.reset}${COLORS.brightBlue}`);
        output += COLORS.reset;
        return output;
      } else if (msg.includes('👤 Você:')) {
        // User messages in bright green
        output += msg.replace('👤 Você:', `${COLORS.brightGreen}${COLORS.bold}👤 Você:${COLORS.reset}${COLORS.green}`);
        output += COLORS.reset;
        return output;
      } else if (msg.includes('🔧 Usando ferramenta:')) {
        // Tool use in yellow
        output += msg.replace('🔧 Usando ferramenta:', `${COLORS.yellow}🔧 Usando ferramenta:${COLORS.reset}${COLORS.yellow}`);
        output += COLORS.reset;
        return output;
      } else if (msg.includes('✅ Resultado:')) {
        // Tool results in green
        output += msg.replace('✅ Resultado:', `${COLORS.green}✅ Resultado:${COLORS.reset}`);
        return output;
      } else if (msg.includes('━')) {
        // Separator lines in dim gray
        output += `${COLORS.dim}${msg}${COLORS.reset}`;
        return output;
      }
    } else if (service === 'CODEX-CLI' || service === 'CODEX') {
      // Distinct styling for Codex logs
      const svcColor = service === 'CODEX-CLI' ? COLORS.brightMagenta : COLORS.magenta;
      output += `${svcColor}[${service}]${COLORS.reset} `;
    } else {
      // Service tag with color based on level
      output += `${levelColor}[${service}]${COLORS.reset} `;
    }
  }
  
  // Add the message
  output += redactSensitive(msg);
  
  return output;
}

function formatSuccess(service, msg) {
  const timeStr = ts();
  const timeColor = COLORS.gray;
  
  // Special formatting for success messages
  let output = `${timeColor}[${timeStr}]${COLORS.reset} `;
  
  if (service) {
    output += `${COLORS.green}[${service}]${COLORS.reset} `;
  }
  
  output += `${COLORS.green}${COLORS.bold}SUCCESS${COLORS.reset} ${redactSensitive(msg)}`;
  
  return output;
}

function shouldLog(level) {
  const need = levelIndex(level);
  const cur = levelIndex(CURRENT_LEVEL);
  return need >= cur;
}

function base(service) {
  return {
    debug: (msg) => { 
      if (shouldLog('debug')) console.log(format(service, 'debug', msg)); 
    },
    info: (msg) => { 
      if (shouldLog('info')) console.log(format(service, 'info', msg)); 
    },
    success: (msg) => { 
      if (shouldLog('info')) console.log(formatSuccess(service, msg)); 
    },
    warn: (msg) => { 
      if (shouldLog('warn')) console.warn(format(service, 'warn', msg)); 
    },
    error: (msg) => { 
      if (shouldLog('error')) console.error(format(service, 'error', msg)); 
    }
  };
}

export function createLogger(service) {
  return base(service);
}

export const logger = base();

export function printStartupBanner(ports = {}) {
  const { CLIENT = 5892, SERVER = 7347 } = ports;
  const hasVibe = Object.prototype.hasOwnProperty.call(ports, 'VIBE');
  const VIBE = hasVibe ? ports.VIBE : null;
  
  // Clear line and print beautiful startup banner
  console.log('');
  console.log(`${COLORS.brightCyan}╭──────────────────────────────────────────────────────────────────────╮${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}│                                                                      │${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}│${COLORS.reset}  ${COLORS.bold}${COLORS.brightWhite}🚀 CLAUDE CODE UI${COLORS.reset}                                                 ${COLORS.brightCyan}│${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}│${COLORS.reset}                                                                      ${COLORS.brightCyan}│${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}├──────────────────────────────────────────────────────────────────────┤${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}│${COLORS.reset}                          ${COLORS.bold}Services${COLORS.reset}                                   ${COLORS.brightCyan}│${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}│${COLORS.reset}                                                                      ${COLORS.brightCyan}│${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}│${COLORS.reset}    ${COLORS.green}Web:${COLORS.reset}       ${COLORS.brightGreen}http://localhost:${CLIENT}${COLORS.reset}                              ${COLORS.brightCyan}│${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}│${COLORS.reset}    ${COLORS.blue}API:${COLORS.reset}       ${COLORS.brightBlue}http://localhost:${SERVER}${COLORS.reset}                              ${COLORS.brightCyan}│${COLORS.reset}`);
  if (hasVibe && VIBE) {
    console.log(`${COLORS.brightCyan}│${COLORS.reset}    ${COLORS.magenta}Vibe:${COLORS.reset}      ${COLORS.brightMagenta}http://localhost:${VIBE}${COLORS.reset}                              ${COLORS.brightCyan}│${COLORS.reset}`);
  }
  console.log(`${COLORS.brightCyan}│${COLORS.reset}                                                                      ${COLORS.brightCyan}│${COLORS.reset}`);
  console.log(`${COLORS.brightCyan}╰──────────────────────────────────────────────────────────────────────╯${COLORS.reset}`);
  console.log('');
}

// Special formatted messages for important events
export function logStartup(service, message) {
  const timeStr = ts();
  console.log(`${COLORS.gray}[${timeStr}]${COLORS.reset} ${COLORS.brightGreen}[${service}]${COLORS.reset} ${COLORS.green}Starting...${COLORS.reset}`);
}

export function logReady(service, port) {
  const timeStr = ts();
  const url = `http://localhost:${port}`;
  console.log(`${COLORS.gray}[${timeStr}]${COLORS.reset} ${COLORS.brightGreen}[${service}]${COLORS.reset} ${COLORS.green}${COLORS.bold}SUCCESS${COLORS.reset} API server ready on ${COLORS.brightCyan}${url}${COLORS.reset}`);
}

// Export box drawing characters for other uses
export { BOX, COLORS };
