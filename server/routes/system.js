import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { createLogger } from '../utils/logger.js';
const router = express.Router();
const log = createLogger('SYSTEM');

const execAsync = promisify(exec);



// Simple cache to prevent excessive system calls
let systemInfoCache = { data: null, timestamp: 0 };
const CACHE_DURATION = 5000; // 5 seconds cache

// Get system information including active ports and resource usage
router.get('/info', async (req, res) => {
  try {
    // Return cached data if still fresh
    const now = Date.now();
    if (systemInfoCache.data && (now - systemInfoCache.timestamp) < CACHE_DURATION) {
      return res.json(systemInfoCache.data);
    }
    
    log.debug(`System info requested from: ${req.ip}`);
    
    // Get active ports
    const activePorts = await getActivePorts();
    log.debug(`Found active ports: ${activePorts.length}`);
    
    // Get memory and CPU usage
    const memoryUsage = await getMemoryUsage();
    const cpuUsage = await getCpuUsage();
    log.debug(`Resource usage - Memory: ${memoryUsage}% CPU: ${cpuUsage}%`);

    const result = {
      activePorts,
      memoryUsage,
      cpuUsage,
      timestamp: new Date().toISOString()
    };
    
    // Cache the result
    systemInfoCache = { data: result, timestamp: Date.now() };
    
    log.debug('Sending response (truncated)');
    res.json(result);
  } catch (error) {
    log.error(`System info error: ${error.message}`);
    res.status(500).json({ 
      error: 'Failed to get system information',
      activePorts: [],
      memoryUsage: 0,
      cpuUsage: 0
    });
  }
});

// Port management actions
router.post('/ports', async (req, res) => {
  try {
    const { port, action } = req.body;
    
    if (!port || !action) {
      return res.status(400).json({ error: 'Port and action are required' });
    }

    if (action === 'kill') {
      await killProcessOnPort(port);
      res.json({ success: true, message: `Process on port ${port} terminated` });
    } else {
      res.status(400).json({ error: 'Invalid action' });
    }
  } catch (error) {
    log.error(`Port action error: ${error.message}`);
    res.status(500).json({ error: 'Failed to perform port action' });
  }
});

// Helper functions
async function getActivePorts() {
  try {
    log.debug('Getting active ports...');
    
    // Define system/essential services to filter out
    const SYSTEM_SERVICES = [
      'rapportd',     // Apple AirDrop/Handoff service
      'sharingd',     // Apple Sharing service
      'bluetoothd',   // Bluetooth daemon
      'mDNSResponder', // Bonjour/mDNS service
      'systemd',      // Linux system daemon
      'launchd',      // macOS launch daemon
      'kernel_task',  // Kernel processes
      'WindowServer', // macOS window server
      'loginwindow',  // macOS login window
      'cfprefsd',     // macOS preferences daemon
      'coreaudiod',   // macOS audio daemon
      'airportd',     // macOS WiFi daemon
      'nesessionmanager', // Network Extension
      'trustd',       // Certificate trust daemon
      'secd',         // Security daemon
    ];
    
    // Use lsof with better parsing for macOS/Linux
    let command;
    if (process.platform === 'darwin' || process.platform === 'linux') {
      // Get only TCP listening ports to reduce output
      command = "lsof -iTCP -P -n -sTCP:LISTEN";
    } else if (process.platform === 'win32') {
      // Windows netstat
      command = "netstat -ano | findstr LISTENING";
    } else {
      log.warn('Unsupported platform for port detection');
      return [];
    }

    const { stdout } = await execAsync(command);
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    
    log.debug(`Found ${lines.length} listening processes`);
    
    const ports = [];
    const seenPorts = new Set();

    for (const line of lines) {
      try {
        if (process.platform === 'darwin' || process.platform === 'linux') {
          // Parse lsof output
          // Format: COMMAND   PID   USER   FD   TYPE  DEVICE SIZE/OFF  NODE NAME
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 9) {
            const processName = parts[0];
            const pid = parts[1];
            const address = parts[8]; // The NAME column contains address:port
            
            // Skip system/essential services
            if (SYSTEM_SERVICES.includes(processName)) {
              continue;
            }
            
            // Extract port from address (handles both *:PORT and IP:PORT formats)
            let port = null;
            let host = 'localhost';
            
            // Try different patterns to extract port
            if (address.includes(':')) {
              const lastColon = address.lastIndexOf(':');
              const portStr = address.substring(lastColon + 1);
              const hostStr = address.substring(0, lastColon);
              
              // Validate port is a number
              if (/^\d+$/.test(portStr)) {
                port = parseInt(portStr);
                
                // Parse host
                if (hostStr === '*') {
                  host = 'localhost';
                } else if (hostStr.includes('[') && hostStr.includes(']')) {
                  // IPv6 address like [::1] or [::] 
                  host = 'localhost';
                } else if (hostStr === '127.0.0.1' || hostStr === '::1') {
                  host = 'localhost';
                } else if (hostStr) {
                  host = hostStr;
                }
              }
            }
            
            if (port && !seenPorts.has(port)) {
              // Smart filtering for relevant development ports
              // Skip very high ports (usually temporary/dynamic ports) except known dev ports
              if (port > 49152) {
                continue;
              }
              
              // Skip Qoder internal ports unless they're main dev ports
              if (processName.toLowerCase() === 'qoder' && port > 50000) {
                continue;
              }
              
              seenPorts.add(port);
              
              // Determine process type and add URL if applicable
              let processType = processName.toLowerCase();
              let url = null;
              
              // Common development ports
              if (port === 3000 || port === 5173 || port === 5892) {
                processType = 'frontend';
                url = `http://${host}:${port}`;
              } else if (port === 7347) {
                processType = 'backend';
                url = `http://${host}:${port}`;
              } else if (port === 6734) {
                processType = 'vibe-kanban';
                url = `http://${host}:${port}`;
              } else if (port >= 3000 && port <= 3999) {
                // Common dev server range
                processType = processName === 'node' ? 'node-app' : processName;
                url = `http://${host}:${port}`;
              } else if (port === 8000 || port === 8080 || port === 8888) {
                url = `http://${host}:${port}`;
              } else if (port === 4040) {
                processType = 'ngrok';
                url = `http://${host}:${port}`;
              } else if (port === 5432) {
                processType = 'postgres';
              } else if (port === 27017) {
                processType = 'mongodb';
              } else if (port === 6379) {
                processType = 'redis';
              } else if (port === 3306) {
                processType = 'mysql';
              }
              
              ports.push({
                port,
                process: processType,
                pid,
                url
              });
              
              log.debug(`Found port ${port} (${processType}) PID: ${pid}`);
            }
          }
        } else if (process.platform === 'win32') {
          // Parse Windows netstat output
          // Format: TCP    0.0.0.0:PORT    0.0.0.0:0    LISTENING    PID
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5 && parts[3] === 'LISTENING') {
            const addressPart = parts[1];
            const pid = parts[4];
            
            const colonIndex = addressPart.lastIndexOf(':');
            if (colonIndex > -1) {
              const port = parseInt(addressPart.substring(colonIndex + 1));
              
              if (port && !seenPorts.has(port)) {
                seenPorts.add(port);
                
                // Try to get process name on Windows
                let processType = 'unknown';
                try {
                  const { stdout: procInfo } = await execAsync(`tasklist /FI "PID eq ${pid}" /FO CSV`);
                  const procLines = procInfo.split('\n');
                  if (procLines.length > 1) {
                    const procParts = procLines[1].split(',');
                    if (procParts.length > 0) {
                      processType = procParts[0].replace(/"/g, '').replace('.exe', '').toLowerCase();
                    }
                  }
                } catch (e) {
                  // Ignore error getting process name
                }
                
                let url = null;
                if (port >= 3000 && port <= 9999) {
                  url = `http://localhost:${port}`;
                }
                
                ports.push({
                  port,
                  process: processType,
                  pid,
                  url
                });
              }
            }
          }
        }
      } catch (parseError) {
        log.warn(`Error parsing line: ${parseError.message}`);
        continue;
      }
    }

    // Sort by port number
    const sortedPorts = ports.sort((a, b) => a.port - b.port);
    log.debug(`Returning ${sortedPorts.length} active ports`);
    return sortedPorts;
  } catch (error) {
    log.error(`Error getting active ports: ${error.message}`);
    return [];
  }
}

