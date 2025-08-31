import { createLogger } from '../utils/logger.js';

const log = createLogger('PROCESS-MANAGER');

/**
 * Robust process lifecycle manager to prevent exit code 143 and orphaned processes
 * Implements proper signal handling with timeout-based escalation
 */
class ProcessManager {
  constructor(options = {}) {
    this.processes = new Map(); // sessionId -> ProcessInfo
    this.maxProcesses = options.maxProcesses || 50;
    this.gracefulTimeout = options.gracefulTimeout || 5000; // 5s for SIGTERM
    this.forceTimeout = options.forceTimeout || 3000; // 3s for SIGKILL
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30s
    this.staleProcessTimeout = options.staleProcessTimeout || 300000; // 5 minutes
    
    // Start health check timer
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
    
    // Handle process exit
    process.on('exit', () => {
      this.cleanup();
    });
    
    process.on('SIGTERM', () => {
      this.shutdownAll();
    });
    
    process.on('SIGINT', () => {
      this.shutdownAll();
    });
  }
  
  /**
   * Register a new process
   */
  register(sessionId, process, metadata = {}) {
    // Enforce process limits
    if (this.processes.size >= this.maxProcesses) {
      log.warn(`Process limit reached (${this.maxProcesses}). Cleaning up oldest processes.`);
      this.cleanupOldestProcesses(5);
    }
    
    const processInfo = {
      process,
      sessionId,
      pid: process.pid,
      startTime: Date.now(),
      lastActivity: Date.now(),
      metadata: {
        command: metadata.command || 'unknown',
        cwd: metadata.cwd || process.cwd(),
        type: metadata.type || 'claude',
        ...metadata
      },
      isShuttingDown: false,
      shutdownPromise: null
    };
    
    // Set up process event listeners
    this.setupProcessListeners(processInfo);
    
    this.processes.set(sessionId, processInfo);
    
    log.info(`Registered process ${process.pid} for session ${sessionId}`);
    log.debug(`Active processes: ${this.processes.size}/${this.maxProcesses}`);
    
    return processInfo;
  }
  
  /**
   * Set up event listeners for a process
   */
  setupProcessListeners(processInfo) {
    const { process, sessionId, pid } = processInfo;
    
    // Track process activity
    const updateActivity = () => {
      if (this.processes.has(sessionId)) {
        this.processes.get(sessionId).lastActivity = Date.now();
      }
    };
    
    process.stdout?.on('data', updateActivity);
    process.stderr?.on('data', updateActivity);
    process.stdin?.on('data', updateActivity);
    
    // Handle process exit
    process.on('exit', (code, signal) => {
      log.info(`Process ${pid} exited with code=${code}, signal=${signal}`);
      this.unregister(sessionId);
    });
    
    process.on('error', (error) => {
      log.error(`Process ${pid} error: ${error.message}`);
      this.unregister(sessionId);
    });
    
    // Handle process disconnection
    process.on('disconnect', () => {
      log.debug(`Process ${pid} disconnected`);
    });
  }
  
  /**
   * Unregister a process
   */
  unregister(sessionId) {
    const processInfo = this.processes.get(sessionId);
    if (processInfo) {
      log.debug(`Unregistered process ${processInfo.pid} for session ${sessionId}`);
      this.processes.delete(sessionId);
    }
    return !!processInfo;
  }
  
  /**
   * Get process info by session ID
   */
  get(sessionId) {
    return this.processes.get(sessionId);
  }
  
  /**
   * Check if a process exists and is running
   */
  exists(sessionId) {
    const processInfo = this.processes.get(sessionId);
    if (!processInfo) return false;
    
    try {
      // Check if process is still running
      process.kill(processInfo.pid, 0);
      return true;
    } catch (error) {
      // Process not found, clean up
      this.unregister(sessionId);
      return false;
    }
  }
  
