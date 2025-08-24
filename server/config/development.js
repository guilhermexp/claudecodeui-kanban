/**
 * Development Environment Configuration
 * Overrides and additions specific to development environment
 */

export default {
  // Development-specific server settings
  server: {
    host: '0.0.0.0' // Allow external connections in development
  },

  // More permissive CORS for development
  server: {
    cors: {
      origin: true, // Allow all origins in development
      credentials: true
    }
  },

  // Higher limits for development
  resources: {
    maxProcessesPerIP: 5,
    maxTotalProcesses: 30
  },

  // Relaxed rate limits for development
  rateLimit: {
    general: {
      windowMs: 15 * 60 * 1000,
      max: 200 // Double the production limit
    },
    claude: {
      windowMs: 60 * 1000,
      max: 20 // Double the production limit
    }
  },

  // Verbose logging in development
  logging: {
    level: 'DEBUG',
    format: 'readable'
  },

  // Development security settings
  security: {
    apiKeyRequired: false, // Disable API key requirement in development
    csrfProtection: false // Disable CSRF protection for easier testing
  },

  // Faster cleanup intervals for development
  cleanup: {
    interval: 60000, // 1 minute instead of 2
    processTimeout: 180000 // 3 minutes instead of 5
  },

  // More frequent monitoring in development
  monitoring: {
    healthCheckInterval: 15000, // 15 seconds instead of 30
    alertThresholds: {
      memory: 600 * 1024 * 1024, // 600MB instead of 400MB
      responseTime: 10000 // 10 seconds instead of 5
    }
  }
};