// server/index.js - Main Server Entry Point (Refactored)

// CRITICAL: Load environment variables FIRST before any other imports
import dotenv from 'dotenv';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables using dotenv BEFORE any other imports
const possibleEnvPaths = [
  path.join(__dirname, '../.env'),
  path.join(process.cwd(), '.env'),
  '.env'
];

let envLoaded = false;
for (const envPath of possibleEnvPaths) {
  const result = dotenv.config({ path: envPath });
  if (!result.error && result.parsed) {
    console.log(`[ENV] Loaded environment from: ${envPath}`);
    envLoaded = true;
    break;
  }
}

if (!envLoaded) {
  console.warn('[ENV] Warning: Could not load .env file from any path');
}

// Now import everything else after environment is loaded
import http from 'http';
import { createLogger } from './utils/logger.js';
import { createApp } from './config/app.js';
import { setupRoutes } from './config/routes.js';
import { attachPreviewUpgradeHandler } from './routes/previewProxy.js';
import { createWebSocketServer, setupWebSocketHandlers } from './websocket/server.js';
import { initializeDatabase } from './database/db.js';
import { 
  apiRateLimit, 
  userRateLimit,
  strictRateLimit, 
  resourceMonitor, 
  processLimiter 
} from './middleware/rateLimiting.js';

// Initialize logger
const log = createLogger('SERVER');

// Configuration
const PORT = process.env.PORT || process.env.BACKEND_PORT || 7347;
const HOST = process.env.HOST || 'localhost';

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();
    log.info('Database initialized');

    // Create Express app
    const { app, upload } = createApp();
    
    // Setup rate limiting and security middleware
    app.use('/api', apiRateLimit);
    app.use('/api', userRateLimit); // User-based rate limiting after IP-based
    app.use(resourceMonitor);
    app.use(processLimiter);

    // Setup all routes
    setupRoutes(app);
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Setup WebSocket server
    const { wss, connectedClients, connectionTracker } = createWebSocketServer(server);
    setupWebSocketHandlers(wss, connectedClients, connectionTracker);
    attachPreviewUpgradeHandler(server);

    // Start server
    server.listen(PORT, HOST, () => {
      log.success(`🚀 Claude Code UI Server started!`);
      log.info(`📍 Running on: http://${HOST}:${PORT}`);
      log.info(`🔗 WebSocket: ws://${HOST}:${PORT}`);
      log.info(`📂 Environment: ${process.env.NODE_ENV || 'development'}`);
      
      if (process.env.NODE_ENV === 'production') {
        log.info('🌍 Production mode - serving static files from dist/');
      } else {
        log.info('🔧 Development mode - use npm run dev for full stack');
      }
    });

    // Graceful shutdown handling
    const gracefulShutdown = (signal) => {
      log.info(`\n🛑 Received ${signal}, shutting down gracefully...`);
      
      server.close(() => {
        log.info('✅ Server closed');
        
        // Close WebSocket connections
        wss.clients.forEach((ws) => {
          ws.close(1001, 'Server shutdown');
        });
        
        log.info('👋 Goodbye!');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    log.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
