import { createProxyMiddleware } from 'http-proxy-middleware';
import fetch from 'node-fetch';

// Health check for Vibe Kanban backend
let vibeKanbanHealthy = false;
let lastHealthCheck = 0;
const HEALTH_CHECK_INTERVAL = 5000; // 5 seconds

async function checkVibeKanbanHealth() {
  try {
    const response = await fetch('http://localhost:8081/api/health', {
      timeout: 2000 // 2 second timeout
    });
    vibeKanbanHealthy = response.ok;
    lastHealthCheck = Date.now();
    return vibeKanbanHealthy;
  } catch (error) {
    vibeKanbanHealthy = false;
    console.error('❌ Vibe Kanban health check failed:', error.message);
    return false;
  }
}

// Periodic health check
setInterval(checkVibeKanbanHealth, HEALTH_CHECK_INTERVAL);

// Initial health check
checkVibeKanbanHealth();

// Create proxy middleware with retry logic
export const vibeKanbanProxy = createProxyMiddleware({
  target: 'http://localhost:8081',
  changeOrigin: true,
  pathRewrite: {
    '^/api/vibe-kanban': '/api'
  },
  ws: true, // WebSocket support
  logLevel: 'warn',
  timeout: 30000, // 30 second timeout
  proxyTimeout: 30000,
  
  // Error handling
  onError: (err, req, res) => {
    console.error('Vibe Kanban proxy error:', err.message);
    
    // Check if it's a connection error
    if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT') {
      vibeKanbanHealthy = false;
      
      res.status(503).json({
        success: false,
        message: 'Vibe Kanban backend is temporarily unavailable',
        error: 'Service Unavailable',
        details: 'The backend service is not responding. Please try again in a few moments.'
      });
    } else {
      res.status(502).json({
        success: false,
        message: 'Error communicating with Vibe Kanban backend',
        error: err.message
      });
    }
  },
  
  // Pre-flight check
  onProxyReq: (proxyReq, req, res) => {
    // Add custom headers if needed
    proxyReq.setHeader('X-Forwarded-Host', req.headers.host);
    proxyReq.setHeader('X-Real-IP', req.ip || req.connection.remoteAddress);
    
    // Log for debugging
    if (process.env.DEBUG_PROXY) {
      console.log(`[PROXY] ${req.method} ${req.originalUrl} -> ${proxyReq.path}`);
    }
  },
  
  // Response handling
  onProxyRes: (proxyRes, req, res) => {
    // Mark as healthy if we get any response
    if (!vibeKanbanHealthy) {
      vibeKanbanHealthy = true;
      console.log('✅ Vibe Kanban backend is now responding');
    }
    
    // Add CORS headers if needed
    proxyRes.headers['Access-Control-Allow-Origin'] = '*';
    proxyRes.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
  }
});

// Middleware to check health before proxying
export function vibeKanbanHealthMiddleware(req, res, next) {
  // Quick health check if last check was too long ago
  if (Date.now() - lastHealthCheck > HEALTH_CHECK_INTERVAL * 2) {
    checkVibeKanbanHealth();
  }
  
  // If unhealthy, return error immediately
  if (!vibeKanbanHealthy) {
    return res.status(503).json({
      success: false,
      message: 'Vibe Kanban backend is starting up or unavailable',
      error: 'Service Unavailable',
      details: 'Please wait a moment while the service initializes.'
    });
  }
  
  next();
}

// Export health status getter
export function isVibeKanbanHealthy() {
  return vibeKanbanHealthy;
}