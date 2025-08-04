/**
 * Simple logger utility for development and production
 * Provides consistent logging with environment awareness
 */

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  error: (message, error = null) => {
    if (isDevelopment) {
      console.error(`[ERROR] ${message}`, error);
    }
    // In production, you could send to error tracking service
  },
  
  warn: (message, data = null) => {
    if (isDevelopment) {
      console.warn(`[WARN] ${message}`, data);
    }
  },
  
  info: (message, data = null) => {
    if (isDevelopment) {
      console.info(`[INFO] ${message}`, data);
    }
  },
  
  debug: (message, data = null) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, data);
    }
  }
};

export default logger;