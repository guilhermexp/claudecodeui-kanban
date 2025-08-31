import jwt from 'jsonwebtoken';
import { userDb } from '../database/db.js';
import crypto from 'crypto';

// Use the JWT secret from environment or config
// For development, we use a consistent secret from .env file
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-here-change-in-production';

// Warn if using default secret
if (JWT_SECRET === 'your-super-secret-jwt-key-here-change-in-production') {
  console.warn('⚠️ Using default JWT secret. Set JWT_SECRET environment variable for production!');
}

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
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Verify user still exists and is active
    const user = userDb.getUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'Invalid token. User not found.' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
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
    JWT_SECRET,
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
    const decoded = jwt.verify(token, JWT_SECRET);
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
  JWT_SECRET
};