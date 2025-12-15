// server/websocket/server.js - WebSocket Server Management
import { WebSocketServer } from 'ws';
import { spawn as nodePtySpawn } from 'node-pty';
import { homedir } from 'os';
import { existsSync } from 'fs';
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

// Store shell processes per WebSocket connection
const shellProcesses = new Map(); // ws -> { process, projectPath, sessionId }

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

// Helper function to expand tilde (~) in paths
function expandTilde(filepath) {
  if (!filepath) return filepath;
  if (filepath === '~' || filepath.startsWith('~/')) {
    return filepath.replace('~', homedir());
  }
  return filepath;
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
    
    // Handle specific message types
    switch (data.type) {
      case 'ping':
        // Respond to ping with pong
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      
      case 'init':
        // Shell initialization - store session info in context
        context.activeProject = data.projectPath || null;

        // Initialize shell process
        try {
          // Expand tilde in project path
          let projectPath = data.projectPath && data.projectPath !== 'STANDALONE_MODE'
            ? expandTilde(data.projectPath)
            : process.cwd();

          // Determine shell command based on platform
          const isWindows = process.platform === 'win32';
          const shellCmd = isWindows ? 'cmd.exe' : process.env.SHELL || '/bin/bash';

          log.info(`Initializing shell - ${JSON.stringify({
            userId,
            originalPath: data.projectPath,
            expandedPath: projectPath,
            sessionId: data.sessionId,
            shell: shellCmd,
            shellExists: existsSync(shellCmd),
            cwdExists: existsSync(projectPath)
          })}`);

          // Create environment that makes shell think it's in a terminal
          const shellEnv = {
            ...process.env,
            TERM: 'xterm-256color',
            COLORTERM: 'truecolor',
            FORCE_COLOR: '1'
          };

          // Spawn shell process with PTY for proper terminal support
          log.info(`About to spawn shell with PTY: ${shellCmd} in ${projectPath}`);
          const shellProcess = nodePtySpawn(shellCmd, [], {
            name: 'xterm-256color',
            cols: data.cols || 80,
            rows: data.rows || 24,
            cwd: projectPath,
            env: shellEnv
          });

          log.info(`Shell process spawned with PID: ${shellProcess.pid}`);

          // Store process info
          shellProcesses.set(ws, {
            process: shellProcess,
            projectPath,
            sessionId: data.sessionId,
            cols: data.cols || 80,
            rows: data.rows || 24
          });

          log.info(`Stored shell process in map for session: ${data.sessionId}`);

          // Handle output from PTY (combines stdout and stderr)
          shellProcess.onData((data) => {
            log.info(`Shell output: ${data.substring(0, 100)}`);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'output',
                data: data
              }));
              log.info(`Sent output to client`);
            } else {
              log.warn(`WebSocket not open, cannot send output`);
            }
          });
          
          // Handle process exit
          shellProcess.onExit(({ exitCode, signal }) => {
            log.debug(`Shell process exited - code: ${exitCode}, signal: ${signal}, sessionId: ${data.sessionId}`);
            shellProcesses.delete(ws);
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({
                type: 'output',
                data: `\r\n[Process exited with code ${exitCode}]\r\n`
              }));
            }
          });
          
          // Send init-success
          log.info(`Sending init-success to client for session: ${data.sessionId}`);
          ws.send(JSON.stringify({ type: 'init-success' }));
          log.info(`init-success sent successfully - PTY will automatically show prompt`);
        } catch (error) {
          log.error(`Failed to initialize shell - ${JSON.stringify({
            errorMessage: error.message,
            errorCode: error.code,
            errorStack: error.stack,
            userId,
            projectPath: data.projectPath
          })}`);
          ws.send(JSON.stringify({
            type: 'error',
            error: `Failed to initialize shell: ${error.message}`,
            details: {
              code: error.code,
              stack: error.stack
            }
          }));
        }
        return;
      
      case 'input':
        // Shell input - forward to shell process
        const shellInfo = shellProcesses.get(ws);
        if (shellInfo && shellInfo.process) {
          try {
            shellInfo.process.write(data.data || '');
          } catch (error) {
            log.error(`Failed to write to shell PTY - error: ${error.message}, userId: ${userId}`);
          }
        }
        return;
      
      case 'resize':
        // Terminal resize - update shell process dimensions
        const shellInfoResize = shellProcesses.get(ws);
        if (shellInfoResize && shellInfoResize.process) {
          const cols = data.cols || 80;
          const rows = data.rows || 24;

          shellInfoResize.cols = cols;
          shellInfoResize.rows = rows;

          // Resize the PTY
          try {
            shellInfoResize.process.resize(cols, rows);
          } catch (error) {
            log.error(`Failed to resize PTY - error: ${error.message}`);
          }
        }
        return;
      
      default:
        // Unknown message type - log and continue
        log.debug('Authenticated WebSocket message processed', {
          userId,
          type: data.type
        });
    }
    
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
    log.info(`[WebSocket] New connection from ${request.socket.remoteAddress}, URL: ${request.url}`);

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
        const clientIP = ws._socket?.remoteAddress || 'unknown';

        log.info(`[WebSocket] Received message from ${clientIP}: ${message.toString().substring(0, 100)}...`);

        // Validate message format and security (this also parses JSON)
        const data = validateMessage(message, ws, clientIP);
        if (!data) {
          // validateMessage already sent error response and logged
          return;
        }

        log.info(`[WebSocket] Message type: ${data.type}`);
        
        // Handle authentication messages
        if (data.type === 'auth') {
          log.info(`[WebSocket] Processing auth message...`);
          const authResult = handleAuthMessage(ws, message, clientIP);

          log.info(`[WebSocket] Auth result:`, { authenticated: authResult.authenticated, user: authResult.user?.username });

          if (authResult.authenticated) {
            // Update client context with authenticated user info
            const context = connectedClients.get(ws);
            if (context) {
              context.userId = authResult.user.userId;
              context.username = authResult.user.username;
              context.lastActivity = Date.now();
            }

            // Track connection
            connectionTracker.track(authResult.user.username);

            // Send auth-success response
            log.info(`[WebSocket] Sending auth-success response`);
            ws.send(JSON.stringify(authResult.response));

            log.debug('WebSocket authenticated', {
              userId: authResult.user.userId,
              username: authResult.user.username,
              ip: clientIP
            });
          } else {
            log.warn('WebSocket authentication failed', {
              error: authResult.error,
              ip: clientIP
            });
            ws.send(JSON.stringify({
              type: 'error',
              error: authResult.error || 'Authentication failed',
              code: 'AUTH_FAILED'
            }));
            ws.close(1008, 'Authentication failed');
          }
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
      // Clean up shell process if exists
      const shellInfo = shellProcesses.get(ws);
      if (shellInfo && shellInfo.process) {
        log.debug(`Cleaning up shell process on WebSocket close - sessionId: ${shellInfo.sessionId}`);
        try {
          shellInfo.process.kill();
        } catch (error) {
          log.error(`Error cleaning up shell process - error: ${error.message}`);
        }
        shellProcesses.delete(ws);
      }

      connectedClients.delete(ws);
      log.debug('WebSocket connection closed');
    });

    ws.on('error', (error) => {
      log.error('WebSocket error:', error);
      connectedClients.delete(ws);
    });
  });
}