async function getMemoryUsage() {
  try {
    // Cross‑platform: prefer Node's os module for stability
    const total = os.totalmem();
    const free = os.freemem();
    if (total > 0) {
      const usedPct = Math.round(((total - free) / total) * 100);
      return Math.max(0, Math.min(100, usedPct));
    }
    return 0;
  } catch (error) {
    log.error(`Error getting memory usage: ${error.message}`);
    return 0;
  }
}

async function getCpuUsage() {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      // Use top command to get CPU usage
      const command = process.platform === 'darwin' ? 
        'top -l 1 | grep "CPU usage"' : 
        'top -bn1 | grep "Cpu(s)"';
        
      const { stdout } = await execAsync(command);
      
      if (process.platform === 'darwin') {
        // macOS: "CPU usage: 5.23% user, 3.45% sys, 91.32% idle"
        const match = stdout.match(/(\d+\.?\d*)% idle/);
        if (match) {
          const idle = parseFloat(match[1]);
          return Math.round(100 - idle);
        }
      } else {
        // Linux: "%Cpu(s): 2.3 us, 1.0 sy, 0.0 ni, 96.7 id, 0.0 wa, 0.0 hi, 0.0 si, 0.0 st"
        const match = stdout.match(/(\d+\.?\d*) id/);
        if (match) {
          const idle = parseFloat(match[1]);
          return Math.round(100 - idle);
        }
      }
    } else if (process.platform === 'win32') {
      // Windows
      const { stdout } = await execAsync('wmic cpu get loadpercentage /value');
      const match = stdout.match(/LoadPercentage=(\d+)/);
      if (match) {
        return parseInt(match[1]);
      }
    }
    
    return 0;
  } catch (error) {
    log.error(`Error getting CPU usage: ${error.message}`);
    return 0;
  }
}

async function killProcessOnPort(port) {
  try {
    let command;
    if (process.platform === 'darwin' || process.platform === 'linux') {
      command = `lsof -ti:${port} | xargs kill -9`;
    } else if (process.platform === 'win32') {
      // Windows: find PID and kill it
      const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
      const lines = stdout.trim().split('\n');
      const pids = new Set();
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length >= 5) {
          pids.add(parts[4]);
        }
      }
      
      for (const pid of pids) {
        if (pid && pid !== '0') {
          await execAsync(`taskkill /PID ${pid} /F`);
        }
      }
      return;
    }
    
    await execAsync(command);
  } catch (error) {
    log.error(`Error killing process on port ${port}: ${error.message}`);
    throw error;
  }
}

export default router;
