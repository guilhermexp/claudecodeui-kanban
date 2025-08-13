#!/usr/bin/env node

import { spawn } from 'child_process';
import net from 'net';

// Claude Code UI Protected Ports
const PROTECTED_PORTS = {
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

// Get process info
async function getProcessInfo(pid) {
  return new Promise((resolve) => {
    const ps = spawn('ps', ['-p', pid.toString(), '-o', 'pid,ppid,comm,args']);
    let info = '';
    
    ps.stdout.on('data', (data) => {
      info += data.toString();
    });
    
    ps.on('close', () => {
      const lines = info.trim().split('\n');
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/);
        resolve({
          pid: parseInt(parts[0]),
          ppid: parseInt(parts[1]),
          command: parts[2],
          args: parts.slice(3).join(' ')
        });
      } else {
        resolve(null);
      }
    });
    
    ps.on('error', () => {
      resolve(null);
    });
  });
}

// Kill unauthorized process on protected port
async function killUnauthorizedProcess(port, allowedProcess = null) {
  const pid = await getProcessOnPort(port);
  
  if (!pid) return false;
  
  const processInfo = await getProcessInfo(pid);
  
  if (!processInfo) return false;
  
  // Check if it's an allowed process (Claude Code UI components)
  const isAllowed = allowedProcess && (
    processInfo.pid === allowedProcess ||
    processInfo.ppid === allowedProcess ||
    processInfo.command.includes('node') && processInfo.args.includes('server/index.js') ||
    processInfo.command.includes('vite') ||
    processInfo.command.includes('cargo')
  );
  
  if (isAllowed) {
    log('PORT-GUARD', `Authorized process found on port ${port}: ${processInfo.command}`, colors.green);
    return false;
  }
  
  // Kill unauthorized process
  log('PORT-GUARD', `🚫 UNAUTHORIZED ACCESS DETECTED on port ${port}!`, colors.red);
  log('PORT-GUARD', `Process: ${processInfo.command} (PID: ${processInfo.pid})`, colors.red);
  log('PORT-GUARD', `Command: ${processInfo.args}`, colors.red);
  log('PORT-GUARD', `🔒 Terminating unauthorized process...`, colors.yellow);
  
  try {
    process.kill(pid, 'SIGTERM');
    
    // Wait and force kill if needed
    setTimeout(() => {
      getProcessOnPort(port).then(stillRunning => {
        if (stillRunning) {
          log('PORT-GUARD', `⚡ Force killing stubborn process ${pid}`, colors.red);
          try {
            process.kill(pid, 'SIGKILL');
          } catch (e) {
            // Process might be dead already
          }
        }
      });
    }, 3000);
    
    log('PORT-GUARD', `✅ Port ${port} protected successfully`, colors.green);
    return true;
  } catch (error) {
    log('PORT-GUARD', `❌ Failed to kill process ${pid}: ${error.message}`, colors.red);
    return false;
  }
}

// Monitor ports continuously
class PortProtector {
  constructor(protectedPorts, allowedProcesses = {}) {
    this.protectedPorts = protectedPorts;
    this.allowedProcesses = allowedProcesses;
    this.monitoring = false;
    this.monitorInterval = null;
  }
  
  async start() {
    if (this.monitoring) return;
    
    this.monitoring = true;
    log('PORT-GUARD', '🛡️ Starting Claude Code UI Port Protection Service', colors.cyan);
    log('PORT-GUARD', `Protected ports: ${Object.values(this.protectedPorts).join(', ')}`, colors.cyan);
    
    // Monitor every 5 seconds
    this.monitorInterval = setInterval(async () => {
      for (const [name, port] of Object.entries(this.protectedPorts)) {
        const inUse = await isPortInUse(port);
        
        if (inUse) {
          await killUnauthorizedProcess(port, this.allowedProcesses[name]);
        }
      }
    }, 5000);
    
    // Also monitor on startup
    this.performInitialScan();
  }
  
  async performInitialScan() {
    log('PORT-GUARD', '🔍 Performing initial port scan...', colors.yellow);
    
    for (const [name, port] of Object.entries(this.protectedPorts)) {
      const inUse = await isPortInUse(port);
      
      if (inUse) {
        const killed = await killUnauthorizedProcess(port, this.allowedProcesses[name]);
        if (killed) {
          // Wait a bit before next check
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        log('PORT-GUARD', `✅ Port ${port} (${name}) is free`, colors.green);
      }
    }
  }
  
  stop() {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }
    this.monitoring = false;
    log('PORT-GUARD', '🛡️ Port Protection Service stopped', colors.yellow);
  }
  
  // Register an allowed process for a specific port
  registerAllowedProcess(portName, pid) {
    this.allowedProcesses[portName] = pid;
    log('PORT-GUARD', `✅ Registered authorized process ${pid} for ${portName}`, colors.green);
  }
}

// Export for use in other scripts
export { PortProtector, PROTECTED_PORTS };

// If run directly, start protection service
if (import.meta.url === `file://${process.argv[1]}`) {
  const protector = new PortProtector(PROTECTED_PORTS);
  
  // Start protection
  protector.start();
  
  // Graceful shutdown
  process.on('SIGINT', () => {
    log('PORT-GUARD', '🛑 Shutting down Port Protection Service...', colors.yellow);
    protector.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    log('PORT-GUARD', '🛑 Received SIGTERM, shutting down...', colors.yellow);
    protector.stop();
    process.exit(0);
  });
  
  // Keep alive
  log('PORT-GUARD', '🚀 Claude Code UI Port Protection Service is running', colors.green);
  log('PORT-GUARD', '💡 Press Ctrl+C to stop', colors.cyan);
}