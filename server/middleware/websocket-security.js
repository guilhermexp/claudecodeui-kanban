import { authenticateWebSocket } from './auth.js';
import { createLogger } from '../utils/logger.js';

const wslog = createLogger('ws-security');

// Rate limiting storage
const rateLimiter = new Map(); // IP -> { connections: number, lastReset: timestamp }
const connectionCounts = new Map(); // IP -> current active connections

// Security configuration (adjusted for development vs production)
// Default to development-friendly if NODE_ENV is not explicitly 'production'
const isDevelopment = process.env.NODE_ENV !== 'production';
const SECURITY_CONFIG = {
  MAX_CONNECTIONS_PER_MINUTE: isDevelopment ? 200 : 10, // Muito mais permissivo em dev
  MAX_MESSAGE_SIZE: isDevelopment ? 100 * 1024 : 10 * 1024, // 100KB dev, 10KB prod
  MAX_CONCURRENT_CONNECTIONS: isDevelopment ? 500 : 100, // Maior limite em dev
  MAX_CONNECTIONS_PER_IP: isDevelopment ? 200 : 10, // Muito maior em dev
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minute
  CONNECTION_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
  HEARTBEAT_INTERVAL_MS: 30 * 1000, // 30 seconds
};

// Clean up rate limiter periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, data] of rateLimiter.entries()) {
    if (now - data.lastReset > SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS) {
      rateLimiter.delete(ip);
    }
  }
}, SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS);

/**
 * Get client IP address from request
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         'unknown';
}

/**
 * Check if IP is rate limited
 */
function isRateLimited(ip) {
  const now = Date.now();
  const data = rateLimiter.get(ip);
  
  if (!data) {
    rateLimiter.set(ip, { connections: 1, lastReset: now });
    return false;
  }
  
  // Reset window if expired
  if (now - data.lastReset > SECURITY_CONFIG.RATE_LIMIT_WINDOW_MS) {
    rateLimiter.set(ip, { connections: 1, lastReset: now });
    return false;
  }
  
  // Check if limit exceeded
  if (data.connections >= SECURITY_CONFIG.MAX_CONNECTIONS_PER_MINUTE) {
    wslog.warn(`Rate limit exceeded for IP ${ip}: ${data.connections} connections`);
    return true;
  }
  
  // Increment counter
  data.connections++;
  return false;
}

/**
 * Check current connection count for IP
 */
function hasExceededIPLimit(ip) {
  const currentConnections = connectionCounts.get(ip) || 0;
  return currentConnections >= SECURITY_CONFIG.MAX_CONNECTIONS_PER_IP;
}

/**
 * Track new connection for IP
 */
function trackConnection(ip) {
  const current = connectionCounts.get(ip) || 0;
  connectionCounts.set(ip, current + 1);
}

/**
 * Remove connection tracking for IP
 */
function untrackConnection(ip) {
  const current = connectionCounts.get(ip) || 0;
  if (current <= 1) {
    connectionCounts.delete(ip);
  } else {
    connectionCounts.set(ip, current - 1);
  }
}

/**
 * Get current total connections
 */
function getTotalConnections() {
  let total = 0;
  for (const count of connectionCounts.values()) {
    total += count;
  }
  return total;
}

/**
 * Enhanced WebSocket verifyClient function with security checks (basic only)
 */
function createSecureVerifyClient() {
  return (info) => {
    const ip = getClientIP(info.req);
    
    // Check rate limiting
    if (isRateLimited(ip)) {
      wslog.warn(`Connection rejected - rate limited: ${ip}`);
      return false;
    }
    
    // Check IP connection limit
    if (hasExceededIPLimit(ip)) {
      wslog.warn(`Connection rejected - IP limit exceeded: ${ip}`);
      return false;
    }
    
    // Check total connection limit
    if (getTotalConnections() >= SECURITY_CONFIG.MAX_CONCURRENT_CONNECTIONS) {
      wslog.warn(`Connection rejected - server capacity full: ${getTotalConnections()} connections`);
      return false;
    }
    
    // Store IP in the request for later use
    info.req.clientIP = ip;
    
    // Track this connection (will be cleaned up if auth fails)
    trackConnection(ip);
    
    wslog.debug(`Connection accepted from ${ip}, awaiting authentication`);
    return true;
  };
}

/**
 * Handle post-connection authentication
 */
