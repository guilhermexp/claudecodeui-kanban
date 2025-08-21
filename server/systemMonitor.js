import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

class SystemMonitor {
  constructor() {
    this.cache = null;
    this.cacheTime = 0;
    this.cacheDuration = 5000; // Cache for 5 seconds
  }

  async getSystemInfo() {
    // Return cached data if still valid
    if (this.cache && Date.now() - this.cacheTime < this.cacheDuration) {
      return this.cache;
    }

    try {
      const [terminals, ports, memory, cpu] = await Promise.all([
        this.getActiveTerminals(),
        this.getActivePorts(),
        this.getMemoryUsage(),
        this.getCPUUsage()
      ]);

      const result = {
        terminals: terminals.count,
        serverProcesses: terminals.processes,
        ports: ports,
        memoryUsage: memory,
        cpuUsage: cpu,
        timestamp: new Date().toISOString()
      };

      // Cache the result
      this.cache = result;
      this.cacheTime = Date.now();

      return result;
    } catch (error) {
      console.error('Error getting system info:', error);
      return {
        terminals: 0,
        serverProcesses: [],
        ports: [],
        memoryUsage: 0,
        cpuUsage: 0,
        error: error.message
      };
    }
  }

  async getActiveTerminals() {
    try {
      // Get only terminal processes directly related to Claude Code UI
      // Exclude MCP servers and Claude CLI subprocesses
      const { stdout } = await execAsync(`ps aux | grep -E "(node server/index|vite|vibe-kanban|cargo run)" | grep -v grep | grep -v "mcp" | grep -v "context7" | grep -v "supabase" | grep -v "playwright" | grep -v "sequential" | head -10`);
      
      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      const processes = [];
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 10) {
          const pid = parts[1];
          const cpu = parts[2];
          const mem = parts[3];
          const command = parts.slice(10).join(' ');
          
          // Only include Claude Code UI related processes
          if ((command.includes('node server/index') ||
               command.includes('vite') ||
               command.includes('vibe-kanban') ||
               command.includes('cargo run')) &&
              !command.includes('mcp-') &&
              !command.includes('context7') &&
              !command.includes('supabase')) {
            processes.push({
              pid,
              cpu,
              mem,
              command: command.substring(0, 80) // Balanced command length
            });
          }
        }
      });

      return {
        count: processes.length,
        processes: processes.slice(0, 10) // Limit to 10 for display
      };
    } catch (error) {
      console.error('Error getting terminals:', error);
      return { count: 0, processes: [] };
    }
  }

  async getActivePorts() {
    try {
      // Get listening ports (common development ports)
      const { stdout } = await execAsync(`lsof -i -P -n | grep LISTEN | grep -E ":(3000|3001|4000|4200|5000|5173|5892|6734|7347|8000|8080|8081|8082|8083|8357|9000)" | head -20`);
      
      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      const ports = [];
      const seenPorts = new Set();
      
      lines.forEach(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 8) {
          const process = parts[0];
          const pid = parts[1]; // PID is the second column
          const portInfo = parts[8];
          
          // Extract port number (handle both IPv4 and IPv6 formats)
          const portMatch = portInfo.match(/:(\d+)$/);
          if (portMatch) {
            const port = portMatch[1];
            if (!seenPorts.has(port)) {
              seenPorts.add(port);
              ports.push({
                port: parseInt(port),
                process: process.substring(0, 20), // Truncate process name
                pid: pid // Include PID for kill functionality
              });
            }
          }
        }
      });

      return ports.sort((a, b) => a.port - b.port);
    } catch (error) {
      // lsof might not be available or might return empty
      return [];
    }
  }

  async getMemoryUsage() {
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const percentage = Math.round((usedMem / totalMem) * 100);
      return percentage;
    } catch (error) {
      return 0;
    }
  }

  async getCPUUsage() {
    try {
      // Get CPU usage on macOS
      const { stdout } = await execAsync(`top -l 1 -n 0 | grep "CPU usage"`);
      const match = stdout.match(/(\d+\.\d+)%\s+user/);
      if (match) {
        return Math.round(parseFloat(match[1]));
      }
      return 0;
    } catch (error) {
      // Fallback for other systems or if command fails
      const cpus = os.cpus();
      let totalIdle = 0;
      let totalTick = 0;

      cpus.forEach(cpu => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
      });

      const idle = totalIdle / cpus.length;
      const total = totalTick / cpus.length;
      const usage = 100 - ~~(100 * idle / total);
      
      return usage;
    }
  }

  async killProcess(pid) {
    try {
      // Validate PID is a number
      const pidNum = parseInt(pid);
      if (isNaN(pidNum) || pidNum <= 0) {
        throw new Error('Invalid PID');
      }

      // Kill the process
      await execAsync(`kill -9 ${pidNum}`);
      
      // Clear cache to force refresh
      this.cache = null;
      
      return { success: true, message: `Process ${pidNum} terminated` };
    } catch (error) {
      console.error('Error killing process:', error);
      return { 
        success: false, 
        error: error.message || 'Failed to kill process' 
      };
    }
  }
}

export default SystemMonitor;