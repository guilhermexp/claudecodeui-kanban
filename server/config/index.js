/**
 * Centralized Configuration Management
 * Consolidates all configuration settings with environment-specific overrides
 */

import fs from 'fs';
import path from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Base configuration
const config = {
  // Environment
  environment: process.env.NODE_ENV || 'development',
  
  // Server Configuration
  server: {
    port: parseInt(process.env.PORT) || 7347,
    host: process.env.HOST || 'localhost',
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true
    }
  },

  // Frontend Configuration  
  frontend: {
    port: parseInt(process.env.VITE_PORT) || 5892,
    host: process.env.VITE_HOST || 'localhost'
  },

  // Vibe Kanban Configuration
  vibeKanban: {
    port: parseInt(process.env.VIBE_BACKEND_PORT) || 6734,
    url: process.env.VIBE_BACKEND_URL || 'http://localhost:6734',
    timeout: parseInt(process.env.VIBE_TIMEOUT) || 5000,
    healthCheckInterval: parseInt(process.env.VIBE_HEALTH_CHECK_INTERVAL) || 30000
  },

  // Database Configuration
  database: {
    path: process.env.DB_PATH || path.join(__dirname, '../../data/claude-code.db'),
    backupPath: process.env.DB_BACKUP_PATH || path.join(__dirname, '../../data/backups'),
    backupInterval: parseInt(process.env.DB_BACKUP_INTERVAL) || 24 * 60 * 60 * 1000, // 24 hours
    connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT) || 5000
  },

  // Claude CLI Configuration
  claude: {
    timeout: parseInt(process.env.CLAUDE_TIMEOUT) || 30000,
    maxConcurrent: parseInt(process.env.MAX_CLAUDE_PROCESSES) || 5,
    maxProcessAge: parseInt(process.env.MAX_PROCESS_AGE) || 30 * 60 * 1000, // 30 minutes
    cleanupInterval: parseInt(process.env.CLAUDE_CLEANUP_INTERVAL) || 5 * 60 * 1000, // 5 minutes
    model: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
  },

  // Rate Limiting Configuration
  rateLimit: {
    general: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW) || 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.RATE_LIMIT_MAX) || 100
    },
    claude: {
      windowMs: parseInt(process.env.CLAUDE_RATE_LIMIT_WINDOW) || 60 * 1000, // 1 minute  
      max: parseInt(process.env.CLAUDE_RATE_LIMIT_MAX) || 10
    },
    files: {
      windowMs: parseInt(process.env.FILE_RATE_LIMIT_WINDOW) || 5 * 60 * 1000, // 5 minutes
      max: parseInt(process.env.FILE_RATE_LIMIT_MAX) || 50
    },
    strict: {
      windowMs: parseInt(process.env.STRICT_RATE_LIMIT_WINDOW) || 15 * 60 * 1000,
      max: parseInt(process.env.STRICT_RATE_LIMIT_MAX) || 20
    }
  },

  // Resource Limits
  resources: {
    maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE) || 500 * 1024 * 1024, // 500MB
    maxProcessesPerIP: parseInt(process.env.MAX_PROCESSES_PER_IP) || 3,
    maxTotalProcesses: parseInt(process.env.MAX_TOTAL_PROCESSES) || 20,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100MB
    maxFiles: parseInt(process.env.MAX_FILES) || 100
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'INFO',
    format: process.env.LOG_FORMAT || 'readable', // 'json' or 'readable'
    file: process.env.LOG_FILE || null,
    maxSize: parseInt(process.env.LOG_MAX_SIZE) || 50 * 1024 * 1024, // 50MB
    maxFiles: parseInt(process.env.LOG_MAX_FILES) || 5
  },

  // Security Configuration
  security: {
    apiKeyRequired: process.env.API_KEY_REQUIRED === 'true',
    apiKey: process.env.API_KEY || null,
    jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-in-production',
    jwtExpiry: process.env.JWT_EXPIRY || '7d',
    sessionTimeout: parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000, // 24 hours
    csrfProtection: process.env.CSRF_PROTECTION === 'true'
  },

  // File System Configuration
  filesystem: {
    uploadsDir: process.env.UPLOADS_DIR || path.join(__dirname, '../../uploads'),
    tempDir: process.env.TEMP_DIR || path.join(__dirname, '../../temp'),
    allowedExtensions: (process.env.ALLOWED_EXTENSIONS || '.js,.ts,.jsx,.tsx,.py,.md,.txt,.json,.css,.html,.yaml,.yml').split(','),
    maxPathDepth: parseInt(process.env.MAX_PATH_DEPTH) || 10
  },

  // WebSocket Configuration
  websocket: {
    heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL) || 30000,
    connectionTimeout: parseInt(process.env.WS_CONNECTION_TIMEOUT) || 60000,
    maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS) || 100,
    maxMessageSize: parseInt(process.env.WS_MAX_MESSAGE_SIZE) || 1024 * 1024 // 1MB
  },

  // Cleanup Service Configuration
  cleanup: {
    enabled: process.env.CLEANUP_ENABLED !== 'false',
    interval: parseInt(process.env.CLEANUP_INTERVAL) || 120000, // 2 minutes
    processTimeout: parseInt(process.env.CLEANUP_PROCESS_TIMEOUT) || 300000, // 5 minutes
    maxOrphanCount: parseInt(process.env.CLEANUP_MAX_ORPHAN_COUNT) || 10,
    forceCleanupThreshold: parseInt(process.env.CLEANUP_FORCE_THRESHOLD) || 50
  },

  // Monitoring Configuration
  monitoring: {
    healthCheckInterval: parseInt(process.env.HEALTH_CHECK_INTERVAL) || 30000,
    metricsRetentionTime: parseInt(process.env.METRICS_RETENTION_TIME) || 24 * 60 * 60 * 1000, // 24 hours
    alertThresholds: {
      memory: parseInt(process.env.ALERT_MEMORY_THRESHOLD) || 400 * 1024 * 1024, // 400MB
      cpu: parseInt(process.env.ALERT_CPU_THRESHOLD) || 80, // 80%
      responseTime: parseInt(process.env.ALERT_RESPONSE_TIME_THRESHOLD) || 5000, // 5 seconds
      errorRate: parseFloat(process.env.ALERT_ERROR_RATE_THRESHOLD) || 0.05 // 5%
    }
  }
};

