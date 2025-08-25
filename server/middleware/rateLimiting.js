/**
 * Rate Limiting and Resource Management Middleware
 * Protects APIs from abuse and prevents resource exhaustion
 */

import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { logger } from '../lib/logger.js';

const rateLimitLogger = logger.child('rate-limit');

// General API rate limiting
export const apiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // general API rate limit
  message: {
    error: 'Too many requests from this IP',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // No specific paths skipped currently
    return false;
  },
  handler: (req, res) => {
    rateLimitLogger.warn('Rate limit exceeded', {
      event: 'rate_limit_exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      error: 'Too many requests from this IP',
      retryAfter: '15 minutes',
      current: req.rateLimit.current,
      limit: req.rateLimit.limit,
      remaining: req.rateLimit.remaining
    });
  }
});

// Strict rate limiting for sensitive endpoints
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 requests per windowMs
  message: {
    error: 'Too many requests to sensitive endpoint',
    retryAfter: '15 minutes'
  },
  handler: (req, res) => {
    rateLimitLogger.error('Strict rate limit exceeded', {
      event: 'strict_rate_limit_exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method
    });
    
    res.status(429).json({
      error: 'Too many requests to sensitive endpoint',
      retryAfter: '15 minutes'
    });
  }
});

// Claude CLI rate limiting (more restrictive)
export const claudeRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 Claude requests per minute
  message: {
    error: 'Too many Claude requests',
    retryAfter: '1 minute'
  },
  handler: (req, res) => {
    rateLimitLogger.warn('Claude rate limit exceeded', {
      event: 'claude_rate_limit_exceeded',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.body?.sessionId
    });
    
    res.status(429).json({
      error: 'Too many Claude requests, please wait before trying again',
      retryAfter: '1 minute',
      suggestion: 'Consider reducing request frequency'
    });
  }
});

// File operations rate limiting
export const fileRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // limit each IP to 50 file operations per 5 minutes
  message: {
    error: 'Too many file operations',
    retryAfter: '5 minutes'
  }
});

// Speed limiting (slow down responses under high load)
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per windowMs without delay
  delayMs: () => 500, // add 500ms of delay per request after delayAfter
  maxDelayMs: 5000, // max delay of 5 seconds
  validate: { delayMs: false } // disable deprecation warning
});

// Memory and resource monitoring middleware
export const resourceMonitor = (req, res, next) => {
  const startTime = Date.now();
  const startMemory = process.memoryUsage();

  // Monitor response completion
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const endMemory = process.memoryUsage();
    const memoryDiff = {
      rss: endMemory.rss - startMemory.rss,
      heapUsed: endMemory.heapUsed - startMemory.heapUsed,
      heapTotal: endMemory.heapTotal - startMemory.heapTotal
    };

    // Log slow requests
    if (duration > 5000) { // 5 seconds
      rateLimitLogger.warn('Slow request detected', {
        event: 'slow_request',
        path: req.path,
        method: req.method,
        duration: `${duration}ms`,
        memoryDiff,
        statusCode: res.statusCode
      });
    }

    // Log high memory usage (increased threshold to reduce noise)
    if (memoryDiff.heapUsed > 200 * 1024 * 1024) { // 200MB (was 50MB)
      rateLimitLogger.warn('High memory usage request', {
        event: 'high_memory_usage',
        path: req.path,
        method: req.method,
        memoryDiff,
        duration: `${duration}ms`
      });
    }
  });

  next();
};

// Process count limiter for Claude CLI spawning
export const processLimiter = (() => {
  const activeProcesses = new Map();
  const MAX_PROCESSES_PER_IP = 3;
  const MAX_TOTAL_PROCESSES = 20;

  return (req, res, next) => {
    const ip = req.ip;
    const userProcesses = activeProcesses.get(ip) || 0;
    const totalProcesses = Array.from(activeProcesses.values()).reduce((sum, count) => sum + count, 0);

    // Check per-IP limit
    if (userProcesses >= MAX_PROCESSES_PER_IP) {
      rateLimitLogger.warn('Process limit per IP exceeded', {
        event: 'process_limit_per_ip_exceeded',
        ip,
        currentProcesses: userProcesses,
        maxAllowed: MAX_PROCESSES_PER_IP
      });
      
      return res.status(429).json({
        error: 'Too many active processes for this IP',
        maxAllowed: MAX_PROCESSES_PER_IP,
        current: userProcesses
      });
    }

    // Check total system limit
    if (totalProcesses >= MAX_TOTAL_PROCESSES) {
      rateLimitLogger.error('System process limit exceeded', {
        event: 'system_process_limit_exceeded',
        totalProcesses,
        maxAllowed: MAX_TOTAL_PROCESSES,
        ip
      });
      
      return res.status(503).json({
        error: 'System is under high load, please try again later',
        suggestion: 'Reduce concurrent operations'
      });
    }

    // Add process tracking
    req.processLimiter = {
      increment: () => {
        activeProcesses.set(ip, (activeProcesses.get(ip) || 0) + 1);
        rateLimitLogger.debug('Process count incremented', {
          ip,
          processCount: activeProcesses.get(ip)
        });
      },
      decrement: () => {
        const current = activeProcesses.get(ip) || 0;
        if (current > 0) {
          activeProcesses.set(ip, current - 1);
          rateLimitLogger.debug('Process count decremented', {
            ip,
            processCount: activeProcesses.get(ip)
          });
        }
      }
    };

    next();
  };
})();

// Specific rate limiter for project analysis endpoint
export const projectAnalysisRateLimit = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes (reduced window)
  max: 15, // Increased to 15 analysis requests per 2 minutes
  message: {
    error: 'Project analysis rate limit exceeded. This endpoint is resource-intensive.',
    retryAfter: '2 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    rateLimitLogger.warn('Project analysis rate limit exceeded', {
      event: 'project_analysis_rate_limit_exceeded',
      ip: req.ip,
      path: req.path,
      projectPath: req.query.path
    });
    res.status(429).json({
      error: 'Project analysis rate limit exceeded. This endpoint is resource-intensive.',
      retryAfter: '2 minutes'
    });
  }
});

// Cleanup interval to prevent memory leaks
setInterval(() => {
  const memUsage = process.memoryUsage();
  if (memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
    rateLimitLogger.warn('High system memory usage detected', {
      event: 'high_system_memory',
      memoryUsage: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
      }
    });
  }
}, 60000); // Check every minute