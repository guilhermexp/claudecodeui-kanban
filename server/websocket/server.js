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
  
  // Start cleanup timer for inactive connections
  setInterval(() => {
    cleanupInactiveConnections(connectedClients);
  }, 10 * 60 * 1000); // Run every 10 minutes

  return { wss, connectedClients, connectionTracker };
}

// Handle authenticated WebSocket messages
async function handleAuthenticatedMessage(ws, data, context) {
  const log = createLogger('WS-AUTH');
  
  try {
    // Rate limiting per user
    const userId = context.userId;
    const rateLimitKey = `ws_${userId}`;
    
    // Simple rate limiting: max 100 messages per minute per user
    const rateLimits = global.wsRateLimits = global.wsRateLimits || new Map();
    const userLimit = rateLimits.get(rateLimitKey) || { count: 0, resetTime: Date.now() + 60000 };
    
    if (Date.now() > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = Date.now() + 60000;
    }
    
    if (userLimit.count >= 100) {
      log.warn('WebSocket rate limit exceeded', { userId, messageType: data.type });
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Rate limit exceeded',
        code: 'RATE_LIMITED'
      }));
      return;
    }
    
    userLimit.count++;
    rateLimits.set(rateLimitKey, userLimit);
    
    // Log security-relevant messages
    if (['claude-start-session', 'codex-start-session', 'claude-stream-message'].includes(data.type)) {
      log.info('WebSocket authenticated message', {
        userId,
        username: context.username,
        type: data.type,
        projectPath: data.options?.projectPath
      });
    }
    
    // TODO: Add specific message handlers here based on message type
    // For now, just log that we received an authenticated message
    log.debug('Authenticated WebSocket message processed', {
      userId,
      type: data.type
    });
    
  } catch (error) {
    log.error('Error handling authenticated WebSocket message:', error);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }));
  }
}

// Cleanup inactive connections
function cleanupInactiveConnections(connectedClients) {
  const log = createLogger('WS-CLEANUP');
  const now = Date.now();
  const INACTIVE_TIMEOUT = 30 * 60 * 1000; // 30 minutes
  
  let cleaned = 0;
  for (const [ws, context] of connectedClients.entries()) {
    if (now - context.lastActivity > INACTIVE_TIMEOUT) {
      log.info('Closing inactive WebSocket connection', {
        userId: context.userId,
        username: context.username,
        inactiveFor: Math.round((now - context.lastActivity) / 60000) + ' minutes'
      });
      
      ws.close(1001, 'Connection inactive');
      connectedClients.delete(ws);
      cleaned++;
    }
  }
  
  if (cleaned > 0) {
    log.info(`Cleaned up ${cleaned} inactive WebSocket connections`);
  }
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

        // SECURITY: All other messages require authentication
        const context = connectedClients.get(ws);
        if (!context || !context.userId) {
          log.warn('Unauthenticated WebSocket message attempt', {
            type: data.type,
            ip: ws._socket?.remoteAddress
          });
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Authentication required',
            code: 'UNAUTHENTICATED'
          }));
          return;
        }

        // Update last activity for authenticated users
        context.lastActivity = Date.now();

        // Handle authenticated messages
        await handleAuthenticatedMessage(ws, data, context);
        
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
