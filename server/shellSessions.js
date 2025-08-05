// Shell session manager - maintains persistent shell sessions
import { spawn } from 'child_process';

class ShellSessionManager {
  constructor() {
    // Map to store active shell sessions
    // Key: sessionKey (projectName + sessionId), Value: shell session object
    this.sessions = new Map();
    
    // Map to store session timeouts
    this.timeouts = new Map();
    
    // Default timeout: 30 minutes (increased from 10)
    this.SESSION_TIMEOUT = 30 * 60 * 1000;
  }

  // Create a unique session key
  createSessionKey(projectPath, sessionId, userId) {
    return `${userId}:${projectPath}:${sessionId || 'default'}`;
  }

  // Get or create a shell session
  getOrCreateSession(sessionKey, projectPath, sessionId, bypassPermissions = false) {
    if (this.sessions.has(sessionKey)) {
      // Cancel timeout since session is being reused
      this.cancelTimeout(sessionKey);
      
      const session = this.sessions.get(sessionKey);
      session.lastAccessed = Date.now();
      
      // Schedule new timeout
      this.scheduleTimeout(sessionKey);
      
      return session;
    }

    
    // Create new shell process
    const shellProcess = this.createShellProcess(projectPath, sessionId, bypassPermissions);
    
    const session = {
      key: sessionKey,
      process: shellProcess,
      projectPath,
      sessionId,
      bypassPermissions,
      created: Date.now(),
      lastAccessed: Date.now(),
      output: [], // Store recent output for reconnection
      clients: new Set() // Track connected WebSocket clients
    };

    this.sessions.set(sessionKey, session);
    
    // Schedule timeout
    this.scheduleTimeout(sessionKey);
    
    return session;
  }

  // Create the actual shell process
  createShellProcess(projectPath, sessionId, bypassPermissions) {
    
    // This method is not used anymore since we create the process in index.js
    // Kept for future reference if needed
    throw new Error('createShellProcess should not be called - process creation is handled in handleShellConnection');
  }

  // Add a WebSocket client to a session
  addClient(sessionKey, ws) {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.clients.add(ws);
    }
  }

  // Remove a WebSocket client from a session
  removeClient(sessionKey, ws) {
    const session = this.sessions.get(sessionKey);
    if (session) {
      session.clients.delete(ws);
      
      // If no clients remain, start the timeout
      if (session.clients.size === 0) {
        this.scheduleTimeout(sessionKey);
      }
    }
  }

  // Schedule session timeout
  scheduleTimeout(sessionKey) {
    // Cancel any existing timeout
    this.cancelTimeout(sessionKey);
    
    // Only schedule timeout if no clients are connected
    const session = this.sessions.get(sessionKey);
    if (session && session.clients.size === 0) {
      const timeoutId = setTimeout(() => {
        this.destroySession(sessionKey);
      }, this.SESSION_TIMEOUT);
      
      this.timeouts.set(sessionKey, timeoutId);
    }
  }

  // Cancel session timeout
  cancelTimeout(sessionKey) {
    if (this.timeouts.has(sessionKey)) {
      clearTimeout(this.timeouts.get(sessionKey));
      this.timeouts.delete(sessionKey);
    }
  }

  // Destroy a session
  destroySession(sessionKey) {
    const session = this.sessions.get(sessionKey);
    if (session) {
      
      // Kill the shell process
      if (session.process && !session.process.killed) {
        session.process.kill('SIGTERM');
      }
      
      // Close all connected clients
      session.clients.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'session-expired',
            message: 'Shell session expired after 10 minutes of inactivity'
          }));
          ws.close();
        }
      });
      
      // Clean up
      this.sessions.delete(sessionKey);
      this.cancelTimeout(sessionKey);
    }
  }

  // Get session info for debugging
  getSessionInfo() {
    const info = [];
    for (const [key, session] of this.sessions) {
      info.push({
        key,
        projectPath: session.projectPath,
        sessionId: session.sessionId,
        created: new Date(session.created).toISOString(),
        lastAccessed: new Date(session.lastAccessed).toISOString(),
        clients: session.clients.size,
        hasTimeout: this.timeouts.has(key)
      });
    }
    return info;
  }

  // Clean up all sessions (for server shutdown)
  cleanup() {
    for (const sessionKey of this.sessions.keys()) {
      this.destroySession(sessionKey);
    }
  }
}

// Create singleton instance
const shellSessionManager = new ShellSessionManager();

// Handle process termination
process.on('SIGINT', () => {
  shellSessionManager.cleanup();
  process.exit(0);
});

process.on('SIGTERM', () => {
  shellSessionManager.cleanup();
  process.exit(0);
});

export default shellSessionManager;