// Environment-specific overrides
function loadEnvironmentConfig() {
  const envConfigPath = path.join(__dirname, `${config.environment}.js`);
  
  try {
    if (fs.existsSync(envConfigPath)) {
      const envConfig = await import(envConfigPath);
      return envConfig.default || envConfig;
    }
  } catch (error) {
  }
  
  return {};
}

// Deep merge configuration objects
function mergeConfig(base, override) {
  const result = { ...base };
  
  for (const [key, value] of Object.entries(override)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = mergeConfig(base[key] || {}, value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// Validation functions
function validateConfig(config) {
  const errors = [];

  // Required configurations - only warn in production
  if (config.environment === 'production' && 
      (!config.security.jwtSecret || config.security.jwtSecret === 'your-super-secret-jwt-key-here-change-in-production')) {
    errors.push('JWT_SECRET must be set to a secure value in production');
  }

  if (config.security.apiKeyRequired && !config.security.apiKey) {
    errors.push('API_KEY must be set when API_KEY_REQUIRED is true');
  }

  // Port conflicts
  const ports = [config.server.port, config.frontend.port, config.vibeKanban.port];
  const uniquePorts = new Set(ports);
  if (uniquePorts.size !== ports.length) {
    errors.push('Port conflicts detected between services');
  }

  // Resource limits validation
  if (config.resources.maxProcessesPerIP > config.resources.maxTotalProcesses) {
    errors.push('MAX_PROCESSES_PER_IP cannot exceed MAX_TOTAL_PROCESSES');
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
}

// Initialize configuration
async function initializeConfig() {
  try {
    const envConfig = await loadEnvironmentConfig();
    const finalConfig = mergeConfig(config, envConfig);
    
    // Validate configuration
    validateConfig(finalConfig);
    
    return finalConfig;
  } catch (error) {
    console.error('Configuration initialization failed:', error);
    throw error;
  }
}

// Export configuration
let configInstance = null;

export async function getConfig() {
  if (!configInstance) {
    configInstance = await initializeConfig();
  }
  return configInstance;
}

// Export default for sync access (use carefully)
export default config;

// Environment-specific helpers
export const isDevelopment = config.environment === 'development';
export const isProduction = config.environment === 'production';
export const isTest = config.environment === 'test';