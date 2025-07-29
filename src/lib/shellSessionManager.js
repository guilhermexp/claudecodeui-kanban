/**
 * Shell Session Manager
 * Centralized state management for shell terminal sessions
 */

// Simple EventEmitter implementation for browser compatibility
class EventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event, listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event, ...args) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(...args));
  }
}

class ShellSessionManager extends EventEmitter {
  constructor() {
    super();
    this.sessions = new Map();
    this.sessionTimeouts = new Map();
    this.activeSessionKey = null;
    this.sessionCounter = 0;
    
    // Load persisted sessions on initialization
    this.loadFromStorage();
    
    // Auto-save sessions when they change
    this.on('sessionsChanged', () => this.saveToStorage());
  }

  /**
   * Create a unique session key
   */
  generateSessionKey(project, session = null, forceNew = false) {
    if (session?.id && !forceNew) {
      return session.id;
    }
    
    if (forceNew || !session) {
      this.sessionCounter++;
      return `${project.name}-session-${this.sessionCounter}-${Date.now()}`;
    }
    
    return `${project.name}-default`;
  }

  /**
   * Add or update a session
   */
  setSession(key, sessionData) {
    const existingSession = this.sessions.get(key);
    
    const updatedSession = {
      ...existingSession,
      ...sessionData,
      key,
      lastUpdated: Date.now()
    };
    
    this.sessions.set(key, updatedSession);
    this.emit('sessionsChanged', this.getAllSessions());
    this.emit('sessionUpdated', key, updatedSession);
    
    // Reset timeout if session is connected
    if (updatedSession.isConnected) {
      this.resetSessionTimeout(key);
    }
    
    return updatedSession;
  }

  /**
   * Update an existing session (alias for setSession for backward compatibility)
   */
  updateSession(key, sessionData) {
    return this.setSession(key, sessionData);
  }

  /**
   * Get a specific session
   */
  getSession(key) {
    return this.sessions.get(key);
  }

  /**
   * Get all sessions
   */
  getAllSessions() {
    return Array.from(this.sessions.entries()).map(([key, session]) => ({
      key,
      ...session
    }));
  }

  /**
   * Get connected sessions
   */
  getConnectedSessions() {
    return this.getAllSessions().filter(session => 
      session.isConnected && 
      session.terminal && 
      !session.terminal.disposed
    );
  }

  /**
   * Remove a session
   */
  removeSession(key) {
    const session = this.sessions.get(key);
    if (!session) return;
    
    // Clean up resources
    if (session.ws && session.ws.readyState === WebSocket.OPEN) {
      session.ws.close();
    }
    
    if (session.terminal && !session.terminal.disposed) {
      session.terminal.dispose();
    }
    
    // Clear timeout
    this.clearSessionTimeout(key);
    
    // Remove from map
    this.sessions.delete(key);
    
    // Emit events
    this.emit('sessionsChanged', this.getAllSessions());
    this.emit('sessionRemoved', key);
    
    // If this was the active session, clear it
    if (this.activeSessionKey === key) {
      this.activeSessionKey = null;
      this.emit('activeSessionChanged', null);
    }
  }

  /**
   * Set active session
   */
  setActiveSession(key) {
    if (this.activeSessionKey === key) return;
    
    const previousKey = this.activeSessionKey;
    this.activeSessionKey = key;
    
    this.emit('activeSessionChanged', key, previousKey);
  }

  /**
   * Get active session
   */
  getActiveSession() {
    return this.activeSessionKey ? this.getSession(this.activeSessionKey) : null;
  }

  /**
   * Session timeout management
   */
  resetSessionTimeout(key, timeoutMs = 10 * 60 * 1000) { // 10 minutes default
    this.clearSessionTimeout(key);
    
    const timeoutId = setTimeout(() => {
      const session = this.getSession(key);
      if (session && session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.close();
        this.setSession(key, { isConnected: false });

      }
      this.sessionTimeouts.delete(key);
    }, timeoutMs);
    
    this.sessionTimeouts.set(key, timeoutId);
  }

  clearSessionTimeout(key) {
    if (this.sessionTimeouts.has(key)) {
      clearTimeout(this.sessionTimeouts.get(key));
      this.sessionTimeouts.delete(key);
    }
  }

  /**
   * Persistence methods
   */
  saveToStorage() {
    try {
      const sessionsData = [];
      
      this.sessions.forEach((session, key) => {
        if (session.isConnected || session.shouldPersist) {
          sessionsData.push({
            key,
            projectName: session.projectName,
            projectDisplayName: session.projectDisplayName,
            sessionId: session.sessionId,
            sessionSummary: session.sessionSummary,
            isBypassingPermissions: session.isBypassingPermissions,
            bufferContent: session.bufferContent || '',
            lastUpdated: session.lastUpdated
          });
        }
      });
      
      localStorage.setItem('shellSessions', JSON.stringify({
        sessions: sessionsData,
        sessionCounter: this.sessionCounter,
        activeSessionKey: this.activeSessionKey
      }));
    } catch (error) {
      // Error: 'Error saving sessions to storage:', error
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('shellSessions');
      if (!stored) return;
      
      const data = JSON.parse(stored);
      
      // Restore session counter
      this.sessionCounter = data.sessionCounter || 0;
      
      // Restore sessions (without terminal instances)
      data.sessions.forEach(sessionData => {
        this.sessions.set(sessionData.key, {
          ...sessionData,
          isConnected: false,
          shouldReconnect: true,
          terminal: null,
          ws: null
        });
      });
      
      // Don't restore active session key - let the UI decide

    } catch (error) {
      // Error: 'Error loading sessions from storage:', error
    }
  }

  /**
   * Clear all sessions
   */
  clearAllSessions() {
    // Close all connections and dispose terminals
    this.sessions.forEach((session, key) => {
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.close();
      }
      if (session.terminal && !session.terminal.disposed) {
        session.terminal.dispose();
      }
      this.clearSessionTimeout(key);
    });
    
    // Clear maps
    this.sessions.clear();
    this.sessionTimeouts.clear();
    this.activeSessionKey = null;
    
    // Clear storage
    localStorage.removeItem('shellSessions');
    
    // Emit event
    this.emit('sessionsChanged', []);
    this.emit('activeSessionChanged', null);
  }

  /**
   * Get session info for display
   */
  getSessionDisplayInfo(key) {
    const session = this.getSession(key);
    if (!session) return null;
    
    return {
      key,
      projectName: session.projectName,
      projectDisplayName: session.projectDisplayName || session.projectName || 'Unknown Project',
      sessionSummary: session.sessionSummary || 'New Session',
      isConnected: session.isConnected && session.ws?.readyState === WebSocket.OPEN,
      isActive: key === this.activeSessionKey
    };
  }
}

// Create singleton instance
const shellSessionManager = new ShellSessionManager();

// Export both the class and the singleton instance
export { ShellSessionManager, shellSessionManager as default };