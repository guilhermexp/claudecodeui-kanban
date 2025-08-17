#!/usr/bin/env node

// Port Management Utility for Claude Code UI
// Handles conflicts between development and production modes

import { spawn } from 'child_process';
import net from 'net';

const MODES = {
  DEVELOPMENT: {
    CLIENT: 5892,
    SERVER: 7347, 
    VIBE_BACKEND: 6734
  },
  PRODUCTION: {
    SERVER: 7347,
    VIBE_BACKEND: 6734
    // Production doesn't use CLIENT port (serves static files via SERVER)
  }
};

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

// Check which mode is currently running
async function detectCurrentMode() {
  const developmentPorts = Object.values(MODES.DEVELOPMENT);
  const productionPorts = Object.values(MODES.PRODUCTION);
  
  const portsInUse = [];
  
  for (const port of [...new Set([...developmentPorts, ...productionPorts])]) {
    const inUse = await isPortInUse(port);
    if (inUse) {
      portsInUse.push(port);
    }
  }
  
  // Check if development mode (has CLIENT port 9000)
  if (portsInUse.includes(MODES.DEVELOPMENT.CLIENT)) {
    return 'DEVELOPMENT';
  }
  
  // Check if production mode (has SERVER but no CLIENT)
  if (portsInUse.includes(MODES.PRODUCTION.SERVER) && !portsInUse.includes(MODES.DEVELOPMENT.CLIENT)) {
    return 'PRODUCTION';
  }
  
  if (portsInUse.length > 0) {
    return 'MIXED';  // Some ports in use but unclear mode
  }
  
  return 'NONE';
}

// Check if port is in use
function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.listen(port, () => {
      server.close(() => {
        resolve(false); // Port is free
      });
    });
    
    server.on('error', () => {
      resolve(true); // Port is in use
    });
  });
}

// Get process using a port
async function getProcessOnPort(port) {
  return new Promise((resolve) => {
    const lsof = spawn('lsof', ['-ti', `:${port}`]);
    let pid = '';
    
    lsof.stdout.on('data', (data) => {
      pid = data.toString().trim();
    });
    
    lsof.on('close', () => {
      resolve(pid ? parseInt(pid) : null);
    });
    
    lsof.on('error', () => {
      resolve(null);
    });
  });
}

// Safely stop development mode 
async function stopDevelopmentMode() {
  log('MODE-MANAGER', '🛑 Stopping Development Mode...', colors.yellow);
  
  const devProcesses = [];
  
  for (const [name, port] of Object.entries(MODES.DEVELOPMENT)) {
    const pid = await getProcessOnPort(port);
    if (pid) {
      devProcesses.push({ name, port, pid });
    }
  }
  
  if (devProcesses.length === 0) {
    log('MODE-MANAGER', '✅ No development processes found', colors.green);
    return true;
  }
  
  // Kill processes gracefully
  for (const proc of devProcesses) {
    try {
      process.kill(proc.pid, 'SIGTERM');
      log('MODE-MANAGER', `🔄 Stopped ${proc.name} (PID: ${proc.pid}, Port: ${proc.port})`, colors.yellow);
    } catch (error) {
      log('MODE-MANAGER', `❌ Failed to stop ${proc.name}: ${error.message}`, colors.red);
    }
  }
  
  // Wait for processes to stop
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Verify all stopped
  let allStopped = true;
  for (const proc of devProcesses) {
    const stillRunning = await getProcessOnPort(proc.port);
    if (stillRunning) {
      allStopped = false;
      try {
        process.kill(proc.pid, 'SIGKILL');
        log('MODE-MANAGER', `⚡ Force killed ${proc.name}`, colors.red);
      } catch (e) {
        // Might already be dead
      }
    }
  }
  
  log('MODE-MANAGER', allStopped ? '✅ Development mode stopped' : '⚠️ Some processes may still be running', 
      allStopped ? colors.green : colors.yellow);
  
  return allStopped;
}

