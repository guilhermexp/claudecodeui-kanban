/**
 * Production Environment Configuration
 * Security-focused settings for production deployment
 */

export default {
  // Strict production server settings
  server: {
    host: '0.0.0.0',
    cors: {
      origin: process.env.CORS_ORIGIN || false, // Explicit origins only
      credentials: true
    }
  },

  // Conservative resource limits for production
  resources: {
    maxProcessesPerIP: 2,
    maxTotalProcesses: 15,
    maxMemoryUsage: 400 * 1024 * 1024 // 400MB
  },

  // Strict rate limits for production
  rateLimit: {
    general: {
      windowMs: 15 * 60 * 1000,
      max: 50 // Half of development
    },
    claude: {
      windowMs: 60 * 1000,
      max: 5 // Half of development
    },
    strict: {
      windowMs: 15 * 60 * 1000,
      max: 10 // Very restrictive
    }
  },

  // Production logging
  logging: {
    level: 'INFO',
    format: 'json', // Structured logging for production
    file: process.env.LOG_FILE || '/var/log/claude-code-ui/app.log'
  },

  // Strict production security
  security: {
    apiKeyRequired: true, // Always require API key in production
    csrfProtection: true,
    sessionTimeout: 12 * 60 * 60 * 1000 // 12 hours instead of 24
  },

  // Conservative cleanup settings
  cleanup: {
    interval: 300000, // 5 minutes
    processTimeout: 600000, // 10 minutes
    maxOrphanCount: 5 // Lower threshold
  },

  // Production monitoring
  monitoring: {
    healthCheckInterval: 60000, // 1 minute
    metricsRetentionTime: 7 * 24 * 60 * 60 * 1000, // 7 days
    alertThresholds: {
      memory: 300 * 1024 * 1024, // 300MB - more conservative
      cpu: 70, // 70% CPU
      responseTime: 3000, // 3 seconds
      errorRate: 0.01 // 1% error rate
    }
  },

  // Production database settings
  database: {
    backupInterval: 6 * 60 * 60 * 1000, // 6 hours instead of 24
    connectionTimeout: 3000 // 3 seconds
  },

  // Production WebSocket settings
  websocket: {
    heartbeatInterval: 30000,
    connectionTimeout: 30000, // Shorter timeout
    maxConnections: 50 // Lower limit
  }
};