#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');

// Process tracking
const PIDFILE_DIR = join(ROOT_DIR, '.pids');
const processes = new Map();

// Ensure PID directory exists
if (!existsSync(PIDFILE_DIR)) {
  require('fs').mkdirSync(PIDFILE_DIR, { recursive: true });
}

// Process configuration
const PROCESS_CONFIG = {
  'vibe-backend': {
    name: 'Vibe Kanban Backend',
    port: 8081,
    pidFile: join(PIDFILE_DIR, 'vibe-backend.pid'),
    healthUrl: 'http://localhost:8081/api/health',
    startCmd: 'cargo',
    startArgs: ['run', '--release'],
    cwd: join(ROOT_DIR, 'vibe-kanban/backend'),
    env: { PORT: '8081' },
    startupTime: 30000, // 30 seconds
    retryDelay: 5000,
    maxRetries: 3
  },
  'claude-backend': {
    name: 'Claude Code Backend',
    port: 8080,
    pidFile: join(PIDFILE_DIR, 'claude-backend.pid'),
    healthUrl: 'http://localhost:8080/api/config',
    startCmd: 'node',
    startArgs: ['server/index.js'],
    cwd: ROOT_DIR,
    env: { PORT: '8080' },
    startupTime: 5000,
    retryDelay: 2000,
    maxRetries: 3
  },
  'frontend': {
    name: 'Frontend Dev Server',
    port: 9000,
    pidFile: join(PIDFILE_DIR, 'frontend.pid'),
    healthUrl: 'http://localhost:9000',
    startCmd: 'npx',
    startArgs: ['vite', '--host', '--port', '9000'],
    cwd: ROOT_DIR,
    env: { VITE_PORT: '9000' },
    startupTime: 10000,
    retryDelay: 3000,
    maxRetries: 3
  }
};

// Utility functions
function log(level, message) {
  const timestamp = new Date().toISOString();
  const levels = { info: '📘', warn: '⚠️ ', error: '❌', success: '✅' };
  console.log(`[${timestamp}] ${levels[level]} ${message}`);
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createConnection({ port, host: 'localhost' }, () => {
      tester.end();
      resolve(false);
    });
    tester.on('error', () => resolve(true));
  });
}

async function checkHealth(url, timeout = 5000) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    return false;
  }
}

function savePid(pidFile, pid) {
  try {
    writeFileSync(pidFile, pid.toString());
  } catch (error) {
    log('error', `Failed to save PID file: ${error.message}`);
  }
}

function loadPid(pidFile) {
  try {
    if (existsSync(pidFile)) {
      return parseInt(readFileSync(pidFile, 'utf8'));
    }
  } catch (error) {
    log('error', `Failed to load PID file: ${error.message}`);
  }
  return null;
}

function cleanupPid(pidFile) {
  try {
    if (existsSync(pidFile)) {
      unlinkSync(pidFile);
    }
  } catch (error) {
    log('error', `Failed to cleanup PID file: ${error.message}`);
  }
}

async function killProcess(pid, signal = 'SIGTERM') {
  try {
    process.kill(pid, signal);
    return true;
  } catch (error) {
    if (error.code === 'ESRCH') {
      // Process doesn't exist
      return false;
    }
    throw error;
  }
}

async function waitForPort(port, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await isPortAvailable(port)) {
      await new Promise(resolve => setTimeout(resolve, 100));
    } else {
      return true;
    }
  }
  
  return false;
}

