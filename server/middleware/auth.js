import jwt from 'jsonwebtoken';
import { userDb } from '../database/db.js';
import crypto from 'crypto';

// Lazy initialization of JWT_SECRET to allow environment to be loaded first
let JWT_SECRET = null;
let jwtInitialized = false;

const initializeJWT = () => {
  if (jwtInitialized) return JWT_SECRET;
  
  JWT_SECRET = process.env.JWT_SECRET;
  
  // CRITICAL: JWT_SECRET is mandatory
  if (!JWT_SECRET) {
    console.error('🚨 CRITICAL: JWT_SECRET environment variable is required!');
    console.error('   Set JWT_SECRET in your .env file or environment');
    console.error('   Example: JWT_SECRET=your-super-secure-secret-here');
    process.exit(1);
  }
  
  // Warn if JWT secret is too short (less than 32 characters)
  if (JWT_SECRET.length < 32) {
    console.warn('⚠️ WARNING: JWT_SECRET should be at least 32 characters long for security!');
  }
  
  jwtInitialized = true;
  return JWT_SECRET;
};

const getJWTSecret = () => {
  return initializeJWT();
};

// Optional API key middleware
const validateApiKey = (req, res, next) => {
  // Skip API key validation if not configured
  if (!process.env.API_KEY) {
    return next();
  }
  
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
};

// JWT authentication middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, getJWTSecret());
    
    // Verify user still exists and is active
    const user = userDb.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    // Check if token is expired
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    // Log only non-expired token errors
    if (error.name !== 'TokenExpiredError') {
      console.error('Token verification error:', error);
    }
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Generate JWT token with 24-hour expiration
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id, 
      username: user.username
    },
    getJWTSecret(),
    {
      expiresIn: '24h'
    }
  );
};

// WebSocket authentication function
const authenticateWebSocket = (token) => {
  if (!token) {
    return null;
  }
  
  try {
    const decoded = jwt.verify(token, getJWTSecret());
    return decoded;
  } catch (error) {
    console.error('WebSocket token verification error:', error);
    return null;
  }
};

export {
  validateApiKey,
  authenticateToken,
  generateToken,
  authenticateWebSocket,
  getJWTSecret
};
