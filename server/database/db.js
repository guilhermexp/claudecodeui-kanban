// Load better-sqlite3 lazily to avoid native-ABI crashes in dev environments
let Database = null;
try {
  const mod = await import('better-sqlite3');
  Database = mod?.default || mod;
} catch (e) {
  console.warn('[DB] better-sqlite3 unavailable, falling back to in-memory auth store:', e?.message || e);
}
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = path.join(__dirname, 'auth.db');
const INIT_SQL_PATH = path.join(__dirname, 'init.sql');

// Create database connection with error handling
let db;
if (Database) {
  try {
    // Ensure database directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    // Database connected successfully
  } catch (error) {
    console.error('Failed to connect to SQLite database:', error);
    // Fallback to in-memory implementation instead of crashing
    Database = null;
  }
}

// Minimal in-memory DB fallback for auth if native module is unavailable
if (!Database || !db) {
  const mem = { users: [], nextId: 1 };
  db = {
    prepare(sql) {
      const text = String(sql).toLowerCase();
      return {
        run: (a, b) => {
          if (/insert\s+into\s+users/.test(text)) {
            const row = { id: mem.nextId++, username: a, password_hash: b, is_active: 1, created_at: new Date().toISOString(), last_login: null };
            mem.users.push(row);
            return { lastInsertRowid: row.id };
          }
          if (/update\s+users\s+set\s+last_login/.test(text)) {
            const id = a;
            const u = mem.users.find(u => u.id === id);
            if (u) u.last_login = new Date().toISOString();
            return { changes: u ? 1 : 0 };
          }
          if (/update\s+users\s+set\s+password_hash/.test(text)) {
            const passwordHash = a;
            const username = b;
            const u = mem.users.find(u => u.username === username && u.is_active === 1);
            if (u) u.password_hash = passwordHash;
            return { changes: u ? 1 : 0 };
          }
          return { changes: 0 };
        },
        get: (a) => {
          if (/select\s+count\(\*\)/.test(text)) {
            return { count: mem.users.filter(u => u.is_active === 1).length };
          }
          if (/from\s+users\s+where\s+username/.test(text)) {
            const u = mem.users.find(u => u.username === a && u.is_active === 1);
            return u || undefined;
          }
          if (/from\s+users\s+where\s+id/.test(text)) {
            const u = mem.users.find(u => u.id === a && u.is_active === 1);
            if (!u) return undefined;
            const { id, username, created_at, last_login } = u;
            return { id, username, created_at, last_login };
          }
          return undefined;
        }
      };
    },
    exec() { /* no-op for fallback */ }
  };
}

// Initialize database with schema
const initializeDatabase = async () => {
  try {
    if (Database) {
      const initSQL = fs.readFileSync(INIT_SQL_PATH, 'utf8');
      db.exec(initSQL);
    }
    // Return the active DB connection for callers expecting it
    return db;
  } catch (error) {
    console.error('Error initializing database:', error.message);
    // Do not crash in fallback mode
    return db;
  }
};

// User database operations
const userDb = {
  // Check if any users exist
  hasUsers: () => {
    try {
      const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
      return row && row.count > 0;
    } catch (err) {
      console.error('Error checking if users exist:', err);
      // Return false as default if we can't check
      return false;
    }
  },

  // Create a new user
  createUser: (username, passwordHash) => {
    try {
      const stmt = db.prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
      const result = stmt.run(username, passwordHash);
      return { id: result.lastInsertRowid, username };
    } catch (err) {
      throw err;
    }
  },

  // Get user by username
  getUserByUsername: (username) => {
    try {
      const row = db.prepare('SELECT * FROM users WHERE username = ? AND is_active = 1').get(username);
      return row;
    } catch (err) {
      throw err;
    }
  },

  // Update last login time
  updateLastLogin: (userId) => {
    try {
      db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    } catch (err) {
      throw err;
    }
  },

  // Get user by ID
  getUserById: (userId) => {
    try {
      const row = db.prepare('SELECT id, username, created_at, last_login FROM users WHERE id = ? AND is_active = 1').get(userId);
      return row;
    } catch (err) {
      throw err;
    }
  },

  updatePassword: (username, passwordHash) => {
    try {
      const stmt = db.prepare('UPDATE users SET password_hash = ? WHERE username = ? AND is_active = 1');
      const result = stmt.run(passwordHash, username);
      return result?.changes > 0;
    } catch (err) {
      throw err;
    }
  }
};

export {
  db,
  initializeDatabase,
  userDb
};
