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
    this.orphanCheckInterval = options.orphanCheckInterval || 10000; // 10s for orphan detection
    this.memoryThreshold = options.memoryThreshold || 500 * 1024 * 1024; // 500MB per process
    this.cpuCheckInterval = options.cpuCheckInterval || 60000; // 1 minute
    this.enableResourceMonitoring = options.enableResourceMonitoring !== false;
    
    // Start health check timer
    this.healthCheckTimer = setInterval(() => {
      this.performHealthCheck();
    }, this.healthCheckInterval);
    
    // Start orphan detection timer
    this.orphanCheckTimer = setInterval(() => {
      this.detectOrphanProcesses();
    }, this.orphanCheckInterval);
    
    // Start resource monitoring if enabled
    if (this.enableResourceMonitoring) {
      this.resourceMonitorTimer = setInterval(() => {
        this.monitorResourceUsage();
      }, this.cpuCheckInterval);
    }
    
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
  register(sessionId, childProcess, metadata = {}) {
    // Enforce process limits
    if (this.processes.size >= this.maxProcesses) {
      log.warn(`Process limit reached (${this.maxProcesses}). Cleaning up oldest processes.`);
      this.cleanupOldestProcesses(5);
    }
    
    const processInfo = {
      process: childProcess,
      sessionId,
      pid: childProcess.pid,
      startTime: Date.now(),
      lastActivity: Date.now(),
      resourceUsage: {
        cpu: 0,
        memory: 0,
        lastCheck: Date.now()
      },
      metadata: {
        command: metadata.command || 'unknown',
        cwd: metadata.cwd || process.cwd(),
        type: metadata.type || 'claude',
        priority: metadata.priority || 'normal', // low, normal, high
        maxMemory: metadata.maxMemory || this.memoryThreshold,
        ...metadata
      },
      isShuttingDown: false,
      shutdownPromise: null,
      warnings: []
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
    const { process: childProcess, sessionId, pid } = processInfo;
    
    // Track process activity
    const updateActivity = () => {
      if (this.processes.has(sessionId)) {
        this.processes.get(sessionId).lastActivity = Date.now();
      }
    };
    
    childProcess.stdout?.on('data', updateActivity);
    childProcess.stderr?.on('data', updateActivity);
    childProcess.stdin?.on('data', updateActivity);
    
    // Handle process exit
    childProcess.on('exit', (code, signal) => {
      log.info(`Process ${pid} exited with code=${code}, signal=${signal}`);
      this.unregister(sessionId);
    });
    
    childProcess.on('error', (error) => {
      log.error(`Process ${pid} error: ${error.message}`);
      this.unregister(sessionId);
    });
    
    // Handle process disconnection
    childProcess.on('disconnect', () => {
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
    const { process: childProcess, pid } = processInfo;
    
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
      
      childProcess.once('exit', onExit);
      
      // Step 1: Try graceful SIGINT first
      try {
        log.debug(`Sending SIGINT to process ${pid}`);
        childProcess.kill('SIGINT');
        
        // Step 2: Escalate to SIGTERM after timeout
        shutdownTimer = setTimeout(() => {
          try {
            log.debug(`Escalating to SIGTERM for process ${pid}`);
            childProcess.kill('SIGTERM');
            
            // Step 3: Force kill with SIGKILL after timeout
            forceTimer = setTimeout(() => {
              try {
                log.warn(`Force killing process ${pid} with SIGKILL`);
                childProcess.kill('SIGKILL');
                
                // Final timeout - consider it failed
                setTimeout(() => {
                  cleanup();
                  childProcess.removeListener('exit', onExit);
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
            childProcess.removeListener('exit', onExit);
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
        childProcess.removeListener('exit', onExit);
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
   * Detect and clean up orphan processes
   */
  detectOrphanProcesses() {
    const now = Date.now();
    const orphanedSessions = [];
    
    for (const [sessionId, processInfo] of this.processes) {
      const { pid, process: childProcess } = processInfo;
      
      try {
        // Check if process is still accessible
        process.kill(pid, 0);
        
        // Additional check: see if the process object is still valid
        if (childProcess.killed || childProcess.exitCode !== null) {
          log.warn(`Found orphaned process object: ${pid} (session: ${sessionId})`);
          orphanedSessions.push(sessionId);
        }
      } catch (error) {
        if (error.code === 'ESRCH') {
          log.warn(`Found orphaned process entry: ${pid} (session: ${sessionId})`);
          orphanedSessions.push(sessionId);
        }
      }
    }
    
    // Clean up orphaned sessions
    for (const sessionId of orphanedSessions) {
      this.unregister(sessionId);
      log.info(`Cleaned up orphaned session: ${sessionId}`);
    }
    
    if (orphanedSessions.length > 0) {
      log.info(`Orphan check: cleaned up ${orphanedSessions.length} orphaned entries`);
    }
  }
  
  /**
   * Monitor resource usage of all processes
   */
  async monitorResourceUsage() {
    if (!this.enableResourceMonitoring) return;
    
    const now = Date.now();
    const resourceViolations = [];
    
    for (const [sessionId, processInfo] of this.processes) {
      const { pid, metadata } = processInfo;
      
      try {
        // Get process resource usage
        const usage = await this.getProcessResourceUsage(pid);
        if (usage) {
          processInfo.resourceUsage = {
            ...usage,
            lastCheck: now
          };
          
          // Check memory threshold
          if (usage.memory > metadata.maxMemory) {
            const violation = {
              sessionId,
              pid,
              type: 'memory',
              current: usage.memory,
              limit: metadata.maxMemory,
              priority: metadata.priority
            };
            resourceViolations.push(violation);
            processInfo.warnings.push({
              type: 'memory_exceeded',
              timestamp: now,
              details: violation
            });
          }
          
          // Check CPU usage (if it's consistently high)
          if (usage.cpu > 90) {
            processInfo.warnings.push({
              type: 'high_cpu',
              timestamp: now,
              details: { cpu: usage.cpu }
            });
          }
        }
      } catch (error) {
        log.debug(`Failed to get resource usage for process ${pid}: ${error.message}`);
      }
    }
    
    // Handle resource violations
    this.handleResourceViolations(resourceViolations);
  }
  
  /**
   * Get resource usage for a process (cross-platform)
   */
  async getProcessResourceUsage(pid) {
    try {
      // Use pidusage if available, otherwise fallback to system calls
      if (typeof require !== 'undefined') {
        try {
          const pidusage = await import('pidusage');
          return await pidusage.default(pid);
        } catch (error) {
          // Fallback to manual calculation
        }
      }
      
      // Manual resource check (simplified)
      const { spawn } = await import('child_process');
      
      return new Promise((resolve) => {
        // Use ps command to get memory info
        const ps = spawn('ps', ['-o', 'pid,pcpu,pmem,rss', '-p', pid.toString()]);
        let output = '';
        
        ps.stdout.on('data', (data) => {
          output += data.toString();
        });
        
        ps.on('close', (code) => {
          if (code === 0) {
            const lines = output.trim().split('\n');
            if (lines.length > 1) {
              const parts = lines[1].trim().split(/\s+/);
              const cpu = parseFloat(parts[1]) || 0;
              const memory = (parseFloat(parts[3]) || 0) * 1024; // Convert KB to bytes
              
              resolve({ cpu, memory });
              return;
            }
          }
          resolve(null);
        });
        
        setTimeout(() => {
          ps.kill();
          resolve(null);
        }, 5000);
      });
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Handle resource violations based on priority
   */
  handleResourceViolations(violations) {
    if (violations.length === 0) return;
    
    log.warn(`Found ${violations.length} resource violations`);
    
    // Sort by priority (low priority processes get terminated first)
    violations.sort((a, b) => {
      const priorityOrder = { 'low': 0, 'normal': 1, 'high': 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
    
    for (const violation of violations) {
      const { sessionId, type, current, limit } = violation;
      
      log.warn(`Process ${violation.pid} (${sessionId}) exceeded ${type} limit: ${this.formatBytes(current)} > ${this.formatBytes(limit)}`);
      
      // For low priority processes, terminate immediately on memory violation
      if (violation.priority === 'low' && type === 'memory') {
        log.warn(`Terminating low-priority process ${violation.pid} due to memory violation`);
        this.terminate(sessionId, 'resource-violation').catch(error => {
          log.error(`Failed to terminate process for resource violation: ${error.message}`);
        });
      }
      // For normal/high priority, give a warning first
      else {
        log.warn(`Resource violation warning for process ${violation.pid} (priority: ${violation.priority})`);
      }
    }
  }
  
  /**
   * Format bytes for logging
   */
  formatBytes(bytes) {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
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
   * Get detailed process information
   */
  getProcessInfo(sessionId) {
    const processInfo = this.processes.get(sessionId);
    if (!processInfo) return null;
    
    return {
      sessionId,
      pid: processInfo.pid,
      startTime: processInfo.startTime,
      lastActivity: processInfo.lastActivity,
      age: Date.now() - processInfo.startTime,
      inactiveTime: Date.now() - processInfo.lastActivity,
      resourceUsage: processInfo.resourceUsage,
      metadata: processInfo.metadata,
      isShuttingDown: processInfo.isShuttingDown,
      warnings: processInfo.warnings.slice(-5) // Last 5 warnings
    };
  }
  
  /**
   * Get processes by criteria
   */
  findProcesses(criteria = {}) {
    const results = [];
    
    for (const [sessionId, processInfo] of this.processes) {
      let matches = true;
      
      if (criteria.type && processInfo.metadata.type !== criteria.type) {
        matches = false;
      }
      
      if (criteria.priority && processInfo.metadata.priority !== criteria.priority) {
        matches = false;
      }
      
      if (criteria.olderThan && (Date.now() - processInfo.startTime) < criteria.olderThan) {
        matches = false;
      }
      
      if (criteria.inactiveSince && (Date.now() - processInfo.lastActivity) < criteria.inactiveSince) {
        matches = false;
      }
      
      if (matches) {
        results.push(this.getProcessInfo(sessionId));
      }
    }
    
    return results;
  }
  
  /**
   * Clean up resources
   */
  cleanup() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
    
    if (this.orphanCheckTimer) {
      clearInterval(this.orphanCheckTimer);
      this.orphanCheckTimer = null;
    }
    
    if (this.resourceMonitorTimer) {
      clearInterval(this.resourceMonitorTimer);
      this.resourceMonitorTimer = null;
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