async function startProcess(processKey) {
  const config = PROCESS_CONFIG[processKey];
  if (!config) {
    log('error', `Unknown process: ${processKey}`);
    return false;
  }
  
  log('info', `Starting ${config.name}...`);
  
  // Check if already running
  const existingPid = loadPid(config.pidFile);
  if (existingPid && await isProcessRunning(existingPid)) {
    log('warn', `${config.name} already running with PID ${existingPid}`);
    return true;
  }
  
  // Check if port is in use
  if (!await isPortAvailable(config.port)) {
    log('warn', `Port ${config.port} already in use for ${config.name}`);
    
    // Try to find and kill the process using the port
    try {
      const { execSync } = await import('child_process');
      const pid = execSync(`lsof -ti:${config.port}`).toString().trim();
      if (pid) {
        log('info', `Killing process ${pid} using port ${config.port}`);
        await killProcess(parseInt(pid), 'SIGKILL');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } catch (error) {
      // Ignore errors
    }
  }
  
  // Start the process
  let retries = 0;
  while (retries < config.maxRetries) {
    try {
      const child = spawn(config.startCmd, config.startArgs, {
        cwd: config.cwd,
        env: { ...process.env, ...config.env },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true
      });
      
      child.unref();
      
      // Save PID
      savePid(config.pidFile, child.pid);
      processes.set(processKey, child);
      
      // Log output
      child.stdout.on('data', (data) => {
        if (process.env.DEBUG) {
          console.log(`[${config.name}] ${data.toString().trim()}`);
        }
      });
      
      child.stderr.on('data', (data) => {
        const message = data.toString().trim();
        if (message && !message.includes('warning')) {
          console.error(`[${config.name}] ${message}`);
        }
      });
      
      // Wait for process to start
      log('info', `Waiting for ${config.name} to start on port ${config.port}...`);
      
      if (await waitForPort(config.port, config.startupTime)) {
        // Additional health check if available
        if (config.healthUrl) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Give it time to fully start
          
          if (await checkHealth(config.healthUrl)) {
            log('success', `${config.name} started successfully on port ${config.port}`);
            return true;
          } else {
            log('warn', `${config.name} started but health check failed`);
            // Continue anyway, health might come up later
            return true;
          }
        } else {
          log('success', `${config.name} started successfully on port ${config.port}`);
          return true;
        }
      }
      
      throw new Error(`${config.name} failed to start within ${config.startupTime}ms`);
      
    } catch (error) {
      retries++;
      log('error', `Failed to start ${config.name} (attempt ${retries}/${config.maxRetries}): ${error.message}`);
      
      // Cleanup failed process
      const child = processes.get(processKey);
      if (child) {
        child.kill('SIGKILL');
        processes.delete(processKey);
      }
      cleanupPid(config.pidFile);
      
      if (retries < config.maxRetries) {
        log('info', `Retrying in ${config.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
      }
    }
  }
  
  return false;
}

async function stopProcess(processKey) {
  const config = PROCESS_CONFIG[processKey];
  if (!config) {
    log('error', `Unknown process: ${processKey}`);
    return false;
  }
  
  log('info', `Stopping ${config.name}...`);
  
  // Try to stop using saved PID
  const pid = loadPid(config.pidFile);
  if (pid) {
    try {
      await killProcess(pid, 'SIGTERM');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      if (await isProcessRunning(pid)) {
        log('warn', `${config.name} didn't stop gracefully, forcing...`);
        await killProcess(pid, 'SIGKILL');
      }
      
      log('success', `${config.name} stopped`);
    } catch (error) {
      log('error', `Failed to stop ${config.name}: ${error.message}`);
    }
  }
  
  // Clean up
  cleanupPid(config.pidFile);
  processes.delete(processKey);
  
  // Also try to kill by port as fallback
  try {
    const { execSync } = await import('child_process');
    execSync(`lsof -ti:${config.port} | xargs kill -9 2>/dev/null || true`);
  } catch (error) {
    // Ignore errors
  }
  
  return true;
}

async function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

async function getProcessStatus(processKey) {
  const config = PROCESS_CONFIG[processKey];
  if (!config) return { status: 'unknown', error: 'Unknown process' };
  
  const pid = loadPid(config.pidFile);
  const portInUse = !await isPortAvailable(config.port);
  const healthOk = config.healthUrl ? await checkHealth(config.healthUrl) : null;
  
  let status = 'stopped';
  let details = {};
  
  if (pid && await isProcessRunning(pid)) {
    status = healthOk === false ? 'unhealthy' : 'running';
    details.pid = pid;
  } else if (portInUse) {
    status = 'port-blocked';
    details.port = config.port;
  }
  
  return {
    name: config.name,
    status,
    port: config.port,
    health: healthOk,
    ...details
  };
}

// Command handlers
async function startAll() {
  log('info', 'Starting all services...');
  
  // Start in order: backends first, then frontend
  const startOrder = ['claude-backend', 'vibe-backend', 'frontend'];
  const results = [];
  
  for (const processKey of startOrder) {
    const success = await startProcess(processKey);
    results.push({ process: processKey, success });
    
    if (!success && processKey !== 'frontend') {
      log('error', 'Backend startup failed, aborting...');
      break;
    }
  }
  
  return results;
}

async function stopAll() {
  log('info', 'Stopping all services...');
  
  // Stop in reverse order
  const stopOrder = ['frontend', 'vibe-backend', 'claude-backend'];
  
  for (const processKey of stopOrder) {
    await stopProcess(processKey);
  }
}

async function status() {
  console.log('\n📊 Service Status:\n');
  
  for (const processKey of Object.keys(PROCESS_CONFIG)) {
    const status = await getProcessStatus(processKey);
    const statusIcon = {
      'running': '🟢',
      'unhealthy': '🟡',
      'stopped': '🔴',
      'port-blocked': '🟠'
    }[status.status] || '❓';
    
    console.log(`${statusIcon} ${status.name}`);
    console.log(`   Status: ${status.status}`);
    console.log(`   Port: ${status.port}`);
    if (status.pid) console.log(`   PID: ${status.pid}`);
    if (status.health !== null) console.log(`   Health: ${status.health ? 'OK' : 'FAIL'}`);
    console.log('');
  }
}

// Monitor mode
async function monitor() {
  log('info', 'Starting process monitor...');
  
  const checkInterval = 10000; // 10 seconds
  const restartDelay = 5000; // 5 seconds
  
  setInterval(async () => {
    for (const processKey of Object.keys(PROCESS_CONFIG)) {
      const status = await getProcessStatus(processKey);
      
      if (status.status === 'stopped' || status.status === 'unhealthy') {
        log('warn', `${status.name} is ${status.status}, attempting restart...`);
        
        await stopProcess(processKey);
        await new Promise(resolve => setTimeout(resolve, restartDelay));
        
        const success = await startProcess(processKey);
        if (!success) {
          log('error', `Failed to restart ${status.name}`);
        }
      }
    }
  }, checkInterval);
  
  // Keep process alive
  process.stdin.resume();
}

// CLI handling
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'start':
      await startAll();
      break;
      
    case 'stop':
      await stopAll();
      break;
      
    case 'restart':
      await stopAll();
      await new Promise(resolve => setTimeout(resolve, 2000));
      await startAll();
      break;
      
    case 'status':
      await status();
      break;
      
    case 'monitor':
      await startAll();
      await monitor();
      break;
      
    case 'start-service':
      const service = process.argv[3];
      if (service) {
        await startProcess(service);
      } else {
        console.error('Please specify a service to start');
        process.exit(1);
      }
      break;
      
    case 'stop-service':
      const stopService = process.argv[3];
      if (stopService) {
        await stopProcess(stopService);
      } else {
        console.error('Please specify a service to stop');
        process.exit(1);
      }
      break;
      
    default:
      console.log(`
Process Manager for Claude Code UI

Usage:
  node process-manager.js <command> [options]

Commands:
  start          Start all services
  stop           Stop all services
  restart        Restart all services
  status         Show status of all services
  monitor        Start services and monitor them
  start-service  Start a specific service
  stop-service   Stop a specific service

Services:
  claude-backend  Claude Code backend (port 8080)
  vibe-backend    Vibe Kanban backend (port 8081)
  frontend        Frontend dev server (port 9000)

Examples:
  node process-manager.js start
  node process-manager.js monitor
  node process-manager.js start-service vibe-backend
`);
      break;
  }
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  log('info', 'Received SIGINT, shutting down gracefully...');
  await stopAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('info', 'Received SIGTERM, shutting down gracefully...');
  await stopAll();
  process.exit(0);
});

// Run main
main().catch(error => {
  log('error', `Fatal error: ${error.message}`);
  process.exit(1);
});