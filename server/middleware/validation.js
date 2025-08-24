/**
 * Input Validation Schemas
 * Comprehensive validation using Joi for all API endpoints
 */

import Joi from 'joi';
import Logger from '../lib/logger.js';

const logger = new Logger('ValidationMiddleware');

// Base schemas for common data types
const schemas = {
  // Authentication schemas
  auth: {
    login: Joi.object({
      username: Joi.string().alphanum().min(3).max(30).required(),
      password: Joi.string().min(6).max(128).required()
    }),
    register: Joi.object({
      username: Joi.string().alphanum().min(3).max(30).required(),
      password: Joi.string().min(6).max(128).required(),
      email: Joi.string().email().optional()
    })
  },

  // Project schemas
  project: {
    create: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      path: Joi.string().min(1).max(500).required(),
      description: Joi.string().max(1000).optional()
    }),
    update: Joi.object({
      name: Joi.string().min(1).max(100).optional(),
      description: Joi.string().max(1000).optional(),
      settings: Joi.object().optional()
    })
  },

  // Claude CLI schemas
  claude: {
    execute: Joi.object({
      command: Joi.string().min(1).max(10000).required(),
      projectId: Joi.string().uuid().optional(),
      options: Joi.object({
        timeout: Joi.number().integer().min(1000).max(300000).optional(),
        model: Joi.string().valid(
          'claude-3-5-sonnet-20241022',
          'claude-3-sonnet-20240229',
          'claude-3-haiku-20240307'
        ).optional()
      }).optional()
    }),
    chat: Joi.object({
      message: Joi.string().min(1).max(50000).required(),
      sessionId: Joi.string().uuid().optional(),
      context: Joi.object().optional()
    })
  },

  // Git operation schemas
  git: {
    commit: Joi.object({
      message: Joi.string().min(1).max(1000).required(),
      files: Joi.array().items(Joi.string()).optional()
    }),
    branch: Joi.object({
      name: Joi.string().min(1).max(100).required(),
      fromBranch: Joi.string().max(100).optional()
    }),
    merge: Joi.object({
      sourceBranch: Joi.string().min(1).max(100).required(),
      targetBranch: Joi.string().min(1).max(100).required()
    })
  },

  // File operation schemas
  file: {
    create: Joi.object({
      path: Joi.string().min(1).max(1000).required(),
      content: Joi.string().max(1000000).optional(), // 1MB limit
      type: Joi.string().valid('file', 'directory').default('file')
    }),
    update: Joi.object({
      content: Joi.string().max(1000000).required()
    }),
    move: Joi.object({
      newPath: Joi.string().min(1).max(1000).required()
    })
  },

  // Task management schemas
  task: {
    create: Joi.object({
      title: Joi.string().min(1).max(200).required(),
      description: Joi.string().max(2000).optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
      status: Joi.string().valid('todo', 'in_progress', 'done', 'blocked').default('todo'),
      projectId: Joi.string().uuid().optional(),
      assignee: Joi.string().max(100).optional(),
      dueDate: Joi.date().optional()
    }),
    update: Joi.object({
      title: Joi.string().min(1).max(200).optional(),
      description: Joi.string().max(2000).optional(),
      priority: Joi.string().valid('low', 'medium', 'high', 'urgent').optional(),
      status: Joi.string().valid('todo', 'in_progress', 'done', 'blocked').optional(),
      assignee: Joi.string().max(100).optional(),
      dueDate: Joi.date().optional()
    })
  },

  // Analytics schemas
  analytics: {
    usage: Joi.object({
      startDate: Joi.date().required(),
      endDate: Joi.date().min(Joi.ref('startDate')).required(),
      projectId: Joi.string().uuid().optional(),
      groupBy: Joi.string().valid('day', 'week', 'month').default('day')
    })
  },

  // Common query parameters
  query: {
    pagination: Joi.object({
      page: Joi.number().integer().min(1).default(1),
      limit: Joi.number().integer().min(1).max(100).default(20),
      sortBy: Joi.string().max(50).optional(),
      sortOrder: Joi.string().valid('asc', 'desc').default('asc')
    }),
    search: Joi.object({
      q: Joi.string().min(1).max(200).optional(),
      filter: Joi.object().optional()
    })
  }
};

/**
 * Create validation middleware for specific schema
 * @param {Object} schema - Joi schema to validate against
 * @param {string} source - Source of data ('body', 'query', 'params')
 * @returns {Function} Express middleware function
 */
export function validateSchema(schema, source = 'body') {
  return (req, res, next) => {
    const data = req[source];
    const { error, value } = schema.validate(data, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const validationErrors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      logger.warn('Validation failed', {
        source,
        errors: validationErrors,
        originalData: data,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors,
        timestamp: new Date().toISOString()
      });
    }

    // Replace original data with validated and sanitized data
    req[source] = value;

    logger.debug('Validation passed', {
      source,
      endpoint: req.originalUrl,
      method: req.method,
      validatedFields: Object.keys(value)
    });

    next();
  };
}

/**
 * Validate request body against schema
 * @param {Object} schema - Joi schema
 * @returns {Function} Express middleware
 */
export const validateBody = (schema) => validateSchema(schema, 'body');

/**
 * Validate query parameters against schema
 * @param {Object} schema - Joi schema
 * @returns {Function} Express middleware
 */
export const validateQuery = (schema) => validateSchema(schema, 'query');

/**
 * Validate route parameters against schema
 * @param {Object} schema - Joi schema
 * @returns {Function} Express middleware
 */
export const validateParams = (schema) => validateSchema(schema, 'params');

/**
 * Combined validation for multiple sources
 * @param {Object} options - Validation options
 * @param {Object} options.body - Body schema
 * @param {Object} options.query - Query schema
 * @param {Object} options.params - Params schema
 * @returns {Function} Express middleware
 */
export function validateRequest({ body, query, params }) {
  return (req, res, next) => {
    const validations = [];
    
    if (body) validations.push({ schema: body, source: 'body' });
    if (query) validations.push({ schema: query, source: 'query' });
    if (params) validations.push({ schema: params, source: 'params' });

    const errors = [];

    for (const { schema, source } of validations) {
      const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        const validationErrors = error.details.map(detail => ({
          field: `${source}.${detail.path.join('.')}`,
          message: detail.message,
          value: detail.context.value
        }));
        errors.push(...validationErrors);
      } else {
        req[source] = value;
      }
    }

    if (errors.length > 0) {
      logger.warn('Multi-source validation failed', {
        errors,
        endpoint: req.originalUrl,
        method: req.method,
        ip: req.ip
      });

      return res.status(400).json({
        error: 'Validation failed',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    logger.debug('Multi-source validation passed', {
      endpoint: req.originalUrl,
      method: req.method,
      sources: validations.map(v => v.source)
    });

    next();
  };
}

/**
 * Sanitize input to prevent XSS and injection attacks
 */
export function sanitizeInput() {
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

// Export schemas for use in routes
export { schemas };

export default {
  validateSchema,
  validateBody,
  validateQuery,
  validateParams,
  validateRequest,
  sanitizeInput,
  schemas
};