/**
 * Request validation middleware
 */

const { ValidationError } = require('../lib/errors');
const logger = require('../lib/logger').child('validation');

/**
 * Validate request body against schema
 */
function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];
    
    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];
      
      // Check required fields
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }
      
      // Skip validation if field is optional and not provided
      if (!rules.required && (value === undefined || value === null)) {
        continue;
      }
      
      // Type validation
      if (rules.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== rules.type) {
          errors.push(`${field} must be of type ${rules.type}`);
          continue;
        }
      }
      
      // String validations
      if (rules.type === 'string') {
        if (rules.minLength && value.length < rules.minLength) {
          errors.push(`${field} must be at least ${rules.minLength} characters`);
        }
        if (rules.maxLength && value.length > rules.maxLength) {
          errors.push(`${field} must not exceed ${rules.maxLength} characters`);
        }
        if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`${field} has invalid format`);
        }
      }
      
      // Number validations
      if (rules.type === 'number') {
        if (rules.min !== undefined && value < rules.min) {
          errors.push(`${field} must be at least ${rules.min}`);
        }
        if (rules.max !== undefined && value > rules.max) {
          errors.push(`${field} must not exceed ${rules.max}`);
        }
      }
      
      // Array validations
      if (rules.type === 'array') {
        if (rules.minItems && value.length < rules.minItems) {
          errors.push(`${field} must contain at least ${rules.minItems} items`);
        }
        if (rules.maxItems && value.length > rules.maxItems) {
          errors.push(`${field} must not exceed ${rules.maxItems} items`);
        }
      }
      
      // Custom validation
      if (rules.validate) {
        const customError = rules.validate(value, req.body);
        if (customError) {
          errors.push(customError);
        }
      }
    }
    
    if (errors.length > 0) {
      logger.warn('Validation failed', { errors, body: req.body });
      throw new ValidationError('Validation failed', errors);
    }
    
    next();
  };
}

/**
 * Validate query parameters
 */
function validateQuery(schema) {
  return (req, res, next) => {
    const errors = [];
    
    for (const [param, rules] of Object.entries(schema)) {
      const value = req.query[param];
      
      // Convert to appropriate type
      let parsedValue = value;
      if (value !== undefined && rules.type === 'number') {
        parsedValue = Number(value);
        if (isNaN(parsedValue)) {
          errors.push(`${param} must be a valid number`);
          continue;
        }
        req.query[param] = parsedValue;
      } else if (value !== undefined && rules.type === 'boolean') {
        parsedValue = value === 'true' || value === '1';
        req.query[param] = parsedValue;
      }
      
      // Apply same validation logic as body
      if (rules.required && !value) {
        errors.push(`${param} is required`);
      }
    }
    
    if (errors.length > 0) {
      logger.warn('Query validation failed', { errors, query: req.query });
      throw new ValidationError('Query validation failed', errors);
    }
    
    next();
  };
}

/**
 * Sanitize input to prevent XSS and injection attacks
 */
function sanitizeInput() {
  return (req, res, next) => {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    
    // Sanitize query
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    
    // Sanitize params
    if (req.params && typeof req.params === 'object') {
      req.params = sanitizeObject(req.params);
    }
    
    next();
  };
}

function sanitizeObject(obj) {
  const sanitized = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      // Remove dangerous characters and scripts
      sanitized[key] = value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/[<>]/g, '')
        .trim();
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = Array.isArray(value) 
        ? value.map(item => typeof item === 'object' ? sanitizeObject(item) : item)
        : sanitizeObject(value);
    } else {
      sanitized[key] = value;
    }
  }
  
  return sanitized;
}

module.exports = {
  validateBody,
  validateQuery,
  sanitizeInput
};