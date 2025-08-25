import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
const router = express.Router();

const execAsync = promisify(exec);

// Get system information including active ports and resource usage
router.get('/info', async (req, res) => {
  try {
    // Get active ports
    const activePorts = await getActivePorts();
    
    // Get memory and CPU usage
    const memoryUsage = await getMemoryUsage();
    const cpuUsage = await getCpuUsage();

    res.json({
      activePorts,
      memoryUsage,
      cpuUsage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('System info error:', error);
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
    console.error('Port action error:', error);
    res.status(500).json({ error: 'Failed to perform port action' });
  }
});

// Helper functions
async function getActivePorts() {
  try {
    // macOS/Linux: Use lsof to find active ports
    let command;
    if (process.platform === 'darwin' || process.platform === 'linux') {
      command = "lsof -i -P -n | grep LISTEN | awk '{print $1, $9}' | sort -u";
    } else if (process.platform === 'win32') {
      command = 'netstat -ano | findstr LISTENING';
    } else {
      return [];
    }

    const { stdout } = await execAsync(command);
    const lines = stdout.trim().split('\n').filter(line => line.trim());
    
    const ports = [];
    const seenPorts = new Set();

    for (const line of lines) {
      try {
        let port, process;
        
        if (process.platform === 'win32') {
          // Windows format parsing
          const parts = line.trim().split(/\s+/);
          const address = parts[1];
          const portMatch = address.match(/:(\d+)$/);
          if (portMatch) {
            port = parseInt(portMatch[1]);
            process = 'unknown';
          }
        } else {
          // macOS/Linux format parsing
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            process = parts[0];
            const address = parts[1];
            const portMatch = address.match(/:(\d+)$/);
            if (portMatch) {
              port = parseInt(portMatch[1]);
            }
          }
        }

        if (port && !seenPorts.has(port)) {
          seenPorts.add(port);
          
          // Determine process type and add URL if applicable
          let processType = process;
          let url = null;
          
          // Common development ports
          if (port === 3000 || port === 5173 || port === 5892) {
            processType = 'node';
            url = `http://localhost:${port}`;
          } else if (port === 8000 || port === 8080) {
            url = `http://localhost:${port}`;
          } else if (port === 6734) {
            processType = 'vibe-kanb';
          } else if (port === 7347) {
            processType = 'node';
          }
          
          ports.push({
            port,
            process: processType,
            url
          });
        }
      } catch (parseError) {
        // Skip lines that can't be parsed
        continue;
      }
    }

    // Sort by port number
    return ports.sort((a, b) => a.port - b.port);
  } catch (error) {
    console.error('Error getting active ports:', error);
    return [];
  }
}

async function getMemoryUsage() {
  try {
    if (process.platform === 'darwin' || process.platform === 'linux') {
      // Get memory info for Unix-like systems
      let command;
      if (process.platform === 'darwin') {
        // macOS
        command = 'vm_stat | head -n 10';
      } else {
        // Linux
        command = 'free -m';
      }
      
      const { stdout } = await execAsync(command);
      
      if (process.platform === 'darwin') {
        // Parse macOS vm_stat output
        const lines = stdout.split('\n');
        let pageSize = 4096; // Default page size
        let pagesUsed = 0;
        let pagesTotal = 0;

        for (const line of lines) {
          if (line.includes('page size of')) {
            const match = line.match(/(\d+) bytes/);
            if (match) pageSize = parseInt(match[1]);
          } else if (line.includes('Pages free:')) {
            const match = line.match(/(\d+)\./);
            if (match) pagesTotal += parseInt(match[1]);
          } else if (line.includes('Pages active:') || line.includes('Pages inactive:') || 
                     line.includes('Pages wired down:')) {
            const match = line.match(/(\d+)\./);
            if (match) {
              pagesUsed += parseInt(match[1]);
              pagesTotal += parseInt(match[1]);
            }
          }
        }

        if (pagesTotal > 0) {
          return Math.round((pagesUsed / pagesTotal) * 100);
        }
      } else {
        // Parse Linux free output
        const lines = stdout.split('\n');
        const memLine = lines.find(line => line.startsWith('Mem:'));
        if (memLine) {
          const parts = memLine.split(/\s+/);
          const total = parseInt(parts[1]);
          const used = parseInt(parts[2]);
          if (total > 0) {
            return Math.round((used / total) * 100);
          }
        }
      }
    } else if (process.platform === 'win32') {
      // Windows
      const { stdout } = await execAsync('wmic OS get TotalVisibleMemorySize,FreePhysicalMemory /value');
      const lines = stdout.split('\n');
      let total = 0, free = 0;
      
      for (const line of lines) {
        if (line.includes('TotalVisibleMemorySize=')) {
          total = parseInt(line.split('=')[1]);
        } else if (line.includes('FreePhysicalMemory=')) {
          free = parseInt(line.split('=')[1]);
        }
      }
      
      if (total > 0) {
        return Math.round(((total - free) / total) * 100);
      }
    }
    
    return 0;
  } catch (error) {
    console.error('Error getting memory usage:', error);
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
    console.error('Error getting CPU usage:', error);
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
    console.error(`Error killing process on port ${port}:`, error);
    throw error;
  }
}

export default router;