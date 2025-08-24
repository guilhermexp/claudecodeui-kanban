/**
 * Centralized logging system with levels and formatting
 */

import util from 'util';

class Logger {
  constructor(name = 'app') {
    this.name = name;
    this.levels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    this.currentLevel = process.env.LOG_LEVEL || 'INFO';
  }

  formatMessage(level, message, metadata = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      service: this.name,
      message,
      ...metadata
    };

    // For console output, use readable format
    if (process.env.LOG_FORMAT === 'json') {
      return JSON.stringify(logEntry);
    }

    // Human readable format with metadata
    let formatted = `[${timestamp}] [${level}] [${this.name}] ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      const metaString = Object.entries(metadata)
        .map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}`)
        .join(' ');
      formatted += ` | ${metaString}`;
    }
    
    return formatted;
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.currentLevel];
  }

  error(message, metadata = {}) {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatMessage('ERROR', message, metadata));
    }
  }

  warn(message, metadata = {}) {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', message, metadata));
    }
  }

  info(message, metadata = {}) {
    if (this.shouldLog('INFO')) {
      console.log(this.formatMessage('INFO', message, metadata));
    }
  }

  debug(message, metadata = {}) {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatMessage('DEBUG', message, metadata));
    }
  }

  // Convenience methods for common patterns
  request(req, res, message = 'Request processed') {
    const metadata = {
      method: req.method,
      url: req.url,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      statusCode: res.statusCode,
      responseTime: res.get('X-Response-Time')
    };
    this.info(message, metadata);
  }

  performance(operation, startTime, metadata = {}) {
    const duration = Date.now() - startTime;
    this.info(`Performance: ${operation}`, {
      ...metadata,
      duration: `${duration}ms`,
      operation
    });
  }

  child(name) {
    return new Logger(`${this.name}:${name}`);
  }
}

// Create singleton instance
const logger = new Logger();

export { logger };
export default Logger;