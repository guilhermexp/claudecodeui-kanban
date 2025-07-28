/**
 * Simple in-memory cache with TTL support
 */

const logger = require('./logger').child('cache');

class Cache {
  constructor(options = {}) {
    this.store = new Map();
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
    this.maxSize = options.maxSize || 1000;
    this.checkInterval = options.checkInterval || 60000; // 1 minute
    
    // Start cleanup interval
    this.cleanupTimer = setInterval(() => this.cleanup(), this.checkInterval);
  }
  
  set(key, value, ttl = this.defaultTTL) {
    // Check size limit
    if (this.store.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.store.keys().next().value;
      this.store.delete(firstKey);
      logger.debug('Cache size limit reached, removed oldest entry', { key: firstKey });
    }
    
    const expiresAt = Date.now() + ttl;
    this.store.set(key, {
      value,
      expiresAt,
      hits: 0
    });
    
    logger.debug('Cache set', { key, ttl, expiresAt: new Date(expiresAt).toISOString() });
  }
  
  get(key) {
    const entry = this.store.get(key);
    
    if (!entry) {
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      logger.debug('Cache expired', { key });
      return null;
    }
    
    entry.hits++;
    logger.debug('Cache hit', { key, hits: entry.hits });
    return entry.value;
  }
  
  has(key) {
    return this.get(key) !== null;
  }
  
  delete(key) {
    const deleted = this.store.delete(key);
    if (deleted) {
      logger.debug('Cache deleted', { key });
    }
    return deleted;
  }
  
  clear() {
    const size = this.store.size;
    this.store.clear();
    logger.info('Cache cleared', { entries: size });
  }
  
  cleanup() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.debug('Cache cleanup completed', { removed: cleaned, remaining: this.store.size });
    }
  }
  
  stats() {
    const entries = Array.from(this.store.entries());
    const totalHits = entries.reduce((sum, [, entry]) => sum + entry.hits, 0);
    
    return {
      size: this.store.size,
      maxSize: this.maxSize,
      totalHits,
      averageHits: this.store.size > 0 ? totalHits / this.store.size : 0,
      entries: entries.map(([key, entry]) => ({
        key,
        hits: entry.hits,
        expiresAt: new Date(entry.expiresAt).toISOString()
      }))
    };
  }
  
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    this.clear();
  }
}

// Create singleton instances for different cache types
const caches = {
  api: new Cache({ defaultTTL: 60000 }), // 1 minute for API responses
  projects: new Cache({ defaultTTL: 300000 }), // 5 minutes for project data
  git: new Cache({ defaultTTL: 30000 }), // 30 seconds for git status
  vibe: new Cache({ defaultTTL: 120000 }) // 2 minutes for Vibe Kanban data
};

// Cleanup on process exit
process.on('SIGINT', () => {
  Object.values(caches).forEach(cache => cache.destroy());
});

process.on('SIGTERM', () => {
  Object.values(caches).forEach(cache => cache.destroy());
});

module.exports = { Cache, caches };