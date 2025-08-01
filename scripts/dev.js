#!/usr/bin/env node

import { spawn } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// Smart port management
const PORTS = {
  CLIENT: 9000,
  SERVER: 8080,
  VIBE_BACKEND: 8081
};

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(service, message, color = colors.reset) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${color}[${timestamp}] [${service}] ${message}${colors.reset}`);
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
              log('CLEANUP', `Killed process ${pid} on port ${port}`, colors.yellow);
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
    color: options.color || colors.reset
  };

  function start() {
    log(name, `Starting: ${command} ${args.join(' ')}`, service.color);
    
    service.process = spawn(command, args, {
      cwd: options.cwd || rootDir,
      stdio: 'pipe',
      env: { ...process.env, ...options.env }
    });

    service.process.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) log(name, output, service.color);
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
        setTimeout(start, 2000);
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
  log('INIT', 'Starting Claude Code UI Development Environment', colors.cyan);
  
  // Cleanup existing processes
  await killPortProcesses([PORTS.CLIENT, PORTS.SERVER, PORTS.VIBE_BACKEND]);
  
  // Wait a bit for cleanup
  await new Promise(resolve => setTimeout(resolve, 1000));

  const services = [];

  // Start Server (Claude Code UI Backend)
  services.push(spawnService(
    'SERVER',
    'node',
    ['server/index.js'],
    {
      color: colors.green,
      env: { PORT: PORTS.SERVER }
    }
  ));

  // Start Client (Vite Frontend)
  services.push(spawnService(
    'CLIENT',
    'npx',
    ['vite', '--host', '--port', PORTS.CLIENT.toString()],
    {
      color: colors.blue,
      env: { VITE_PORT: PORTS.CLIENT }
    }
  ));

  // Start Vibe-Kanban Backend (if exists)
  if (checkVibeKanban()) {
    services.push(spawnService(
      'VIBE-BACKEND',
      'cargo',
      ['run', '--release'],
      {
        color: colors.magenta,
        cwd: join(rootDir, 'vibe-kanban/backend'),
        env: { 
          PORT: PORTS.VIBE_BACKEND,
          VIBE_NO_BROWSER: 'true'  // Prevent auto browser opening
        }
      }
    ));
  }

  // Graceful shutdown
  process.on('SIGINT', () => {
    log('SHUTDOWN', 'Shutting down all services...', colors.yellow);
    services.forEach(service => {
      if (service.process && !service.process.killed) {
        service.process.kill('SIGTERM');
      }
    });
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    log('SHUTDOWN', 'Received SIGTERM, shutting down...', colors.yellow);
    services.forEach(service => {
      if (service.process && !service.process.killed) {
        service.process.kill('SIGTERM');
      }
    });
    process.exit(0);
  });

  // Keep the process alive
  log('READY', `Development servers starting on ports: Client(${PORTS.CLIENT}), Server(${PORTS.SERVER}), Vibe-Backend(${PORTS.VIBE_BACKEND})`, colors.cyan);
}

main().catch(console.error);