// Safely stop production mode
async function stopProductionMode() {
  log('MODE-MANAGER', '🛑 Stopping Production Mode...', colors.yellow);
  
  // Stop production processes using the same method as start-background-prod.sh
  const commands = [
    'pkill -f "node.*server/index.js"',
    'pkill -f "cargo.*vibe-kanban"', 
    'pkill -f "vibe-kanban.*target/release"',
    'pkill -f "ngrok"'
  ];
  
  for (const cmd of commands) {
    try {
      const [command, ...args] = cmd.split(' ');
      const result = spawn(command, args, { stdio: 'pipe' });
      
      result.on('close', (code) => {
        if (code === 0) {
          log('MODE-MANAGER', `✅ Executed: ${cmd}`, colors.green);
        }
      });
    } catch (error) {
      // pkill returns non-zero if no processes found, which is normal
    }
  }
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  log('MODE-MANAGER', '✅ Production processes stopped', colors.green);
  return true;
}

// Main command handling
async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'detect':
      const mode = await detectCurrentMode();
      log('MODE-MANAGER', `Current mode: ${mode}`, colors.cyan);
      
      if (mode === 'DEVELOPMENT') {
        log('MODE-MANAGER', 'Development mode detected (npm run dev)', colors.blue);
        log('MODE-MANAGER', 'Ports: CLIENT(5892), SERVER(7347), VIBE_BACKEND(6734)', colors.blue);
      } else if (mode === 'PRODUCTION') {
        log('MODE-MANAGER', 'Production mode detected (start-background-prod.sh)', colors.magenta);
        log('MODE-MANAGER', 'Ports: SERVER(7347), VIBE_BACKEND(6734)', colors.magenta);
      } else if (mode === 'MIXED') {
        log('MODE-MANAGER', 'Mixed/conflicting processes detected', colors.red);
        log('MODE-MANAGER', 'Use "stop-all" to clean up', colors.red);
      } else {
        log('MODE-MANAGER', 'No Claude Code UI processes detected', colors.green);
      }
      break;
      
    case 'stop-dev':
      await stopDevelopmentMode();
      break;
      
    case 'stop-prod':
      await stopProductionMode();
      break;
      
    case 'stop-all':
      log('MODE-MANAGER', '🧹 Stopping ALL Claude Code UI processes...', colors.cyan);
      await Promise.all([stopDevelopmentMode(), stopProductionMode()]);
      log('MODE-MANAGER', '✅ All processes stopped', colors.green);
      break;
      
    case 'switch-to-prod':
      log('MODE-MANAGER', '🔄 Switching to Production Mode...', colors.cyan);
      await stopDevelopmentMode();
      log('MODE-MANAGER', '✅ Safe to start production mode now', colors.green);
      log('MODE-MANAGER', 'Run: ./start-background-prod.sh', colors.cyan);
      break;
      
    case 'switch-to-dev':
      log('MODE-MANAGER', '🔄 Switching to Development Mode...', colors.cyan);
      await stopProductionMode();
      log('MODE-MANAGER', '✅ Safe to start development mode now', colors.green);
      log('MODE-MANAGER', 'Run: npm run dev', colors.cyan);
      break;
      
    default:
      console.log('Claude Code UI Port Management');
      console.log('');
      console.log('Usage:');
      console.log('  node scripts/port-management.js <command>');
      console.log('');
      console.log('Commands:');
      console.log('  detect        - Show current mode and ports in use');
      console.log('  stop-dev      - Stop development mode (npm run dev)');
      console.log('  stop-prod     - Stop production mode (start-background-prod.sh)');
      console.log('  stop-all      - Stop all Claude Code UI processes');
      console.log('  switch-to-prod - Switch from development to production mode');
      console.log('  switch-to-dev  - Switch from production to development mode');
      console.log('');
      console.log('Examples:');
      console.log('  node scripts/port-management.js detect');
      console.log('  node scripts/port-management.js switch-to-prod');
      process.exit(1);
  }
}

// Export for use in other scripts
export { detectCurrentMode, stopDevelopmentMode, stopProductionMode, MODES };

// If run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}