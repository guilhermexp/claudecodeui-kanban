import express from 'express';
import fs from 'fs';
import path from 'path';
import { authenticateToken } from '../middleware/auth.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('PROMPTS');
const router = express.Router();

// Database file path for prompts
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const DB_DIR = path.join(ROOT, 'database', 'prompts');
const DB_FILE = path.join(DB_DIR, 'prompts.json');

// Ensure directory exists
function ensureDir(p) { 
  fs.mkdirSync(p, { recursive: true }); 
}

// Read prompts from file
function readPrompts() {
  try {
    ensureDir(DB_DIR);
    if (!fs.existsSync(DB_FILE)) {
      // Initialize with default data
      const defaultData = {
        version: 1,
        updatedAt: Date.now(),
        prompts: [],
        snippets: [],
        env: []
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const data = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    log.error('Failed to read prompts:', error);
    return { prompts: [], snippets: [], env: [] };
  }
}

// Write prompts to file
function writePrompts(data) {
  try {
    ensureDir(DB_DIR);
    const updated = {
      ...data,
      version: 1,
      updatedAt: Date.now()
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(updated, null, 2));
    return true;
  } catch (error) {
    log.error('Failed to write prompts:', error);
    return false;
  }
}

// GET /api/prompts - Get all prompts
router.get('/', authenticateToken, (req, res) => {
  try {
    const data = readPrompts();
    res.json(data);
  } catch (error) {
    log.error('GET /prompts error:', error);
    res.status(500).json({ error: 'Failed to load prompts' });
  }
});

// POST /api/prompts - Save/update all prompts
router.post('/', authenticateToken, (req, res) => {
  try {
    const { prompts = [], snippets = [], env = [] } = req.body || {};
    
    // Validate data structure
    if (!Array.isArray(prompts) || !Array.isArray(snippets) || !Array.isArray(env)) {
      return res.status(400).json({ error: 'Invalid data format' });
    }
    
    const data = {
      prompts,
      snippets,
      env
    };
    
    if (writePrompts(data)) {
      res.json({ success: true, data });
    } else {
      res.status(500).json({ error: 'Failed to save prompts' });
    }
  } catch (error) {
    log.error('POST /prompts error:', error);
    res.status(500).json({ error: 'Failed to save prompts' });
  }
});

// POST /api/prompts/prompt - Add a single prompt
router.post('/prompt', authenticateToken, (req, res) => {
  try {
    const prompt = req.body;
    if (!prompt || !prompt.title || !prompt.template) {
      return res.status(400).json({ error: 'Invalid prompt data' });
    }
    
    const data = readPrompts();
    
    // Generate ID if not provided
    if (!prompt.id) {
      prompt.id = `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    }
    
    // Check if prompt exists and update, otherwise add
    const existingIndex = data.prompts.findIndex(p => p.id === prompt.id);
    if (existingIndex >= 0) {
      data.prompts[existingIndex] = prompt;
    } else {
      data.prompts.push(prompt);
    }
    
    if (writePrompts(data)) {
      res.json({ success: true, prompt });
    } else {
      res.status(500).json({ error: 'Failed to save prompt' });
    }
  } catch (error) {
    log.error('POST /prompts/prompt error:', error);
    res.status(500).json({ error: 'Failed to save prompt' });
  }
});

// DELETE /api/prompts/prompt/:id - Delete a prompt
router.delete('/prompt/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const data = readPrompts();
    
    data.prompts = data.prompts.filter(p => p.id !== id);
    
    if (writePrompts(data)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete prompt' });
    }
  } catch (error) {
    log.error('DELETE /prompts/prompt error:', error);
    res.status(500).json({ error: 'Failed to delete prompt' });
  }
});

// POST /api/prompts/snippet - Add a single snippet
router.post('/snippet', authenticateToken, (req, res) => {
  try {
    const snippet = req.body;
    if (!snippet || !snippet.title || !snippet.code) {
      return res.status(400).json({ error: 'Invalid snippet data' });
    }
    
    const data = readPrompts();
    
    // Generate ID if not provided
    if (!snippet.id) {
      snippet.id = `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    }
    
    // Check if snippet exists and update, otherwise add
    const existingIndex = data.snippets.findIndex(s => s.id === snippet.id);
    if (existingIndex >= 0) {
      data.snippets[existingIndex] = snippet;
    } else {
      data.snippets.push(snippet);
    }
    
    if (writePrompts(data)) {
      res.json({ success: true, snippet });
    } else {
      res.status(500).json({ error: 'Failed to save snippet' });
    }
  } catch (error) {
    log.error('POST /prompts/snippet error:', error);
    res.status(500).json({ error: 'Failed to save snippet' });
  }
});

// DELETE /api/prompts/snippet/:id - Delete a snippet
router.delete('/snippet/:id', authenticateToken, (req, res) => {
  try {
    const { id } = req.params;
    const data = readPrompts();
    
    data.snippets = data.snippets.filter(s => s.id !== id);
    
    if (writePrompts(data)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: 'Failed to delete snippet' });
    }
  } catch (error) {
    log.error('DELETE /prompts/snippet error:', error);
    res.status(500).json({ error: 'Failed to delete snippet' });
  }
});

// POST /api/prompts/env - Update environment variables
router.post('/env', authenticateToken, (req, res) => {
  try {
    const { env } = req.body;
    if (!Array.isArray(env)) {
      return res.status(400).json({ error: 'Invalid env data' });
    }
    
    const data = readPrompts();
    data.env = env;
    
    if (writePrompts(data)) {
      res.json({ success: true, env });
    } else {
      res.status(500).json({ error: 'Failed to save env' });
    }
  } catch (error) {
    log.error('POST /prompts/env error:', error);
    res.status(500).json({ error: 'Failed to save env' });
  }
});

// POST /api/prompts/sync - Sync prompts from client
router.post('/sync', authenticateToken, (req, res) => {
  try {
    const clientData = req.body;
    const serverData = readPrompts();
    
    // Simple merge strategy: combine both, deduplicate by ID
    const mergedPrompts = mergeByKey(serverData.prompts, clientData.prompts || [], 'id');
    const mergedSnippets = mergeByKey(serverData.snippets, clientData.snippets || [], 'id');
    const mergedEnv = mergeByKey(serverData.env, clientData.env || [], 'key');
    
    const merged = {
      prompts: mergedPrompts,
      snippets: mergedSnippets,
      env: mergedEnv
    };
    
    if (writePrompts(merged)) {
      res.json({ success: true, data: merged });
    } else {
      res.status(500).json({ error: 'Failed to sync prompts' });
    }
  } catch (error) {
    log.error('POST /prompts/sync error:', error);
    res.status(500).json({ error: 'Failed to sync prompts' });
  }
});

// Helper function to merge arrays by key
function mergeByKey(serverArray, clientArray, keyField) {
  const map = new Map();
  
  // Add server items
  serverArray.forEach(item => {
    const key = item[keyField];
    if (key) map.set(key, item);
  });
  
  // Add/update with client items (client takes precedence)
  clientArray.forEach(item => {
    const key = item[keyField];
    if (key) {
      const existing = map.get(key);
      if (existing) {
        // Merge based on updatedAt if available
        if (item.updatedAt && existing.updatedAt) {
          if (item.updatedAt > existing.updatedAt) {
            map.set(key, item);
          }
        } else {
          // Client takes precedence if no timestamp
          map.set(key, item);
        }
      } else {
        map.set(key, item);
      }
    }
  });
  
  return Array.from(map.values());
}

export default router;