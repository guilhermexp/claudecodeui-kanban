#!/usr/bin/env node

import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import chokidar from 'chokidar';
// Port protection removed - was causing issues with browser processes

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Define ports directly
const PORTS = {
  CLIENT: 5892,
  SERVER: 7347,
  VIBE_BACKEND: 6734
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  dim: '\x1b[90m'
};

function log(service, message, color = colors.reset) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${colors.dim}[${timestamp}]${colors.reset} ${color}[${service}]${colors.reset} ${message}`);
}

function banner() {
  // If a custom banner exists, print it verbatim (keeps exact style)
  try {
    const customPath = join(rootDir, 'scripts', 'banner.txt');
    if (existsSync(customPath)) {
      const text = readFileSync(customPath, 'utf8');
      for (const line of text.split('\n')) {
        if (line.trim().length === 0) { console.log(''); continue; }
        console.log(colors.cyan + line + colors.reset);
      }
      return;
    }
  } catch {}

  const glyphs = {
    C: [
      ' ███████ ',
      '█        ',
      '█        ',
      '█        ',
      '█        ',
      ' ███████ '
    ],
    L: [
      '█        ',
      '█        ',
      '█        ',
      '█        ',
      '█        ',
      '████████ '
    ],
    A: [
      ' █████  ',
      '█     █ ',
      '█     █ ',
      '███████ ',
      '█     █ ',
      '█     █ '
    ],
    U: [
      '█     █ ',
      '█     █ ',
      '█     █ ',
      '█     █ ',
      '█     █ ',
      ' █████  '
    ],
    D: [
      '██████  ',
      '█     █ ',
      '█     █ ',
      '█     █ ',
      '█     █ ',
      '██████  '
    ],
    E: [
      '████████ ',
      '█        ',
      '██████   ',
      '█        ',
      '█        ',
      '████████ '
    ],
    I: [
      '████████ ',
      '   ██    ',
      '   ██    ',
      '   ██    ',
      '   ██    ',
      '████████ '
    ]
  };
  const text = 'CLAUDEUI';
  const rows = 6;
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (const ch of text) {
      const g = glyphs[ch] || glyphs['I'];
      line += (g[r] || '        ') + '  ';
    }
    console.log(colors.cyan + line + colors.reset);
  }
}

// Kill processes on specific ports
async function killPortProcesses(ports) {
  for (const port of ports) {
    try {
      const { spawn } = await import('child_process');
      const lsof = spawn('lsof', ['-ti', `:${port}`]);
      
      lsof.stdout.on('data', (data) => {
        const pids = data.toString().trim().split('\n').filter(Boolean);
        pids.forEach(pid => {
          if (pid) {
            try {
              process.kill(parseInt(pid), 'SIGTERM');
              // Silent cleanup - don't log every killed process
            } catch (e) {
              // Process might already be dead
            }
          }
        });
      });
    } catch (e) {
      // lsof might not be available
    }
  }
}

// Check if vibe-kanban directory exists
function checkVibeKanban() {
  const vibeKanbanPath = join(rootDir, 'vibe-kanban');
  if (!existsSync(vibeKanbanPath)) {
    log('WARNING', 'vibe-kanban directory not found. Skipping Rust backend.', colors.yellow);
    return false;
  }
  return true;
}

// Spawn a service with smart restart logic
function spawnService(name, command, args, options = {}) {
  const service = {
    name,
    process: null,
    restartCount: 0,
    maxRestarts: 3,
    color: options.color || colors.reset,
    _lastLine: '',
    _repeatCount: 0,
    _lastTime: 0
  };

  function start() {
    // Only log startup for main services, not the full command
    if (name === 'SERVER' || name === 'CLIENT' || name === 'VIBE-BACKEND') {
      log(name, 'Starting...', service.color);
    }
    
    service.process = spawn(command, args, {
      cwd: options.cwd || rootDir,
      stdio: 'pipe',
      env: { ...process.env, ...options.env }
    });

    service.process.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      // Filter out noisy logs
      if (output && 
          !output.includes('VITE v') && 
          !output.includes('➜') &&
          !output.includes('ready in') &&
          !output.includes('Has users:') &&
          !output.includes('Auth status')) {
        // Throttle highly repetitive stream start lines
        if (output.includes('Starting stream with args:')) {
          const now = Date.now();
          if (now - service._lastTime < 1500 && service._lastLine.includes('Starting stream with args:')) {
            service._repeatCount += 1;
            service._lastTime = now;
            return; // suppress duplicate burst
          }
          if (service._repeatCount > 0) {
            log(name, `(previous line repeated ${service._repeatCount}x)`, colors.yellow);
            service._repeatCount = 0;
          }
          service._lastTime = now;
          service._lastLine = output;
        }
        log(name, output, service.color);
      }
    });

    service.process.stderr?.on('data', (data) => {
      const output = data.toString().trim();
      if (output && !output.includes('EADDRINUSE')) {
        log(name, output, colors.red);
      }
    });

    service.process.on('exit', (code, signal) => {
      if (signal === 'SIGTERM' || signal === 'SIGINT') {
        log(name, 'Stopped', colors.yellow);
        return;
      }

      if (code !== 0 && service.restartCount < service.maxRestarts) {
        service.restartCount++;
        log(name, `Crashed (code: ${code}). Restarting... (${service.restartCount}/${service.maxRestarts})`, colors.yellow);
        setTimeout(() => {
          start();
          // Re-register the new process after restart
          if (options.registerCallback) {
            setTimeout(() => {
              if (service.process && service.process.pid) {
                options.registerCallback(service.process.pid);
              }
            }, 1000);
          }
        }, 2000);
      } else if (code !== 0) {
        log(name, `Failed after ${service.maxRestarts} attempts. Giving up.`, colors.red);
      }
    });
  }

  start();
  return service;
}

// Main execution
async function main() {
  // Simple startup message
  console.log(`${colors.cyan}🚀 Starting ClaudeUI...${colors.reset}`);
  banner();
  
  // Initialize Port Protection Service (but don't start monitoring yet)
  // const portProtector = new PortProtector(PORTS);
  // log('INIT', '🛡️ Initializing Port Protection Service', colors.cyan);
  
  // Cleanup existing processes first
  await killPortProcesses([PORTS.CLIENT, PORTS.SERVER, PORTS.VIBE_BACKEND]);
  
  // Wait a bit for cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));

  const services = [];
  const allowedProcesses = {};

  // Start Server (Claude Code UI Backend) with memory optimizations
  const startServer = () => spawnService(
      'SERVER',
      'node',
      ['--expose-gc', '--max-old-space-size=2048', 'server/index.js'],
      {
        color: colors.green,
        env: { PORT: PORTS.SERVER, VITE_PORT: PORTS.CLIENT, VIBE_PORT: PORTS.VIBE_BACKEND },
        registerCallback: (pid) => {} // portProtector.registerAllowedProcess('SERVER', pid)
      }
    );

  let serverService = startServer();
  services.push(serverService);

  // Hot-reload for server: watch server/ and restart process on changes
  let restartTimer = null;
  const serverWatcher = chokidar.watch([
    'server/**/*.js',
    'server/**/*.mjs',
    'server/**/*.cjs'
  ], {
    cwd: rootDir,
    ignoreInitial: true,
    ignored: ['**/node_modules/**', '**/.git/**']
  });

  const scheduleRestart = (reason) => {
    clearTimeout(restartTimer);
    restartTimer = setTimeout(() => {
      try {
        log('SERVER', `Change detected (${reason}). Restarting...`, colors.yellow);
        if (serverService?.process && !serverService.process.killed) {
          serverService.process.once('exit', () => {
            serverService = startServer();
          });
          serverService.process.kill('SIGTERM');
        } else {
          serverService = startServer();
        }
      } catch (e) {
        log('SERVER', `Hot-reload failed: ${e.message}`, colors.red);
      }
    }, 200);
  };

  serverWatcher.on('all', (event, filePath) => {
    scheduleRestart(`${event}: ${filePath}`);
  });
  
  // Register server process as authorized
  // setTimeout(() => {
  //   if (serverService.process && serverService.process.pid) {
  //     portProtector.registerAllowedProcess('SERVER', serverService.process.pid);
  //   }
  // }, 1000);

  // Start Client (Vite Frontend)
  const clientService = spawnService(
    'CLIENT',
    'npx',
    ['vite', '--host', '--port', PORTS.CLIENT.toString()],
    {
      color: colors.blue,
      env: { VITE_PORT: PORTS.CLIENT },
      registerCallback: (pid) => {} // portProtector.registerAllowedProcess('CLIENT', pid)
    }
  );
  services.push(clientService);
  
  // Register client process as authorized
  // setTimeout(() => {
  //   if (clientService.process && clientService.process.pid) {
  //     portProtector.registerAllowedProcess('CLIENT', clientService.process.pid);
  //   }
  // }, 1000);

  // Start Vibe-Kanban Backend (if exists)
  if (checkVibeKanban()) {
    const vibeService = spawnService(
      'VIBE-BACKEND',
      'cargo',
      ['run', '--release'],
      {
        color: colors.magenta,
        cwd: join(rootDir, 'vibe-kanban/backend'),
        env: { 
          PORT: PORTS.VIBE_BACKEND,
          VIBE_NO_BROWSER: 'true'  // Prevent auto browser opening
        },
        registerCallback: (pid) => {} // portProtector.registerAllowedProcess('VIBE_BACKEND', pid)
      }
    );
    services.push(vibeService);
    
    // Register vibe process as authorized
    // setTimeout(() => {
    //   if (vibeService.process && vibeService.process.pid) {
    //     portProtector.registerAllowedProcess('VIBE_BACKEND', vibeService.process.pid);
    //   }
    // }, 2000); // Rust takes longer to start
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    log('SHUTDOWN', 'Shutting down all services...', colors.yellow);
    
    // Stop port protection first
    // portProtector.stop();
    try { serverWatcher?.close(); } catch {}
    
    services.forEach(service => {
      if (service.process && !service.process.killed) {
        service.process.kill('SIGTERM');
      }
    });
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('SHUTDOWN', 'Received SIGTERM, shutting down...', colors.yellow);
    
    // Stop port protection first
    // portProtector.stop();
    
    services.forEach(service => {
      if (service.process && !service.process.killed) {
        service.process.kill('SIGTERM');
      }
    });
    process.exit(0);
  });

  // Start port protection after all services are launched and registered
  // setTimeout(async () => {
  //   log('INIT', '🛡️ Starting Port Protection monitoring...', colors.cyan);
  //   await portProtector.start();
  // }, 4000); // Wait longer to ensure all processes are registered
  
  // Simple ready message
  setTimeout(() => {
    console.log(`${colors.green}✅ Ready at http://localhost:${PORTS.CLIENT}${colors.reset}`);
    // Custom banner already includes an endpoints panel when provided
  }, 2000);
}

main().catch(console.error);

// printEndpointsPanel disabled; using custom banner panel when present
