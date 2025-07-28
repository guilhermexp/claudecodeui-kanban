/**
 * Vibe Kanban Proxy with Advanced Features
 * - Retry logic with exponential backoff
 * - Configurable timeouts
 * - Connection pooling
 * - Health checks
 * - Circuit breaker pattern
 */

const http = require('http');
const https = require('https');
const logger = require('./logger').child('vibe-proxy');
const { ServiceUnavailableError, GatewayTimeoutError, AppError } = require('./errors');
const { caches } = require('./cache');

class VibeKanbanProxy {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || 'http://localhost:8081';
    this.timeout = options.timeout || 30000; // 30 seconds default
    this.retries = options.retries || 3;
    this.retryDelay = options.retryDelay || 1000; // 1 second initial delay
    this.healthCheckInterval = options.healthCheckInterval || 30000; // 30 seconds
    
    // Circuit breaker settings
    this.circuitBreakerThreshold = options.circuitBreakerThreshold || 5;
    this.circuitBreakerTimeout = options.circuitBreakerTimeout || 60000; // 1 minute
    this.failureCount = 0;
    this.circuitOpen = false;
    this.circuitOpenedAt = null;
    
    // Connection pooling
    this.agent = new http.Agent({
      keepAlive: true,
      keepAliveMsecs: 1000,
      maxSockets: 10,
      maxFreeSockets: 5,
      timeout: this.timeout
    });
    
    // Start health checks
    this.startHealthChecks();
  }
  
  async makeRequest(path, options = {}) {
    // Check cache for GET requests
    if (options.method === 'GET' || !options.method) {
      const cacheKey = `vibe:${path}`;
      const cached = caches.vibe.get(cacheKey);
      if (cached) {
        logger.debug('Cache hit for request', { path });
        return cached;
      }
    }
    // Check circuit breaker
    if (this.circuitOpen) {
      if (Date.now() - this.circuitOpenedAt > this.circuitBreakerTimeout) {
        // Try to close circuit
        this.circuitOpen = false;
        this.failureCount = 0;
        logger.info('Circuit breaker: Attempting to close circuit');
      } else {
        throw new ServiceUnavailableError('Vibe Kanban', { reason: 'Circuit breaker is open' });
      }
    }
    
    const url = `${this.baseUrl}/api${path}`;
    let lastError;
    
    for (let attempt = 0; attempt < this.retries; attempt++) {
      try {
        const response = await this.executeRequest(url, options);
        
        // Reset failure count on success
        this.failureCount = 0;
        
        // Cache successful GET responses
        if (options.method === 'GET' || !options.method) {
          const cacheKey = `vibe:${path}`;
          caches.vibe.set(cacheKey, response);
        }
        
        return response;
      } catch (error) {
        lastError = error;
        
        // Don't retry on client errors (4xx)
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
          throw error;
        }
        
        // Increment failure count
        this.failureCount++;
        
        // Check if circuit should be opened
        if (this.failureCount >= this.circuitBreakerThreshold) {
          this.circuitOpen = true;
          this.circuitOpenedAt = Date.now();
          logger.warn('Circuit breaker: Opening circuit due to repeated failures');
          throw new ServiceUnavailableError('Vibe Kanban', { 
            reason: 'Circuit breaker opened',
            failureCount: this.failureCount,
            threshold: this.circuitBreakerThreshold
          });
        }
        
        // Calculate delay with exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt);
        
        logger.debug(`Request failed (attempt ${attempt + 1}/${this.retries}), retrying in ${delay}ms...`, { error: error.message });
        
        if (attempt < this.retries - 1) {
          await this.sleep(delay);
        }
      }
    }
    
    throw lastError || new ServiceUnavailableError('Vibe Kanban', { 
      reason: 'Failed after retries',
      attempts: this.retries
    });
  }
  
  executeRequest(url, options) {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => {
        controller.abort();
        reject(new GatewayTimeoutError('Vibe Kanban'));
      }, this.timeout);
      
      const fetchOptions = {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...options.headers
        },
        agent: this.agent,
        signal: controller.signal
      };
      
      if (options.body) {
        fetchOptions.body = typeof options.body === 'string' 
          ? options.body 
          : JSON.stringify(options.body);
      }
      
      fetch(url, fetchOptions)
        .then(async response => {
          clearTimeout(timeout);
          
          const contentType = response.headers.get('content-type');
          let data;
          
          if (contentType && contentType.includes('application/json')) {
            data = await response.json();
          } else {
            data = await response.text();
          }
          
          if (!response.ok) {
            const error = new Error(`HTTP ${response.status}: ${response.statusText}`);
            error.statusCode = response.status;
            error.data = data;
            throw error;
          }
          
          resolve({
            status: response.status,
            headers: response.headers,
            data
          });
        })
        .catch(error => {
          clearTimeout(timeout);
          
          if (error.name === 'AbortError') {
            reject(new GatewayTimeoutError('Vibe Kanban'));
          } else if (error.code === 'ECONNREFUSED') {
            reject(new ServiceUnavailableError('Vibe Kanban', { reason: 'Service not running' }));
          } else {
            reject(error);
          }
        });
    });
  }
  
  async healthCheck() {
    try {
      const response = await this.executeRequest(`${this.baseUrl}/health`, {
        method: 'GET'
      });
      
      return {
        healthy: response.status === 200,
        status: response.status,
        data: response.data
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message
      };
    }
  }
  
  startHealthChecks() {
    // Initial health check
    this.healthCheck().then(result => {
      logger.info('Health check:', result.healthy ? 'Healthy' : 'Unhealthy', result);
    });
    
    // Periodic health checks
    this.healthCheckTimer = setInterval(async () => {
      const result = await this.healthCheck();
      
      if (!result.healthy && !this.circuitOpen) {
        logger.warn('Health check failed:', result.error);
      } else if (result.healthy && this.circuitOpen) {
        // Service recovered, close circuit
        this.circuitOpen = false;
        this.failureCount = 0;
        logger.info('Service recovered, closing circuit breaker');
      }
    }, this.healthCheckInterval);
  }
  
  stopHealthChecks() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
  
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  destroy() {
    this.stopHealthChecks();
    this.agent.destroy();
  }
}

module.exports = VibeKanbanProxy;