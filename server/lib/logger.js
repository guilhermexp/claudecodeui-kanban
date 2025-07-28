/**
 * Centralized logging system with levels and formatting
 */

const util = require('util');

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

  formatMessage(level, message, ...args) {
    const timestamp = new Date().toISOString();
    const formattedArgs = args.map(arg => 
      typeof arg === 'object' ? util.inspect(arg, { depth: 3, colors: true }) : arg
    ).join(' ');
    
    return `[${timestamp}] [${level}] [${this.name}] ${message} ${formattedArgs}`;
  }

  shouldLog(level) {
    return this.levels[level] <= this.levels[this.currentLevel];
  }

  error(message, ...args) {
    if (this.shouldLog('ERROR')) {
      console.error(this.formatMessage('ERROR', message, ...args));
    }
  }

  warn(message, ...args) {
    if (this.shouldLog('WARN')) {
      console.warn(this.formatMessage('WARN', message, ...args));
    }
  }

  info(message, ...args) {
    if (this.shouldLog('INFO')) {
      console.log(this.formatMessage('INFO', message, ...args));
    }
  }

  debug(message, ...args) {
    if (this.shouldLog('DEBUG')) {
      console.log(this.formatMessage('DEBUG', message, ...args));
    }
  }

  child(name) {
    return new Logger(`${this.name}:${name}`);
  }
}

// Create singleton instance
const logger = new Logger();

module.exports = logger;