// server/websocket/server.js - WebSocket Server Management
import { WebSocketServer } from 'ws';
import { createLogger } from '../utils/logger.js';
import { 
  createSecureVerifyClient, 
  handleAuthMessage,
  validateMessage, 
  setupConnectionCleanup, 
  startHeartbeatInterval,
  getSecurityStats 
} from '../middleware/websocket-security.js';

const log = createLogger('WEBSOCKET');

// Enhanced client tracking with user context for session isolation
const connectedClients = new Map(); // ws -> { userId, username, activeProject, lastActivity }

// Connection tracking for consolidated logging
const connectionTracker = {
  connections: new Map(), // user -> count
  lastLog: 0,
  logInterval: 5000, // Log summary every 5 seconds max
  
  track(user) {
    const count = this.connections.get(user) || 0;
    this.connections.set(user, count + 1);
    this.maybeLog();
  },
  
  maybeLog() {
    const now = Date.now();
    if (now - this.lastLog > this.logInterval && this.connections.size > 0) {
      const total = Array.from(this.connections.values()).reduce((a, b) => a + b, 0);
      if (total > 1) {
        log.info(`Active connections: ${total} total (${this.connections.size} users)`);
      }
      this.connections.clear();
      this.lastLog = now;
    }
  }
};

export function createWebSocketServer(server) {
  // Create WebSocket server with secure verification
  const wss = new WebSocketServer({
    server,
    verifyClient: createSecureVerifyClient()
  });

  // Start heartbeat interval for connection health
  startHeartbeatInterval(wss);

  return { wss, connectedClients, connectionTracker };
}

export function setupWebSocketHandlers(wss, connectedClients, connectionTracker) {
  wss.on('connection', (ws, request) => {
    // Setup connection cleanup
    setupConnectionCleanup(ws);
    
    // Initialize client context
    connectedClients.set(ws, {
      userId: null,
      username: null,
      activeProject: null,
      lastActivity: Date.now()
    });

    ws.on('message', async (message) => {
      try {
        // Validate message format and security
        const isValid = validateMessage(message);
        if (!isValid) {
          ws.close(1003, 'Invalid message format');
          return;
        }

        const data = JSON.parse(message);
        
        // Handle authentication messages
        if (data.type === 'auth') {
          await handleAuthMessage(ws, data, connectedClients, connectionTracker);
          return;
        }

        // Update last activity
        const context = connectedClients.get(ws);
        if (context) {
          context.lastActivity = Date.now();
        }

        // Handle other message types here
        // (This will be expanded based on the original server logic)
        
      } catch (error) {
        log.error('WebSocket message error:', error);
        ws.close(1011, 'Message processing error');
      }
    });

    ws.on('close', () => {
      connectedClients.delete(ws);
      log.debug('WebSocket connection closed');
    });

    ws.on('error', (error) => {
      log.error('WebSocket error:', error);
      connectedClients.delete(ws);
    });
  });
}
