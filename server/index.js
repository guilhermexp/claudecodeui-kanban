// server/index.js - Main Server Entry Point (Refactored)
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import { createLogger } from './utils/logger.js';

// Import refactored modules
import { createApp } from './config/app.js';
import { setupRoutes } from './config/routes.js';
import { createWebSocketServer, setupWebSocketHandlers } from './websocket/server.js';
import { initializeDatabase } from './database/db.js';
import { 
  apiRateLimit, 
  strictRateLimit, 
  resourceMonitor, 
  processLimiter 
} from './middleware/rateLimiting.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
try {
  const envPath = path.join(__dirname, '../.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0 && !process.env[key]) {
        process.env[key] = valueParts.join('=').trim();
      }
    }
  });
} catch (e) {
  // .env file is optional
}

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
    app.use('/api/claude-stream', strictRateLimit);
    app.use(resourceMonitor);
    app.use(processLimiter);

    // Setup all routes
    setupRoutes(app);
    
    // Create HTTP server
    const server = http.createServer(app);
    
    // Setup WebSocket server
    const { wss, connectedClients, connectionTracker } = createWebSocketServer(server);
    setupWebSocketHandlers(wss, connectedClients, connectionTracker);

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