  /**
   * Gracefully terminate a process with timeout-based escalation
   */
  async terminate(sessionId, reason = 'manual') {
    const processInfo = this.processes.get(sessionId);
    if (!processInfo) {
      log.debug(`No process found for session ${sessionId}`);
      return false;
    }
    
    if (processInfo.isShuttingDown) {
      log.debug(`Process ${processInfo.pid} already shutting down`);
      return processInfo.shutdownPromise;
    }
    
    log.info(`Terminating process ${processInfo.pid} for session ${sessionId} (reason: ${reason})`);
    processInfo.isShuttingDown = true;
    
    processInfo.shutdownPromise = this.gracefulShutdown(processInfo);
    
    try {
      await processInfo.shutdownPromise;
      log.info(`Successfully terminated process ${processInfo.pid}`);
      return true;
    } catch (error) {
      log.error(`Failed to terminate process ${processInfo.pid}: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Implement graceful shutdown sequence: SIGINT → SIGTERM → SIGKILL
   */
  async gracefulShutdown(processInfo) {
    const { process, pid } = processInfo;
    
    return new Promise((resolve, reject) => {
      let shutdownTimer;
      let forceTimer;
      
      const cleanup = () => {
        clearTimeout(shutdownTimer);
        clearTimeout(forceTimer);
      };
      
      // Handle process exit during shutdown
      const onExit = (code, signal) => {
        cleanup();
        log.debug(`Process ${pid} exited during shutdown: code=${code}, signal=${signal}`);
        resolve();
      };
      
      process.once('exit', onExit);
      
      // Step 1: Try graceful SIGINT first
      try {
        log.debug(`Sending SIGINT to process ${pid}`);
        process.kill('SIGINT');
        
        // Step 2: Escalate to SIGTERM after timeout
        shutdownTimer = setTimeout(() => {
          try {
            log.debug(`Escalating to SIGTERM for process ${pid}`);
            process.kill('SIGTERM');
            
            // Step 3: Force kill with SIGKILL after timeout
            forceTimer = setTimeout(() => {
              try {
                log.warn(`Force killing process ${pid} with SIGKILL`);
                process.kill('SIGKILL');
                
                // Final timeout - consider it failed
                setTimeout(() => {
                  cleanup();
                  process.removeListener('exit', onExit);
                  reject(new Error(`Failed to terminate process ${pid} even with SIGKILL`));
                }, 1000);
                
              } catch (error) {
                cleanup();
                process.removeListener('exit', onExit);
                if (error.code === 'ESRCH') {
                  // Process already dead
                  resolve();
                } else {
                  reject(error);
                }
              }
            }, this.forceTimeout);
            
          } catch (error) {
            cleanup();
            process.removeListener('exit', onExit);
            if (error.code === 'ESRCH') {
              // Process already dead
              resolve();
            } else {
              reject(error);
            }
          }
        }, this.gracefulTimeout);
        
      } catch (error) {
        cleanup();
        process.removeListener('exit', onExit);
        if (error.code === 'ESRCH') {
          // Process already dead
          resolve();
        } else {
          reject(error);
        }
      }
    });
  }
  
  /**
   * Terminate all processes
   */
  async shutdownAll() {
    log.info(`Shutting down all processes (${this.processes.size} active)`);
    
    const shutdownPromises = [];
    
    for (const [sessionId, processInfo] of this.processes) {
      shutdownPromises.push(
        this.terminate(sessionId, 'shutdown').catch(error => {
          log.error(`Failed to shutdown process ${processInfo.pid}: ${error.message}`);
        })
      );
    }
    
    if (shutdownPromises.length > 0) {
      await Promise.allSettled(shutdownPromises);
    }
    
    log.info('All processes shutdown completed');
  }
  
  /**
   * Perform health check on all processes
   */
  performHealthCheck() {
    const now = Date.now();
    const staleProcesses = [];
    
    for (const [sessionId, processInfo] of this.processes) {
      const { pid, lastActivity } = processInfo;
      
      // Check if process is still running
      try {
        process.kill(pid, 0);
      } catch (error) {
        if (error.code === 'ESRCH') {
          // Process not found - orphaned entry
          log.warn(`Found orphaned process entry: ${pid} (session: ${sessionId})`);
          staleProcesses.push(sessionId);
          continue;
        }
      }
      
      // Check for stale processes (no activity for too long)
      if (now - lastActivity > this.staleProcessTimeout) {
        log.warn(`Found stale process: ${pid} (inactive for ${Math.round((now - lastActivity) / 1000)}s)`);
        staleProcesses.push(sessionId);
      }
    }
    
    // Clean up stale processes
    for (const sessionId of staleProcesses) {
      this.terminate(sessionId, 'health-check').catch(error => {
        log.error(`Failed to terminate stale process: ${error.message}`);
      });
    }
    
    if (staleProcesses.length > 0) {
      log.info(`Health check: cleaned up ${staleProcesses.length} stale processes`);
    }
  }
  
  /**
   * Clean up oldest processes to free space
   */
  cleanupOldestProcesses(count = 1) {
    const processArray = Array.from(this.processes.entries());
    
    // Sort by start time (oldest first)
    processArray.sort((a, b) => a[1].startTime - b[1].startTime);
    
    const toCleanup = processArray.slice(0, count);
    
    for (const [sessionId, processInfo] of toCleanup) {
      log.warn(`Cleaning up old process ${processInfo.pid} (session: ${sessionId})`);
      this.terminate(sessionId, 'resource-limit').catch(error => {
        log.error(`Failed to cleanup old process: ${error.message}`);
      });
    }
  }
  
  /**
   * Get statistics about managed processes
   */
  getStats() {
    const now = Date.now();
    const processes = Array.from(this.processes.values());
    
    return {
      total: processes.length,
      maxProcesses: this.maxProcesses,
      types: processes.reduce((acc, p) => {
        acc[p.metadata.type] = (acc[p.metadata.type] || 0) + 1;
        return acc;
      }, {}),
      averageAge: processes.length > 0 
        ? Math.round(processes.reduce((sum, p) => sum + (now - p.startTime), 0) / processes.length / 1000)
        : 0,
      oldestAge: processes.length > 0
        ? Math.round(Math.max(...processes.map(p => now - p.startTime)) / 1000)
        : 0,
      shutdownInProgress: processes.filter(p => p.isShuttingDown).length
    };
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
  
  /**
   * Update process activity timestamp
   */
  updateActivity(sessionId) {
    const processInfo = this.processes.get(sessionId);
    if (processInfo) {
      processInfo.lastActivity = Date.now();
    }
  }
}

// Singleton instance
let processManager = null;

export function getProcessManager(options = {}) {
  if (!processManager) {
    processManager = new ProcessManager(options);
  }
  return processManager;
}

export { ProcessManager };