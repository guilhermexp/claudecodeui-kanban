/**
 * Centralized configuration management
 */

const path = require('path');
const fs = require('fs');

class Config {
  constructor() {
    this.env = process.env.NODE_ENV || 'development';
    this.isDevelopment = this.env === 'development';
    this.isProduction = this.env === 'production';
    this.isTest = this.env === 'test';
    
    // Server configuration
    this.server = {
      port: parseInt(process.env.PORT || '8080', 10),
      host: process.env.HOST || '0.0.0.0',
      sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
      jwtSecret: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production'
    };
    
    // Client configuration
    this.client = {
      port: parseInt(process.env.VITE_PORT || '9000', 10),
      url: process.env.VITE_SERVER_URL || 'http://localhost:8080',
      wsUrl: process.env.VITE_WS_URL || 'ws://localhost:8080'
    };
    
    // Vibe Kanban configuration
    this.vibeKanban = {
      port: parseInt(process.env.VIBE_PORT || '8081', 10),
      url: process.env.VIBE_URL || 'http://localhost:8081',
      timeout: parseInt(process.env.VIBE_TIMEOUT || '30000', 10),
      retries: parseInt(process.env.VIBE_RETRIES || '3', 10),
      healthCheckInterval: parseInt(process.env.VIBE_HEALTH_CHECK_INTERVAL || '30000', 10)
    };
    
    // Database configuration
    this.database = {
      path: path.join(__dirname, '../../data/auth.db'),
      vibeKanbanPath: process.env.VIBE_DATABASE_URL || 'sqlite://./data/vibe.db'
    };
    
    // Logging configuration
    this.logging = {
      level: process.env.LOG_LEVEL || (this.isDevelopment ? 'DEBUG' : 'INFO'),
      format: process.env.LOG_FORMAT || 'json'
    };
    
    // Security configuration
    this.security = {
      corsOrigin: process.env.CORS_ORIGIN || '*',
      enableAuth: process.env.ENABLE_AUTH !== 'false',
      sessionTimeout: parseInt(process.env.SESSION_TIMEOUT || '86400000', 10), // 24 hours
      maxUploadSize: parseInt(process.env.MAX_UPLOAD_SIZE || '10485760', 10) // 10MB
    };
    
    // Feature flags
    this.features = {
      enableMCP: process.env.ENABLE_MCP !== 'false',
      enableVoice: process.env.ENABLE_VOICE !== 'false',
      enableVibeKanban: process.env.ENABLE_VIBE_KANBAN !== 'false'
    };
  }
  
  validate() {
    const errors = [];
    
    // Validate required environment variables in production
    if (this.isProduction) {
      if (this.server.sessionSecret === 'dev-secret-change-in-production') {
        errors.push('SESSION_SECRET must be set in production');
      }
      if (this.server.jwtSecret === 'dev-jwt-secret-change-in-production') {
        errors.push('JWT_SECRET must be set in production');
      }
    }
    
    // Validate port numbers
    if (this.server.port < 1 || this.server.port > 65535) {
      errors.push('Invalid PORT value');
    }
    if (this.client.port < 1 || this.client.port > 65535) {
      errors.push('Invalid VITE_PORT value');
    }
    if (this.vibeKanban.port < 1 || this.vibeKanban.port > 65535) {
      errors.push('Invalid VIBE_PORT value');
    }
    
    if (errors.length > 0) {
      throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
    }
  }
  
  get(path) {
    const keys = path.split('.');
    let value = this;
    
    for (const key of keys) {
      value = value[key];
      if (value === undefined) {
        return undefined;
      }
    }
    
    return value;
  }
}

// Create singleton instance
const config = new Config();

// Validate configuration on startup
try {
  config.validate();
} catch (error) {
  console.error('Configuration error:', error.message);
  process.exit(1);
}

module.exports = config;