function handleAuthMessage(ws, message, clientIP) {
  try {
    const data = JSON.parse(message);
    
    if (data.type !== 'auth') {
      return { authenticated: false, error: 'First message must be authentication' };
    }
    
    if (!data.token) {
      return { authenticated: false, error: 'No token provided' };
    }
    
    // Verify token
    const user = authenticateWebSocket(data.token);
    if (!user) {
      return { authenticated: false, error: 'Invalid token' };
    }
    
    wslog.info(`Authentication successful for user ${user.username} from ${clientIP}`);
    
    return { 
      authenticated: true, 
      user,
      response: {
        type: 'auth-success',
        user: {
          userId: user.userId,
          username: user.username
        }
      }
    };
    
  } catch (error) {
    return { authenticated: false, error: 'Invalid authentication message' };
  }
}

/**
 * Validate and sanitize WebSocket message
 */
function validateMessage(message, ws, clientIP) {
  try {
    // Check message size
    if (message.length > SECURITY_CONFIG.MAX_MESSAGE_SIZE) {
      wslog.warn(`Message rejected - too large (${message.length} bytes) from ${clientIP}`);
      ws.send(JSON.stringify({
        type: 'error',
        error: 'Message too large',
        maxSize: SECURITY_CONFIG.MAX_MESSAGE_SIZE
      }));
      return null;
    }
    
    // Parse JSON
    const data = JSON.parse(message);
    
    // Basic structure validation
    if (typeof data !== 'object' || data === null) {
      throw new Error('Message must be a JSON object');
    }
    
    if (typeof data.type !== 'string' || !data.type.trim()) {
      throw new Error('Message must have a valid type field');
    }
    
    // Sanitize string fields
    if (data.message && typeof data.message === 'string') {
      data.message = data.message.slice(0, 8192); // Limit message content
    }
    
    if (data.command && typeof data.command === 'string') {
      data.command = data.command.slice(0, 4096); // Limit command length
    }
    
    return data;
    
  } catch (error) {
    wslog.warn(`Invalid message from ${clientIP}: ${error.message}`);
    ws.send(JSON.stringify({
      type: 'error',
      error: 'Invalid message format'
    }));
    return null;
  }
}

/**
 * Setup connection cleanup on close
 */
function setupConnectionCleanup(ws, clientIP) {
  const cleanup = () => {
    untrackConnection(clientIP);
    wslog.debug(`Connection cleaned up for ${clientIP}`);
  };
  
  ws.on('close', cleanup);
  ws.on('error', cleanup);
  
  // Setup heartbeat
  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
    // Treat pong as activity
    try { resetInactivityTimer(); } catch {}
  });
  
  // Idle timeout (resets on activity)
  let inactivityTimer = null;
  const resetInactivityTimer = () => {
    if (inactivityTimer) clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
      if (ws.readyState === ws.OPEN) {
        wslog.warn(`Inactivity timeout for ${clientIP}`);
        ws.terminate();
      }
    }, SECURITY_CONFIG.CONNECTION_TIMEOUT_MS);
  };
  // Consider any message as activity
  ws.on('message', resetInactivityTimer);
  resetInactivityTimer();
  
  ws.on('close', () => { if (inactivityTimer) clearTimeout(inactivityTimer); });
  ws.on('error', () => { if (inactivityTimer) clearTimeout(inactivityTimer); });
}

/**
 * Start heartbeat interval to detect dead connections
 */
function startHeartbeatInterval(wss) {
  const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        wslog.debug('Terminating dead connection');
        return ws.terminate();
      }
      
      ws.isAlive = false;
      ws.ping();
    });
  }, SECURITY_CONFIG.HEARTBEAT_INTERVAL_MS);
  
  wss.on('close', () => {
    clearInterval(interval);
  });
  
  return interval;
}

/**
 * Get security stats
 */
function getSecurityStats() {
  return {
    totalConnections: getTotalConnections(),
    maxConcurrentConnections: SECURITY_CONFIG.MAX_CONCURRENT_CONNECTIONS,
    connectionsByIP: Object.fromEntries(connectionCounts),
    rateLimitedIPs: rateLimiter.size,
    config: SECURITY_CONFIG
  };
}

export {
  createSecureVerifyClient,
  handleAuthMessage,
  validateMessage,
  setupConnectionCleanup,
  startHeartbeatInterval,
  getSecurityStats,
  SECURITY_CONFIG
};
