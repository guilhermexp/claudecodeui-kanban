// Load environment variables from .env file
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for file uploads
const upload = multer({
  dest: path.join(os.tmpdir(), 'claude-code-uploads'),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 100 // Max 100 files at once
  }
});

try {
  const envPath = path.join(__dirname, '../.env');
  const envFile = fs.readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    if (trimmedLine && !trimmedLine.startsWith('#')) {
      const [key, ...valueParts] = trimmedLine.split('=');
      if (key && valueParts.length > 0 && !process.env[key]) {
        process.env[key] = valueParts.join('=').trim();
      }
    }
  });
} catch (e) {
  // .env file is optional
}


import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { promises as fsPromises } from 'fs';
import os from 'os';
import pty from 'node-pty';
import fetch from 'node-fetch';
import mime from 'mime-types';
import v8 from 'v8';

import { getProjects, getSessions, getSessionMessages, renameProject, deleteSession, deleteProject, deleteProjectCompletely, addProjectManually, extractProjectDirectory, clearProjectDirectoryCache } from './projects.js';
import { spawnClaude, abortClaudeSession } from './claude-cli.js';
import { spawnCodex } from './codex-cli.js';
import gitRoutes from './routes/git.js';
import authRoutes from './routes/auth.js';
// import mcpRoutes from './routes/mcp.js'; // MCP removed - managed directly by Claude CLI
import usageRoutes from './routes/usage.js';
import systemRoutes from './routes/system.js';
import filesRoutes from './routes/files.js';
import claudeHooksRoutes from './routes/claude-hooks.js';
import claudeStreamRoutes from './routes/claude-stream.js';
import { initializeDatabase } from './database/db.js';
import { validateApiKey, authenticateToken, authenticateWebSocket } from './middleware/auth.js';
import cleanupService from './cleanupService.js';
import { 
  apiRateLimit, 
  strictRateLimit, 
  claudeRateLimit, 
  fileRateLimit, 
  speedLimiter, 
  resourceMonitor, 
  processLimiter,
  projectAnalysisRateLimit 
} from './middleware/rateLimiting.js';

// File system watcher for projects folder
let projectsWatcher = null;
// Simple in-memory caches
const projectAnalysisCache = new Map(); // key: projectDir, value: { data, ts }
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour


// System-level settings: Codex auth mode override (module-scope)
let serverCodexAuthMode = null; // 'subscription' | 'api' | null (fallback to env)
const systemSettingsPath = path.join(__dirname, 'database', 'system-settings.json');

function loadSystemSettings() {
  try {
    const raw = fs.readFileSync(systemSettingsPath, 'utf8');
    const data = JSON.parse(raw);
    if (data && (data.codexAuthMode === 'subscription' || data.codexAuthMode === 'api')) {
      serverCodexAuthMode = data.codexAuthMode;
    }
  } catch {}
}

function saveSystemSettings() {
  try {
    const current = fs.existsSync(systemSettingsPath)
      ? JSON.parse(fs.readFileSync(systemSettingsPath, 'utf8'))
      : {};
    const next = { ...current, codexAuthMode: serverCodexAuthMode };
    fs.mkdirSync(path.dirname(systemSettingsPath), { recursive: true });
    fs.writeFileSync(systemSettingsPath, JSON.stringify(next, null, 2));
    return true;
  } catch (e) {
    console.error('Failed to save system settings:', e.message);
    return false;
  }
}

// Load persisted settings at startup
loadSystemSettings();


// System-level settings: Codex auth mode override (moved earlier for scope)

function getCached(map, key) {
  const item = map.get(key);
  if (!item) return null;
  if (Date.now() - item.ts > CACHE_TTL_MS) {
    map.delete(key);
    return null;
  }
  return item.data;
}

function setCached(map, key, data) {
  map.set(key, { data, ts: Date.now() });
}
// Enhanced client tracking with user context for session isolation
const connectedClients = new Map(); // ws -> { userId, username, activeProject, lastActivity }

// Smart broadcast functions for session isolation
const broadcastProjectUpdate = (message, eventType, filePath) => {
  const messageObj = JSON.parse(message);
  
  connectedClients.forEach((context, ws) => {
    if (ws.readyState !== ws.OPEN) return;
    
    // Always send initial project list updates
    if (eventType === 'initial') {
      ws.send(message);
      return;
    }
    
    // For file changes, check if user is actively using related project
    const isRecentlyActive = context.lastActivity && 
                           (Date.now() - context.lastActivity) < 300000; // 5 minutes
    
    if (isRecentlyActive) {
      ws.send(message);
    }
    // Note: Session-related messages (session-created, claude-output, etc.) 
    // are handled separately and always sent to preserve conversation continuity
  });
};

const registerUserProject = (ws, projectName) => {
  const context = connectedClients.get(ws);
  if (context) {
    context.activeProject = projectName;
    context.lastActivity = Date.now();
  }
};

const broadcastToAll = (message) => {
  // For session-critical messages that must preserve continuity
  connectedClients.forEach((context, ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
};

const notifyUserProjectAccess = (userId, projectName) => {
  // Update project access for user's WebSocket connections
  connectedClients.forEach((context, ws) => {
    if (context.userId === userId) {
      context.activeProject = projectName;
      context.lastActivity = Date.now();
    }
  });
};

// Setup file system watcher for Claude projects folder using chokidar
async function setupProjectsWatcher() {
  const chokidar = (await import('chokidar')).default;
  const claudeProjectsPath = path.join(process.env.HOME, '.claude', 'projects');
  
  if (projectsWatcher) {
    projectsWatcher.close();
  }
  
  try {
    // Initialize chokidar watcher with optimized settings
    projectsWatcher = chokidar.watch(claudeProjectsPath, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/*.tmp',
        '**/*.swp',
        '**/.DS_Store'
      ],
      persistent: true,
      ignoreInitial: true, // Don't fire events for existing files on startup
      followSymlinks: false,
      depth: 10, // Reasonable depth limit
      awaitWriteFinish: {
        stabilityThreshold: 100, // Wait 100ms for file to stabilize
        pollInterval: 50
      }
    });
    
    // Debounce function to prevent excessive notifications
    let debounceTimer;
    const debouncedUpdate = async (eventType, filePath) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(async () => {
        try {
          
          // Clear project directory cache when files change
          clearProjectDirectoryCache();
          // Also clear our local caches to avoid stale analysis
          projectAnalysisCache.clear();
          
          // Get updated projects list
          const updatedProjects = await getProjects();
          
          // Notify all connected clients about the project changes
          const updateMessage = JSON.stringify({
            type: 'projects_updated',
            projects: updatedProjects,
            timestamp: new Date().toISOString(),
            changeType: eventType,
            changedFile: path.relative(claudeProjectsPath, filePath)
          });
          
          // Smart broadcast: only send project updates to relevant users
          broadcastProjectUpdate(updateMessage, eventType, filePath);
          
        } catch (error) {
          console.error('❌ Error handling project changes:', error);
        }
      }, 300); // 300ms debounce (slightly faster than before)
    };
    
    // Set up event listeners
    projectsWatcher
      .on('add', (filePath) => debouncedUpdate('add', filePath))
      .on('change', (filePath) => debouncedUpdate('change', filePath))
      .on('unlink', (filePath) => debouncedUpdate('unlink', filePath))
      .on('addDir', (dirPath) => debouncedUpdate('addDir', dirPath))
      .on('unlinkDir', (dirPath) => debouncedUpdate('unlinkDir', dirPath))
      .on('error', (error) => {
        console.error('❌ Chokidar watcher error:', error);
      })
      .on('ready', () => {
      });
    
  } catch (error) {
    console.error('❌ Failed to setup projects watcher:', error);
  }
}


const app = express();
const server = http.createServer(app);

// Single WebSocket server that handles both paths
const wss = new WebSocketServer({ 
  server,
  verifyClient: (info) => {
    
    // Extract token from query parameters or headers
    const url = new URL(info.req.url, 'http://localhost');
    const token = url.searchParams.get('token') || 
                  info.req.headers.authorization?.split(' ')[1];
    
    // Verify token
    const user = authenticateWebSocket(token);
    if (!user) {
      return false;
    }
    
    // Store user info in the request for later use
    info.req.user = user;
    return true;
  }
});

// Security and rate limiting middleware
app.use(resourceMonitor);
app.use(speedLimiter);
app.use(cors());
app.use(express.json());

// DEPRECATED: Temporary logo endpoint to handle cached browser requests
app.get('/api/projects/:projectName/logo', (req, res) => {
  console.log(`[DEPRECATED] Logo API call from cached code: ${req.path}`);
  res.status(410).json({
    error: 'Logo API has been removed',
    message: 'Please refresh your browser (Ctrl+F5 or Cmd+Shift+R) to get the updated version',
    removed: true,
    timestamp: new Date().toISOString()
  });
});

// DEPRECATED: Temporary system monitor endpoint to handle cached browser requests
app.get('/api/system/monitor', (req, res) => {
  console.log(`[DEPRECATED] System monitor API call from cached code: ${req.path}`);
  res.status(410).json({
    error: 'System monitor API has been removed',
    message: 'Please refresh your browser (Ctrl+F5 or Cmd+Shift+R) to get the updated version',
    removed: true,
    timestamp: new Date().toISOString()
  });
});

// Authentication routes (public - before API key validation)
app.use('/api/auth', authRoutes);

// Apply general rate limiting to all API routes
app.use('/api', apiRateLimit);

// Optional API key validation (if configured) - for other /api routes
app.use('/api', validateApiKey);



// Enhanced health check endpoint (public)
app.get('/api/health', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {}
    };

    // Check database connectivity
    try {
      const db = await initializeDatabase();
      await db.prepare('SELECT 1').get();
      healthStatus.services.database = 'connected';
    } catch (error) {
      healthStatus.services.database = 'error';
      healthStatus.status = 'degraded';
    }

    // Check Vibe Kanban backend
    try {
      const vibeResponse = await fetch('http://localhost:6734/api/health', {
        timeout: 2000
      });
      healthStatus.services.vibeKanban = vibeResponse.ok ? 'available' : 'error';
    } catch (error) {
      healthStatus.services.vibeKanban = 'unavailable';
      if (healthStatus.status === 'healthy') {
        healthStatus.status = 'degraded';
      }
    }

    // Add system metrics
    const memUsage = process.memoryUsage();
    healthStatus.metrics = {
      memory: {
        rss: Math.round(memUsage.rss / 1024 / 1024) + 'MB',
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + 'MB'
      },
      connections: {
        websocket: connectedClients.size,
        active: [...connectedClients.values()].filter(client => 
          Date.now() - client.lastActivity < 300000 // 5 minutes
        ).length
      },
      responseTime: `${Date.now() - startTime}ms`
    };

    // Determine overall status
    const allServicesHealthy = Object.values(healthStatus.services)
      .every(status => status === 'connected' || status === 'available');
    
    if (!allServicesHealthy && healthStatus.status === 'healthy') {
      healthStatus.status = 'degraded';
    }

    res.status(healthStatus.status === 'healthy' ? 200 : 503).json(healthStatus);
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: `${Date.now() - startTime}ms`
    });
  }
});

// Codex connector mode (protected)
app.get('/api/codex/connector', authenticateToken, (req, res) => {
  try {
    const canUseApi = true;
    const mode = serverCodexAuthMode || (process.env.CODEX_AUTH_MODE || 'api-cli');
    res.json({ mode, canUseApi, hasKey: !!process.env.OPENAI_API_KEY });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/codex/connector', authenticateToken, (req, res) => {
  try {
    const { mode } = req.body || {};
    if (!mode || !['subscription', 'api', 'api-cli', 'api-env'].includes(mode)) {
      return res.status(400).json({ error: 'mode must be "subscription", "api-cli" or "api-env"' });
    }
    serverCodexAuthMode = (mode === 'api') ? 'api-env' : mode;
    const ok = saveSystemSettings();
    if (!ok) return res.status(500).json({ error: 'Failed to persist connector mode' });
    // Broadcast to all websocket clients for real-time updates
    try { broadcastToAll({ type: 'codex-connector', mode }); } catch {}
    res.json({ success: true, mode });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// Git API Routes (protected)
app.use('/api/git', authenticateToken, gitRoutes);

// MCP API Routes (protected) - Removed: MCPs are managed directly by Claude CLI
// app.use('/api/mcp', authenticateToken, mcpRoutes);

// Usage API Routes (protected)
app.use('/api/usage', usageRoutes);
app.use('/api/system', authenticateToken, systemRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/claude-hooks', authenticateToken, claudeHooksRoutes);
app.use('/api/claude-stream', claudeStreamRoutes);

// Sound files API route for Vibe Kanban sound notifications
app.get('/api/sounds/:soundFile', (req, res) => {
  try {
    const soundFile = req.params.soundFile;
    const soundPath = path.join(__dirname, '../vibe-kanban/backend/sounds', soundFile);
    
    // Check if file exists and is within sounds directory
    if (!fs.existsSync(soundPath)) {
      return res.status(404).json({ error: 'Sound file not found' });
    }
    
    // Serve the sound file with proper MIME type
    const mimeType = mime.lookup(soundPath) || 'audio/wav';
    res.setHeader('Content-Type', mimeType);
    res.sendFile(path.resolve(soundPath));
  } catch (error) {
    console.error('Error serving sound file:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Vibe Kanban Cleanup API Routes
app.get('/api/cleanup/status', authenticateToken, (req, res) => {
  res.json(cleanupService.getStatus());
});

app.post('/api/cleanup/force', authenticateToken, async (req, res) => {
  try {
    await cleanupService.forceCleanup();
    res.json({ success: true, message: 'Forced cleanup completed' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/cleanup/restart', authenticateToken, (req, res) => {
  try {
    cleanupService.stop();
    cleanupService.start();
    res.json({ success: true, message: 'Cleanup service restarted' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Static files served after API routes
app.use(express.static(path.join(__dirname, '../dist')));

// API Routes (protected)
app.get('/api/config', authenticateToken, (req, res) => {
  const host = req.headers.host || `${req.hostname}:${PORT}`;
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws';
  
  
  res.json({
    serverPort: PORT,
    wsUrl: `${protocol}://${host}`
  });
});

// Settings API endpoints
app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    // For now, we'll use a simple in-memory storage or file-based storage
    // In production, this should be stored in a database
    const settingsFile = path.join(__dirname, 'database', 'user-settings.json');
    
    if (fs.existsSync(settingsFile)) {
      const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
      const userSettings = settings[req.user?.username] || {};
      res.json(userSettings);
    } else {
      // Return default settings
      res.json({
        allowedTools: [],
        disallowedTools: [],
        skipPermissions: false,
        projectSortOrder: 'name'
      });
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    res.status(500).json({ error: 'Failed to load settings' });
  }
});

app.post('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settingsFile = path.join(__dirname, 'database', 'user-settings.json');
    let allSettings = {};
    
    // Load existing settings
    if (fs.existsSync(settingsFile)) {
      allSettings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    }
    
    // Update user's settings
    const username = req.user?.username || 'default';
    allSettings[username] = {
      allowedTools: req.body.allowedTools || [],
      disallowedTools: req.body.disallowedTools || [],
      skipPermissions: req.body.skipPermissions || false,
      projectSortOrder: req.body.projectSortOrder || 'name',
      updatedAt: new Date().toISOString()
    };
    
    // Save to file
    fs.writeFileSync(settingsFile, JSON.stringify(allSettings, null, 2));
    
    res.json({ success: true, settings: allSettings[username] });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    // Add timeout to prevent hanging requests
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Request timeout')), 5000)
    );
    
    const projects = await Promise.race([
      getProjects(),
      timeoutPromise
    ]);
    
    res.json(projects);
  } catch (error) {
    console.error('[API] /api/projects error:', error.message);
    res.status(500).json({ error: error.message });
  }
});


// Analyze project contents to infer dominant technology/language
app.get('/api/projects/analyze', projectAnalysisRateLimit, authenticateToken, async (req, res) => {
  try {
    const projectPath = req.query.path;
    if (!projectPath || !path.isAbsolute(projectPath)) {
      return res.status(400).json({ error: 'Absolute project path required' });
    }

    const cached = getCached(projectAnalysisCache, projectPath);
    if (cached) return res.json(cached);

    const stats = {
      python: 0,
      react: 0,
      vue: 0,
      svelte: 0,
      nodejs: 0,
      rust: 0,
      go: 0,
      java: 0,
      php: 0,
      reactnative: 0,
      flutter: 0,
      database: 0,
      docker: 0,
      web: 0,
      api: 0
    };

    const ignoredDirs = new Set(['node_modules', 'dist', 'build', '.git', '.next', '.turbo', 'target', 'venv', '__pycache__', '.vscode', '.idea']);

    let filesProcessed = 0;
    const MAX_FILES = 1000; // Limit total files processed
    const MAX_DEPTH = 2; // More restrictive depth
    const startTime = Date.now();
    const TIMEOUT_MS = 2000; // 2 second timeout
    
    async function walk(dir, depth = 0) {
      // Early exits to prevent memory issues
      if (depth > MAX_DEPTH) return;
      if (filesProcessed > MAX_FILES) return;
      if (Date.now() - startTime > TIMEOUT_MS) return;
      
      let entries = [];
      try {
        entries = await fsPromises.readdir(dir, { withFileTypes: true });
        // Limit entries per directory to prevent massive directories
        entries = entries.slice(0, 100);
      } catch (e) {
        return;
      }
      
      for (const entry of entries) {
        if (ignoredDirs.has(entry.name)) continue;
        if (filesProcessed >= MAX_FILES) return;
        
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
        } else {
          filesProcessed++;
          const ext = path.extname(entry.name).toLowerCase();
          switch (ext) {
            case '.py': stats.python++; break;
            case '.rs': stats.rust++; break;
            case '.go': stats.go++; break;
            case '.java': stats.java++; break;
            case '.php': stats.php++; break;
            case '.sql': stats.database++; break;
            case '.dart': stats.flutter++; break;
            case '.js':
            case '.jsx': stats.web++; break;
            case '.ts':
            case '.tsx': stats.web++; break;
            case '.yml':
            case '.yaml':
            case '.dockerfile': stats.docker++; break;
          }
          // Optimized package.json check - limit read size and only check key dependencies
          if (entry.name === 'package.json') {
            try {
              // Only read first 8KB to avoid large package.json files
              const buffer = Buffer.alloc(8192);
              const fd = await fsPromises.open(full, 'r');
              const { bytesRead } = await fd.read(buffer, 0, 8192, 0);
              await fd.close();
              
              const pkgRaw = buffer.slice(0, bytesRead).toString('utf8');
              // Only parse if it looks like valid JSON start
              if (pkgRaw.startsWith('{')) {
                const pkg = JSON.parse(pkgRaw.split('\n').slice(0, 50).join('\n') + '}'); // Truncated parse
                const allDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
                if (allDeps['react'] || allDeps['next']) stats.react += 20;
                if (allDeps['react-native']) stats.reactnative += 30;
                if (allDeps['vue'] || allDeps['nuxt']) stats.vue += 20;
                if (allDeps['svelte']) stats.svelte += 20;
                if (allDeps['express'] || allDeps['fastify'] || allDeps['koa']) stats.nodejs += 10;
              }
            } catch (_) {
              // Silently ignore package.json parsing errors
            }
          }
        }
      }
    }

    await walk(projectPath);

    // Decide predominant
    const entries = Object.entries(stats);
    entries.sort((a, b) => b[1] - a[1]);
    const [bestType, bestScore] = entries[0] || ['web', 0];

    const typeToPresentation = {
      python: { icon: '🐍', color: '#3776AB' },
      react: { icon: '⚛️', color: '#61DAFB' },
      vue: { icon: '🟢', color: '#4FC08D' },
      svelte: { icon: '🧡', color: '#FF3E00' },
      nodejs: { icon: '💚', color: '#339933' },
      rust: { icon: '🦀', color: '#CE422B' },
      go: { icon: '🐹', color: '#00ADD8' },
      java: { icon: '☕', color: '#ED8B00' },
      php: { icon: '🐘', color: '#777BB4' },
      reactnative: { icon: '📱', color: '#61DAFB' },
      flutter: { icon: '🐦', color: '#02569B' },
      database: { icon: '🗄️', color: '#336791' },
      docker: { icon: '🐳', color: '#2496ED' },
      web: { icon: '🎨', color: '#6366f1' },
      api: { icon: '🌐', color: '#666666' }
    };

    const presentation = typeToPresentation[bestType] || typeToPresentation.web;
    const result = {
      type: bestType,
      confidence: Math.min(0.99, bestScore / 50 + 0.3),
      icon: presentation.icon,
      color: presentation.color
    };

    setCached(projectAnalysisCache, projectPath, result);
    res.json(result);
  } catch (error) {
    console.error('Error analyzing project:', error);
    res.status(500).json({ error: 'Failed to analyze project' });
  }
});

app.get('/api/projects/:projectName/sessions', authenticateToken, async (req, res) => {
  try {
    const { limit = 5, offset = 0 } = req.query;
    const projectName = req.params.projectName;
    
    // Notify WebSocket connections about project access
    notifyUserProjectAccess(req.user.userId, projectName);
    
    const result = await getSessions(projectName, parseInt(limit), parseInt(offset));
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get messages for a specific session
app.get('/api/projects/:projectName/sessions/:sessionId/messages', authenticateToken, async (req, res) => {
  try {
    const { projectName, sessionId } = req.params;
    
    // Notify WebSocket connections about project access
    notifyUserProjectAccess(req.user.userId, projectName);
    const messages = await getSessionMessages(projectName, sessionId);
    res.json({ messages });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get current session information
app.get('/api/sessions/current', authenticateToken, async (req, res) => {
  try {
    // Get the most recent active session from WebSocket connections
    const activeConnections = Array.from(clients.values());
    const currentSession = activeConnections.find(client => 
      client.userId === req.user.userId && client.projectName
    );
    
    if (currentSession) {
      const sessionInfo = {
        sessionId: currentSession.sessionId,
        projectName: currentSession.projectName,
        startTime: currentSession.startTime || new Date().toISOString(),
        messageCount: currentSession.messageCount || 0,
        model: currentSession.model || 'claude-3-5-sonnet-20241022'
      };
      res.json(sessionInfo);
    } else {
      res.json(null);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rename project endpoint
app.put('/api/projects/:projectName/rename', authenticateToken, async (req, res) => {
  try {
    const { displayName } = req.body;
    await renameProject(req.params.projectName, displayName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete session endpoint
app.delete('/api/projects/:projectName/sessions/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { projectName, sessionId } = req.params;
    await deleteSession(projectName, sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project endpoint (only if empty)
app.delete('/api/projects/:projectName', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    await deleteProject(projectName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project completely (including all sessions)
app.delete('/api/projects/:projectName/force', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    await deleteProjectCompletely(projectName);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create project endpoint
app.post('/api/projects/create', authenticateToken, async (req, res) => {
  try {
    const { path: projectPath } = req.body;
    
    if (!projectPath || !projectPath.trim()) {
      return res.status(400).json({ error: 'Project path is required' });
    }
    
    const project = await addProjectManually(projectPath.trim());
    res.json({ success: true, project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: error.message });
  }
});

// Read file content endpoint
app.get('/api/projects/:projectName/file', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath } = req.query;
    
    
    // Using fsPromises from import
    
    // Security check - ensure the path is safe and absolute
    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    const content = await fsPromises.readFile(filePath, 'utf8');
    res.json({ content, path: filePath });
  } catch (error) {
    console.error('Error reading file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File not found' });
    } else if (error.code === 'EACCES') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Serve binary file content endpoint (for images, etc.)
app.get('/api/projects/:projectName/files/content', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { path: filePath } = req.query;
    
    
    // Using fs from import
    // Using mime from import
    
    // Security check - ensure the path is safe and absolute
    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    // Check if file exists
    try {
      await fsPromises.access(filePath);
    } catch (error) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file extension and set appropriate content type
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    
    // Stream the file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error reading file' });
      }
    });
    
  } catch (error) {
    console.error('Error serving binary file:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});


// Save file content endpoint
app.put('/api/projects/:projectName/file', authenticateToken, async (req, res) => {
  try {
    const { projectName } = req.params;
    const { filePath, content } = req.body;
    
    
    // Using fsPromises from import
    
    // Security check - ensure the path is safe and absolute
    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    
    if (content === undefined) {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    // Create backup of original file
    try {
      const backupPath = filePath + '.backup.' + Date.now();
      await fsPromises.copyFile(filePath, backupPath);
    } catch (backupError) {
    }
    
    // Write the new content
    await fsPromises.writeFile(filePath, content, 'utf8');
    
    res.json({ 
      success: true, 
      path: filePath,
      message: 'File saved successfully' 
    });
  } catch (error) {
    console.error('Error saving file:', error);
    if (error.code === 'ENOENT') {
      res.status(404).json({ error: 'File or directory not found' });
    } else if (error.code === 'EACCES') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Create file or folder endpoint
app.post('/api/files/create', authenticateToken, async (req, res) => {
  try {
    const { projectName, path: filePath, type } = req.body;
    
    if (!projectName || !filePath) {
      return res.status(400).json({ error: 'Project name and path are required' });
    }
    
    if (!['file', 'folder'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "file" or "folder"' });
    }
    
    // Get the actual project directory
    let projectDir;
    try {
      projectDir = await extractProjectDirectory(projectName);
    } catch (error) {
      console.error('Error extracting project directory:', error);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Construct the full path
    const fullPath = path.join(projectDir, filePath);
    
    // Check if already exists
    try {
      await fsPromises.access(fullPath);
      return res.status(400).json({ error: `${type === 'file' ? 'File' : 'Folder'} already exists` });
    } catch (e) {
      // Good, it doesn't exist
    }
    
    if (type === 'folder') {
      // Create folder
      await fsPromises.mkdir(fullPath, { recursive: true });
      console.log('📁 Created folder:', fullPath);
    } else {
      // Create file
      // First ensure parent directory exists
      const parentDir = path.dirname(fullPath);
      await fsPromises.mkdir(parentDir, { recursive: true });
      
      // Create empty file
      await fsPromises.writeFile(fullPath, '', 'utf8');
      console.log('📄 Created file:', fullPath);
    }
    
    res.json({ 
      success: true, 
      message: `${type === 'file' ? 'File' : 'Folder'} created successfully`,
      path: fullPath
    });
    
  } catch (error) {
    console.error('Error creating file/folder:', error);
    if (error.code === 'EACCES') {
      res.status(403).json({ error: 'Permission denied' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Read file (binary) by absolute path - used by FileManager image preview/download
app.get('/api/files/read', authenticateToken, async (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath || !path.isAbsolute(filePath)) {
      return res.status(400).json({ error: 'Invalid file path' });
    }
    try {
      await fsPromises.access(filePath);
    } catch (e) {
      return res.status(404).json({ error: 'File not found' });
    }
    const mimeType = mime.lookup(filePath) || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', err => {
      console.error('Error streaming file:', err);
      if (!res.headersSent) res.status(500).json({ error: 'Error reading file' });
    });
  } catch (error) {
    console.error('Error in /api/files/read:', error);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// Rename a file or folder within a project
app.post('/api/files/rename', authenticateToken, async (req, res) => {
  try {
    const { projectName, oldPath, newName } = req.body;
    if (!projectName || !oldPath || !newName) {
      return res.status(400).json({ error: 'projectName, oldPath and newName are required' });
    }
    const projectDir = await extractProjectDirectory(projectName).catch(() => null);
    if (!projectDir) return res.status(404).json({ error: 'Project not found' });
    if (!path.isAbsolute(oldPath)) return res.status(400).json({ error: 'oldPath must be absolute' });
    const targetDir = path.dirname(oldPath);
    const newPath = path.join(targetDir, newName);
    // Ensure both old and new paths remain inside the project directory
    const insideProject = p => path.resolve(p).startsWith(path.resolve(projectDir));
    if (!insideProject(oldPath) || !insideProject(newPath)) {
      return res.status(400).json({ error: 'Path outside project directory' });
    }
    await fsPromises.rename(oldPath, newPath);
    res.json({ success: true, path: newPath });
  } catch (error) {
    console.error('Error renaming file/folder:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a file or folder within a project
app.delete('/api/files/delete', authenticateToken, async (req, res) => {
  try {
    const { projectName, path: targetPath } = req.body || {};
    if (!projectName || !targetPath) {
      return res.status(400).json({ error: 'projectName and path are required' });
    }
    const projectDir = await extractProjectDirectory(projectName).catch(() => null);
    if (!projectDir) return res.status(404).json({ error: 'Project not found' });
    if (!path.isAbsolute(targetPath)) return res.status(400).json({ error: 'path must be absolute' });
    const resolved = path.resolve(targetPath);
    if (!resolved.startsWith(path.resolve(projectDir))) {
      return res.status(400).json({ error: 'Path outside project directory' });
    }
    let stats;
    try {
      stats = await fsPromises.stat(resolved);
    } catch (e) {
      return res.status(404).json({ error: 'File or folder not found' });
    }
    if (stats.isDirectory()) {
      await fsPromises.rm(resolved, { recursive: true, force: true });
    } else {
      await fsPromises.unlink(resolved);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting file/folder:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:projectName/files', authenticateToken, async (req, res) => {
  try {
    
    // Using fsPromises from import
    
    // Use extractProjectDirectory to get the actual project path
    let actualPath;
    try {
      actualPath = await extractProjectDirectory(req.params.projectName);
    } catch (error) {
      console.error('Error extracting project directory:', error);
      // Fallback to simple dash replacement
      actualPath = req.params.projectName.replace(/-/g, '/');
    }
    
    // Check if path exists
    try {
      await fsPromises.access(actualPath);
    } catch (e) {
      return res.status(404).json({ error: `Project path not found: ${actualPath}` });
    }
    
    const files = await getFileTree(actualPath, 3, 0, true);
    const hiddenFiles = files.filter(f => f.name.startsWith('.'));
    res.json(files);
  } catch (error) {
    console.error('❌ File tree error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket connection handler that routes based on URL path
wss.on('connection', (ws, request) => {
  const url = request.url;
  
  // Parse URL to get pathname without query parameters
  const urlObj = new URL(url, 'http://localhost');
  const pathname = urlObj.pathname;
  
  if (pathname === '/shell') {
    handleShellConnection(ws, request);
  } else if (pathname === '/ws') {
    handleChatConnection(ws, request);
  } else {
    ws.close();
  }
});

// Handle chat WebSocket connections
function handleChatConnection(ws, request) {
  
  // Store user context for session isolation
  const user = request.user; // From WebSocket authentication
  connectedClients.set(ws, {
    userId: user.userId,
    username: user.username,
    activeProject: null,
    lastActivity: Date.now()
  });
  
  // Track Codex session per connection
  let codexSession = null; // { sessionId, rolloutPath }
  // Queue of Codex commands per connection
  const codexQueue = [];
  let codexProcessing = false;
  let codexCurrentProcess = null; // CLI only

  const processNextCodex = async () => {
    if (codexProcessing) return;
    const task = codexQueue.shift();
    if (!task) {
      try { ws.send(JSON.stringify({ type: 'codex-idle' })); } catch {}
      return;
    }
    codexProcessing = true;
    try {
      // Notify busy state and current queue length
      try { ws.send(JSON.stringify({ type: 'codex-busy', queueLength: codexQueue.length })); } catch {}
      codexCurrentProcess = null;
      await spawnCodex(task.command, { ...task.options, onProcess: (p) => { codexCurrentProcess = p; } }, ws);
    } catch (e) {
      // Errors are already forwarded by spawnCodex via ws events
    } finally {
      codexProcessing = false;
      codexCurrentProcess = null;
      // Proceed to next queued task
      setTimeout(processNextCodex, 0);
    }
  };
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle image upload from Shell/Chat
      if (data.type === 'upload-image') {
        const { imageData, fileName } = data;
        console.log('📸 Received image upload request:', fileName);
        
        try {
          // Parse base64 data
          const matches = imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (!matches) {
            ws.send(JSON.stringify({
              type: 'image-upload-error',
              error: 'Invalid image data format'
            }));
            return;
          }
          
          const mimeType = matches[1];
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Generate unique ID and save to temp
          const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          const uploadDir = path.join(os.tmpdir(), 'claude-ui-images');
          await fsPromises.mkdir(uploadDir, { recursive: true });
          
          const ext = fileName.split('.').pop() || 'png';
          const imagePath = path.join(uploadDir, `${imageId}.${ext}`);
          
          // Save image to disk
          await fsPromises.writeFile(imagePath, buffer);
          console.log('💾 Image saved to:', imagePath);
          
          // Store in global map
          if (!global.uploadedImages) {
            global.uploadedImages = new Map();
          }
          
          const userContext = connectedClients.get(ws);
          global.uploadedImages.set(imageId, {
            path: imagePath,
            mimetype: mimeType,
            fileName: fileName,
            userId: userContext?.userId || 'anonymous',
            uploadedAt: new Date()
          });
          
          // Return the actual file path for Claude to read
          console.log('✅ Sending image path back to client:', imagePath);
          ws.send(JSON.stringify({
            type: 'image-uploaded',
            imageId: imageId,
            path: imagePath,  // Send actual file path
            fileName: fileName
          }));
          
        } catch (error) {
          console.error('Error uploading image:', error);
          ws.send(JSON.stringify({
            type: 'image-upload-error',
            error: 'Failed to upload image'
          }));
        }
        return;
      }
      
      if (data.type === 'claude-command') {
        console.log('Received claude-command:', { command: data.command?.substring(0, 50), options: data.options });
        
        // Register user's active project for smart broadcasting
        if (data.options?.projectPath) {
          const projectName = data.options.projectPath.split('/').pop();
          registerUserProject(ws, projectName);
        }
        
        await spawnClaude(data.command, data.options, ws);
      } else if (data.type === 'codex-command') {
        // Register user's active project for smart broadcasting
        if (data.options?.projectPath) {
          const projectName = data.options.projectPath.split('/').pop();
          registerUserProject(ws, projectName);
        }
        // Use session resume if available
        const opts = {
          ...(data.options || {}),
          dangerous: !!(data.options && data.options.dangerous),
          authMode: 'api-cli',
          resumeRolloutPath: codexSession?.rolloutPath || null,
          onSession: (sessionId, rolloutPath) => {
            codexSession = { sessionId, rolloutPath };
          }
        };
        // Enqueue and process sequentially
        const enqueued = { command: data.command, options: opts };
        codexQueue.push(enqueued);
        const position = codexQueue.length - 1; // 0 means next
        try { ws.send(JSON.stringify({ type: 'codex-queued', position, queueLength: codexQueue.length })); } catch {}
        processNextCodex();
      } else if (data.type === 'codex-abort') {
        // Clear all queued tasks
        codexQueue.length = 0;
        // Try to terminate the running process gracefully
        let aborted = false;
        try {
          if (codexCurrentProcess && typeof codexCurrentProcess.kill === 'function') {
            aborted = codexCurrentProcess.kill('SIGINT');
            setTimeout(() => {
              if (codexCurrentProcess) {
                try { codexCurrentProcess.kill('SIGKILL'); } catch {}
              }
            }, 1000);
          }
        } catch {}
        codexProcessing = false;
        try { ws.send(JSON.stringify({ type: 'codex-aborted', success: aborted })); } catch {}
        // Inform idle state
        try { ws.send(JSON.stringify({ type: 'codex-idle' })); } catch {}
      } else if (data.type === 'claude-start-session') {
        // Start a new Claude session
        ws.send(JSON.stringify({ type: 'claude-session-started' }));
      } else if (data.type === 'claude-end-session') {
        // End Claude session
        ws.send(JSON.stringify({ type: 'claude-session-closed' }));
      } else if (data.type === 'codex-start-session') {
        // Acknowledgement-only: do NOT spawn Codex here to avoid autonomous actions
        // The first real user message will start Codex and capture the session/rollout
        codexSession = null;
        ws.send(JSON.stringify({ type: 'codex-session-started' }));
      } else if (data.type === 'codex-end-session') {
        codexSession = null;
        ws.send(JSON.stringify({ type: 'codex-session-closed' }));
      } else if (data.type === 'abort-session') {
        const success = abortClaudeSession(data.sessionId);
        ws.send(JSON.stringify({
          type: 'session-aborted',
          sessionId: data.sessionId,
          success
        }));
      }
    } catch (error) {
      console.error('❌ Chat WebSocket error:', error.message);
      ws.send(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  });
  
  ws.on('close', () => {
    // Remove from connected clients
    connectedClients.delete(ws);
  });
}

// Handle shell WebSocket connections
function handleShellConnection(ws, request) {
  
  // Get user info from authenticated request
  const user = request.user || { userId: 'anonymous', username: 'anonymous' };
  
  let shellProcess = null;
  let bypassPermissions = false;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'init') {
        // Handle standalone mode - use home directory, never resume sessions
        let projectPath = data.projectPath || process.cwd();
        let sessionId = data.sessionId;
        let hasSession = data.hasSession;
        
        if (projectPath === 'STANDALONE_MODE') {
          projectPath = process.env.HOME || process.env.USERPROFILE || process.cwd();
          sessionId = null; // Never resume - always fresh session
          hasSession = false; // Never has session - always new
        }
        
        bypassPermissions = data.bypassPermissions || false;
        
        // Shell process will be created fresh for each connection
        // Sessions are managed on the client side now
        
        // Create new shell session
          
          // Send welcome message - standalone mode is always fresh
          const isStandalone = data.projectPath === 'STANDALONE_MODE';
          const welcomeMsg = isStandalone ? 
            `\x1b[36mStarting fresh Claude session (no project)\x1b[0m\r\n` :
            (hasSession ? 
              `\x1b[36mResuming Claude session ${sessionId} in: ${projectPath}\x1b[0m\r\n` :
              `\x1b[36mStarting new Claude session in: ${projectPath}\x1b[0m\r\n`);
          
          ws.send(JSON.stringify({
            type: 'output',
            data: welcomeMsg
          }));
          
          // Show bypass status if enabled
          if (bypassPermissions) {
            ws.send(JSON.stringify({
              type: 'output',
              data: '\x1b[33mBypassing Permissions\x1b[0m\r\n'
            }));
          }
          
          try {
            // Build claude command
            let claudeCommand = 'claude';
            
            if (bypassPermissions) {
              claudeCommand += ' --dangerously-skip-permissions';
            }
            
            if (hasSession && sessionId) {
              claudeCommand += ` --resume ${sessionId}`;
            }
            
            // Use the user's default shell to ensure proper environment loading
            const userShell = process.env.SHELL || '/bin/bash';
            
            // Build the full shell command
            const shellCommand = `cd "${projectPath}" && ${claudeCommand}`;
            
            // Start shell with the command directly
            shellProcess = pty.spawn(userShell, ['-lc', shellCommand], {
              name: 'xterm-256color',
              cols: data.cols || 80,
              rows: data.rows || 24,
              cwd: projectPath,
              env: {
                ...process.env,
                // Ensure PATH includes common locations for claude including NVM
                PATH: `/Users/guilhermevarela/.nvm/versions/node/v20.19.4/bin:${process.env.PATH || ''}`,
                TERM: 'xterm-256color'
              }
            });
            
            
            // Handle data output
            shellProcess.onData((data) => {
              const output = data.toString();
              
              // Filter out suspicious JavaScript code artifacts
              // This appears to be a bug where minified JS code is being output
              const suspiciousPatterns = [
                /\bn\d{3,4}-/g,  // Variables like n992-, n993-
                /fileHandler\.configure/,
                /generateAutoCompletion/,
                /tFileHandler/,
                /\\t\\t\\t\\t\\t/  // Multiple tabs indicating formatted code
              ];
              
              if (suspiciousPatterns.some(pattern => output.match(pattern))) {
                console.warn('Filtered out suspicious JS code output:', output.substring(0, 50) + '...');
                return; // Skip this output entirely
              }
              
              // Log errors or important messages (but limit output to reduce spam)
              if (output.includes('zsh: command not found') || output.includes('bash: command not found')) {
              } else if (output.includes('Starting Claude CLI')) {
              } else if (output.includes('Welcome to Claude') || output.includes('claude>')) {
              }
              
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                  type: 'output',
                  data: data
                }));
              }
            });
            
            // Handle process exit
            shellProcess.onExit((exitCode) => {
              if (ws.readyState === ws.OPEN) {
                ws.send(JSON.stringify({
                  type: 'output',
                  data: `\r\n\x1b[33mProcess exited with code ${exitCode.exitCode}${exitCode.signal ? ` (signal: ${exitCode.signal})` : ''}\x1b[0m\r\n`
                }));
              }
              
              // Clean up process reference
              shellProcess = null;
            });
            
          } catch (spawnError) {
            console.error('❌ Error spawning process:', spawnError);
            ws.send(JSON.stringify({
              type: 'output',
              data: `\r\n\x1b[31mError: ${spawnError.message}\x1b[0m\r\n`
            }));
          }
        
      } else if (data.type === 'input') {
        // Send input to shell process
        if (shellProcess && shellProcess.write) {
          // Use async processing for image URL handling
          (async () => {
            try {
            // Check if the input contains image URLs that need to be converted to file paths
            let processedInput = data.data;
            
            // Pattern to match image URLs in the input (both internal API and external URLs)
            const internalImagePattern = /\/api\/projects\/[^\/\s]+\/files\/content\?path=[^\s]+\.(png|jpg|jpeg|gif|webp|svg)/gi;
            const externalImagePattern = /https?:\/\/[^\s]+\.(png|jpg|jpeg|gif|webp|svg)/gi;
            
            // First, handle internal API image URLs
            const internalUrls = processedInput.match(internalImagePattern);
            if (internalUrls && internalUrls.length > 0) {
              for (const imageUrl of internalUrls) {
                try {
                  // Extract project name and file path from URL
                  const urlParts = imageUrl.match(/\/api\/projects\/([^\/]+)\/files\/content\?path=(.+)/);
                  if (urlParts) {
                    const projectName = urlParts[1];
                    const encodedPath = urlParts[2];
                    const filePath = decodeURIComponent(encodedPath);
                    
                    // Get the actual project directory
                    const projectDir = await extractProjectDirectory(projectName);
                    if (!projectDir) {
                      // Don't log for old/non-existent projects - just skip silently
                      continue;
                    }
                    
                    // Construct the full file path
                    const fullFilePath = path.join(projectDir, filePath);
                    
                    // Check if file exists
                    if (fs.existsSync(fullFilePath)) {
                      // Replace the URL with the actual file path in the input
                      processedInput = processedInput.replace(imageUrl, fullFilePath);
                      
                      // Send feedback to terminal
                      ws.send(JSON.stringify({
                        type: 'output',
                        data: `\r\n\x1b[32m✓ Imagem local encontrada: ${path.basename(fullFilePath)}\x1b[0m\r\n`
                      }));
                    } else {
                      console.error('Image file not found:', fullFilePath);
                      ws.send(JSON.stringify({
                        type: 'output',
                        data: `\r\n\x1b[31m✗ Arquivo de imagem não encontrado: ${path.basename(filePath)}\x1b[0m\r\n`
                      }));
                    }
                  }
                } catch (error) {
                  console.error('Error processing internal image URL:', error);
                }
              }
            }
            
            // Then, handle external HTTP/HTTPS image URLs
            const externalUrls = processedInput.match(externalImagePattern);
            if (externalUrls && externalUrls.length > 0) {
              const axios = require('axios');
              const os = require('os');
              
              for (const imageUrl of externalUrls) {
                try {
                  // Create temp directory for downloaded images
                  const tempDir = path.join(os.tmpdir(), 'claude-code-images');
                  await fsPromises.mkdir(tempDir, { recursive: true });
                  
                  // Generate unique filename
                  const timestamp = Date.now();
                  const urlPath = new URL(imageUrl).pathname;
                  const ext = path.extname(urlPath) || '.png';
                  const filename = `downloaded_${timestamp}${ext}`;
                  const tempFilePath = path.join(tempDir, filename);
                  
                  // Download the image
                  ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[33m⬇ Baixando imagem: ${imageUrl.substring(0, 50)}...\x1b[0m\r\n`
                  }));
                  
                  const response = await axios.get(imageUrl, {
                    responseType: 'arraybuffer',
                    timeout: 10000 // 10 second timeout
                  });
                  
                  // Save to temp file
                  await fsPromises.writeFile(tempFilePath, response.data);
                  
                  // Replace URL with temp file path
                  processedInput = processedInput.replace(imageUrl, tempFilePath);
                  
                  ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[32m✓ Imagem baixada: ${filename}\x1b[0m\r\n`
                  }));
                } catch (error) {
                  console.error('Error downloading external image:', error);
                  ws.send(JSON.stringify({
                    type: 'output',
                    data: `\r\n\x1b[31m✗ Erro ao baixar imagem: ${error.message}\x1b[0m\r\n`
                  }));
                }
              }
            }
            
            // Send the processed input with file paths instead of URLs
            shellProcess.write(processedInput);
            } catch (error) {
              console.error('Error writing to shell:', error);
            }
          })(); // Execute the async function immediately
        } else {
        }
      } else if (data.type === 'resize') {
        // Handle terminal resize
        if (shellProcess && shellProcess.resize) {
          shellProcess.resize(data.cols, data.rows);
        }
      } else if (data.type === 'ping') {
        // Respond to client ping with pong
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'pong' }));
        }
      } else if (data.type === 'bypassPermissions') {
        // Handle bypass permissions toggle
        bypassPermissions = data.enabled;
        
        // Send visual feedback to terminal
        const bypassMsg = bypassPermissions 
          ? '\x1b[33m\r\nBypassing Permissions\x1b[0m\r\n'
          : '\x1b[90m\r\nPermissions Normal\x1b[0m\r\n';
          
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({
            type: 'output',
            data: bypassMsg
          }));
        }
        
        // Claude CLI doesn't support changing permissions mid-session
        if (shellProcess) {
          const restartMsg = bypassPermissions 
            ? '\x1b[33m⚠️  To apply bypass permissions, please disconnect and reconnect the shell.\x1b[0m\r\n'
            : '\x1b[33m⚠️  To disable bypass permissions, please disconnect and reconnect the shell.\x1b[0m\r\n';
            
          ws.send(JSON.stringify({
            type: 'output',
            data: restartMsg
          }));
        }
      } else if (data.type === 'image') {
        // Handle image upload
        try {
          const imageData = data.data;
          const { filename, type, size, base64 } = imageData;
          
          // Create images directory in project root for better accessibility
          const projectRoot = process.cwd();
          const imagesDir = path.join(projectRoot, '.claude-images');
          await fsPromises.mkdir(imagesDir, { recursive: true });
          
          // Generate unique filename
          const timestamp = Date.now();
          const ext = path.extname(filename) || '.png';
          const tempFilename = `image_${timestamp}${ext}`;
          const imagePath = path.join(imagesDir, tempFilename);
          
          // Save image to file with proper permissions
          const buffer = Buffer.from(base64, 'base64');
          await fsPromises.writeFile(imagePath, buffer, { mode: 0o644 });
          
          // Don't send output messages - just send the upload event
          // Send image-uploaded event to trigger chat integration
          ws.send(JSON.stringify({
            type: 'image-uploaded',
            path: imagePath,
            fileName: filename
          }));
          
        } catch (error) {
          console.error('Error processing image:', error);
          ws.send(JSON.stringify({
            type: 'output',
            data: `\r\n\x1b[31m❌ Erro ao processar imagem: ${error.message}\x1b[0m\r\n`
          }));
        }
      }
    } catch (error) {
      console.error('❌ Shell WebSocket error:', error.message);
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
          type: 'output',
          data: `\r\n\x1b[31mError: ${error.message}\x1b[0m\r\n`
        }));
      }
    }
  });
  
  ws.on('close', () => {
    
    // Process cleanup is now handled by client-side session management
  });
  
  ws.on('error', (error) => {
    console.error('❌ Shell WebSocket error:', error);
  });
}

// Audio transcription endpoint
app.post('/api/transcribe', authenticateToken, async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const upload = multer({ storage: multer.memoryStorage() });
    
    // Handle multipart form data
    upload.single('audio')(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: 'Failed to process audio file' });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }
      
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in server environment.' });
      }
      
      try {
        // Create form data for OpenAI
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        formData.append('file', req.file.buffer, {
          filename: req.file.originalname,
          contentType: req.file.mimetype
        });
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'json');
        // Don't specify language to let Whisper auto-detect and preserve original language
        // formData.append('language', 'en');
        
        // Make request to OpenAI
        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            ...formData.getHeaders()
          },
          body: formData
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || `Whisper API error: ${response.status}`);
        }
        
        const data = await response.json();
        let transcribedText = data.text || '';
        
        // Check if enhancement mode is enabled
        const mode = req.body.mode || 'default';
        
        // If no transcribed text, return empty
        if (!transcribedText) {
          return res.json({ text: '' });
        }
        
        // If default mode, return transcribed text without enhancement
        if (mode === 'default') {
          return res.json({ text: transcribedText });
        }
        
        // Handle different enhancement modes
        try {
          const OpenAI = (await import('openai')).default;
          const openai = new OpenAI({ apiKey });
          
          let prompt, systemMessage, temperature = 0.7, maxTokens = 800;
          
          switch (mode) {
            case 'prompt':
              systemMessage = 'You are an expert prompt engineer who creates clear, detailed, and effective prompts.';
              prompt = `You are an expert prompt engineer. Transform the following rough instruction into a clear, detailed, and context-aware AI prompt.

Your enhanced prompt should:
1. Be specific and unambiguous
2. Include relevant context and constraints
3. Specify the desired output format
4. Use clear, actionable language
5. Include examples where helpful
6. Consider edge cases and potential ambiguities

Transform this rough instruction into a well-crafted prompt:
"${transcribedText}"

Enhanced prompt:`;
              break;
              
            case 'vibe':
            case 'instructions':
            case 'architect':
              systemMessage = 'You are a helpful assistant that formats ideas into clear, actionable instructions for AI agents.';
              temperature = 0.5; // Lower temperature for more controlled output
              prompt = `Transform the following idea into clear, well-structured instructions that an AI agent can easily understand and execute.

IMPORTANT RULES:
- Format as clear, step-by-step instructions
- Add reasonable implementation details based on common patterns
- Only include details directly related to what was asked
- Do NOT add features or functionality not mentioned
- Keep the original intent and scope intact
- Use clear, actionable language an agent can follow

Transform this idea into agent-friendly instructions:
"${transcribedText}"

Agent instructions:`;
              break;
              
            default:
              // No enhancement needed
              break;
          }
          
          // Only make GPT call if we have a prompt
          if (prompt) {
            const completion = await openai.chat.completions.create({
              model: 'gpt-4o-mini',
              messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt }
              ],
              temperature: temperature,
              max_tokens: maxTokens
            });
            
            transcribedText = completion.choices[0].message.content || transcribedText;
          }
          
        } catch (gptError) {
          console.error('GPT processing error:', gptError);
          // Fall back to original transcription if GPT fails
        }
        
        res.json({ text: transcribedText });
        
      } catch (error) {
        console.error('Transcription error:', error);
        res.status(500).json({ error: error.message });
      }
    });
  } catch (error) {
    console.error('Endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Image upload endpoint
app.post('/api/projects/:projectName/upload-images', authenticateToken, async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const path = (await import('path')).default;
    const fs = (await import('fs')).promises;
    const os = (await import('os')).default;
    
    // Configure multer for image uploads
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = path.join(os.tmpdir(), 'claude-ui-uploads', String(req.user.id));
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        cb(null, uniqueSuffix + '-' + sanitizedName);
      }
    });
    
    const fileFilter = (req, file, cb) => {
      const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
      if (allowedMimes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type. Only JPEG, PNG, GIF, WebP, and SVG are allowed.'));
      }
    };
    
    const upload = multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
        files: 5
      }
    });
    
    // Handle multipart form data
    upload.array('images', 5)(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'No image files provided' });
      }
      
      try {
        // Process uploaded images
        const processedImages = await Promise.all(
          req.files.map(async (file) => {
            // Read file and convert to base64
            const buffer = await fs.readFile(file.path);
            const base64 = buffer.toString('base64');
            const mimeType = file.mimetype;
            
            // Clean up temp file immediately
            await fs.unlink(file.path);
            
            return {
              name: file.originalname,
              data: `data:${mimeType};base64,${base64}`,
              size: file.size,
              mimeType: mimeType
            };
          })
        );
        
        res.json({ images: processedImages });
      } catch (error) {
        console.error('Error processing images:', error);
        // Clean up any remaining files
        await Promise.all(req.files.map(f => fs.unlink(f.path).catch(() => {})));
        res.status(500).json({ error: 'Failed to process images' });
      }
    });
  } catch (error) {
    console.error('Error in image upload endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Import the robust Vibe proxy
import VibeKanbanProxy from './lib/vibe-proxy.js';
import multer from 'multer';

// Initialize Vibe Kanban proxy with configuration
const vibeProxy = new VibeKanbanProxy({
  baseUrl: 'http://localhost:6734',
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  healthCheckInterval: 30000, // 30 seconds
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000 // 1 minute
});

// Image upload endpoint for Vibe Kanban
app.post('/api/vibe-kanban/upload-image', authenticateToken, async (req, res) => {
  try {
    const multer = (await import('multer')).default;
    const path = (await import('path')).default;
    const fs = (await import('fs')).promises;
    const os = (await import('os')).default;
    const crypto = (await import('crypto')).default;
    
    // Configure multer for image uploads
    const storage = multer.diskStorage({
      destination: async (req, file, cb) => {
        const uploadDir = path.join(os.tmpdir(), 'vibe-kanban-uploads', String(req.user.id));
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = crypto.randomBytes(6).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `image-${Date.now()}-${uniqueSuffix}${ext}`);
      }
    });
    
    const upload = multer({
      storage: storage,
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'));
        }
      }
    }).single('image');
    
    upload(req, res, async (err) => {
      if (err) {
        console.error('Upload error:', err);
        return res.status(400).json({ error: err.message });
      }
      
      if (!req.file) {
        return res.status(400).json({ error: 'No image file provided' });
      }
      
      // Generate a URL that can be accessed by the client
      // In production, you might want to upload to S3 or similar
      // For now, we'll create a temporary URL endpoint
      const imageId = path.basename(req.file.filename, path.extname(req.file.filename));
      const imageUrl = `${req.protocol}://${req.get('host')}/api/vibe-kanban/images/${imageId}`;
      
      // Store file path in memory for retrieval (in production, use database)
      if (!global.vibeKanbanImages) {
        global.vibeKanbanImages = new Map();
      }
      global.vibeKanbanImages.set(imageId, {
        path: req.file.path,
        mimetype: req.file.mimetype,
        userId: req.user.id,
        uploadedAt: new Date()
      });
      
      // Clean up old images after 1 hour
      setTimeout(() => {
        if (global.vibeKanbanImages.has(imageId)) {
          const imageData = global.vibeKanbanImages.get(imageId);
          fs.unlink(imageData.path).catch(err => console.error('Failed to delete image:', err));
          global.vibeKanbanImages.delete(imageId);
        }
      }, 60 * 60 * 1000);
      
      res.json({ url: imageUrl });
    });
  } catch (error) {
    console.error('Error handling image upload:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Serve uploaded images
app.get('/api/vibe-kanban/images/:imageId', (req, res) => {
  const imageId = req.params.imageId;
  
  if (!global.vibeKanbanImages || !global.vibeKanbanImages.has(imageId)) {
    return res.status(404).json({ error: 'Image not found' });
  }
  
  const imageData = global.vibeKanbanImages.get(imageId);
  
  // Send the image file
  res.contentType(imageData.mimetype);
  res.sendFile(imageData.path);
});

// General image server for Shell/Chat uploads (public access for Claude)
app.get('/api/images/:imageId', (req, res) => {
  const imageId = req.params.imageId;
  
  if (!global.uploadedImages || !global.uploadedImages.has(imageId)) {
    return res.status(404).json({ error: 'Image not found' });
  }
  
  const imageData = global.uploadedImages.get(imageId);
  
  // Send the image file (no auth required for Claude to access)
  res.contentType(imageData.mimetype);
  res.sendFile(imageData.path);
});

// Initialize global image storage
if (!global.uploadedImages) {
  global.uploadedImages = new Map();
}

// Preview Proxy - Isolates preview content to prevent WebSocket interference
app.get('/api/preview-proxy', async (req, res) => {
  const targetUrl = req.query.url;
  
  if (!targetUrl) {
    return res.status(400).send('URL parameter is required');
  }
  
  try {
    // Fetch the target URL with timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Claude-Code-UI-Preview-Proxy'
      }
    });
    
    clearTimeout(timeout);
    
    // Check if response is HTML
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      // For non-HTML content, just proxy it directly
      const buffer = await response.arrayBuffer();
      res.setHeader('Content-Type', contentType || 'application/octet-stream');
      res.send(Buffer.from(buffer));
      return;
    }
    
    let html = await response.text();
    
    // Inject a script to disable WebSocket when in preview mode
    const disableWebSocketScript = `
      <script>
        // Disable WebSocket in preview mode to prevent interference
        (function() {
          if (window.parent !== window) {
            console.log('Preview Mode: Disabling WebSocket connections');
            const OriginalWebSocket = window.WebSocket;
            window.WebSocket = class WebSocketDisabled {
              constructor(url) {
                console.log('WebSocket blocked in preview mode:', url);
                this.readyState = 0;
                this.url = url;
              }
              send() {}
              close() {}
              addEventListener() {}
              removeEventListener() {}
            };
            window.WebSocket.CLOSED = 3;
            window.WebSocket.CLOSING = 2;
            window.WebSocket.OPEN = 1;
            window.WebSocket.CONNECTING = 0;
          }
        })();
      </script>
    `;
    
    // Inject the script right after <head> or at the beginning of <body>
    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${disableWebSocketScript}`);
    } else if (html.includes('<body>')) {
      html = html.replace('<body>', `<body>${disableWebSocketScript}`);
    } else {
      html = disableWebSocketScript + html;
    }
    
    // Also rewrite any absolute URLs to go through the proxy
    const baseUrl = new URL(targetUrl);
    const baseOrigin = baseUrl.origin;
    
    // Rewrite src and href attributes to use proxy for same-origin resources
    html = html.replace(
      /(?:src|href)="(\/[^"]*?)"/g,
      (match, path) => {
        const fullUrl = baseOrigin + path;
        return match.replace(path, `/api/preview-proxy?url=${encodeURIComponent(fullUrl)}`);
      }
    );
    
    // Set appropriate headers
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.send(html);
  } catch (error) {
    console.error('Preview proxy error:', error);
    
    // Better error messages
    let errorMessage = 'Failed to load preview';
    let errorDetails = '';
    
    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Connection refused';
      errorDetails = `The server at ${targetUrl} is not running or not accessible.`;
    } else if (error.name === 'AbortError') {
      errorMessage = 'Connection timeout';
      errorDetails = 'The server took too long to respond.';
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Server not found';
      errorDetails = `Could not find the server at ${targetUrl}.`;
    }
    
    // Send a styled error page
    const errorHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Preview Error</title>
        <style>
          body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          }
          .error-container {
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
            max-width: 500px;
            text-align: center;
          }
          h1 {
            color: #e53e3e;
            margin: 0 0 1rem 0;
            font-size: 1.5rem;
          }
          p {
            color: #4a5568;
            margin: 0.5rem 0;
          }
          .url {
            background: #f7fafc;
            padding: 0.5rem;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9rem;
            word-break: break-all;
            margin: 1rem 0;
          }
          button {
            background: #667eea;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
            margin-top: 1rem;
          }
          button:hover {
            background: #5a67d8;
          }
        </style>
      </head>
      <body>
        <div class="error-container">
          <h1>⚠️ ${errorMessage}</h1>
          <p>${errorDetails}</p>
          <div class="url">${targetUrl}</div>
          <p>Make sure the server is running and try refreshing.</p>
          <button onclick="window.location.reload()">Retry</button>
        </div>
      </body>
      </html>
    `;
    
    res.status(502).send(errorHtml);
  }
});

// Proxy VibeKanban API requests to Rust backend
app.use('/api/vibe-kanban', express.json(), async (req, res) => {
  try {
    const vibeKanbanPath = req.path.replace('/api/vibe-kanban', '');
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const fullPath = `${vibeKanbanPath}${queryString}`;
    
    
    // Use the robust proxy
    const response = await vibeProxy.makeRequest(fullPath, {
      method: req.method,
      headers: req.headers,
      body: req.body
    });
    
    // Set response headers - handle both raw() method and direct headers object
    const headers = response.headers.raw ? response.headers.raw() : response.headers;
    if (headers) {
      // If headers is a Headers object, iterate properly
      if (headers.forEach) {
        headers.forEach((value, key) => {
          if (key.toLowerCase() !== 'content-encoding') {
            res.setHeader(key, value);
          }
        });
      } else if (typeof headers === 'object') {
        // Handle plain object
        Object.entries(headers).forEach(([key, value]) => {
          if (key.toLowerCase() !== 'content-encoding') {
            res.setHeader(key, value);
          }
        });
      }
    }
    
    // Send response
    res.status(response.status);
    
    if (typeof response.data === 'object') {
      res.json(response.data);
    } else {
      res.send(response.data);
    }
  } catch (error) {
    console.error('VibeKanban proxy error:', error);
    
    // Handle specific error types
    if (error.message.includes('Circuit breaker')) {
      res.status(503).json({ 
        success: false, 
        message: 'Vibe Kanban service is temporarily unavailable due to repeated failures',
        error: 'Service Unavailable',
        details: 'The service will automatically retry in a few moments'
      });
    } else if (error.message.includes('not running')) {
      res.status(503).json({ 
        success: false, 
        message: 'Vibe Kanban backend is not running. Please start it with "npm run vibe-backend" or "npm run dev"',
        error: 'Service Unavailable',
        details: 'The Vibe Kanban backend service (Rust) needs to be running on port 8081'
      });
    } else if (error.message.includes('timeout')) {
      res.status(504).json({ 
        success: false, 
        message: 'Request to Vibe Kanban backend timed out',
        error: 'Gateway Timeout'
      });
    } else if (error.statusCode) {
      // Forward HTTP errors from Vibe Kanban
      res.status(error.statusCode).json(error.data || {
        success: false,
        message: error.message,
        error: `HTTP ${error.statusCode}`
      });
    } else {
      res.status(502).json({ 
        success: false, 
        message: 'Error communicating with Vibe Kanban backend',
        error: error.message || 'Bad Gateway'
      });
    }
  }
});

// General error handler middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  
  // Always send JSON for API routes
  if (req.path.startsWith('/api')) {
    return res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      needsSetup: true,
      isAuthenticated: false
    });
  }
  
  // For non-API routes, send generic error
  res.status(err.status || 500).send('Internal Server Error');
});

// API fallback routes to prevent 404 spam in console
app.get('/api/files', (req, res) => {
  res.json({ error: 'Files API not available', files: [] });
});

// Catch all unhandled API routes that don't exist  
app.use('/api/*', (req, res) => {
  // Only log actual 404s, not polling attempts
  const isPollingRoute = req.originalUrl.includes('/api/usage/live') || 
                        req.originalUrl.includes('/api/sessions/current');
  
  if (!isPollingRoute) {
    console.warn(`API 404: ${req.method} ${req.originalUrl}`);
  }
  
  res.status(404).json({ error: 'API endpoint not found', path: req.originalUrl });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  } else {
    // In development, redirect to Vite dev server
    res.redirect(`http://localhost:9000`);
  }
});

// Helper function to convert permissions to rwx format
function permToRwx(perm) {
  const r = perm & 4 ? 'r' : '-';
  const w = perm & 2 ? 'w' : '-';
  const x = perm & 1 ? 'x' : '-';
  return r + w + x;
}

async function getFileTree(dirPath, maxDepth = 3, currentDepth = 0, showHidden = true) {
  // Using fsPromises from import
  const items = [];
  
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      // Debug: log all entries including hidden files
   
      
      // Skip only heavy build directories
      if (entry.name === 'node_modules' || 
          entry.name === 'dist' || 
          entry.name === 'build') continue;
      
      const itemPath = path.join(dirPath, entry.name);
      const item = {
        name: entry.name,
        path: itemPath,
        type: entry.isDirectory() ? 'directory' : 'file'
      };
      
      // Get file stats for additional metadata
      try {
        const stats = await fsPromises.stat(itemPath);
        item.size = stats.size;
        item.modified = stats.mtime.toISOString();
        
        // Convert permissions to rwx format
        const mode = stats.mode;
        const ownerPerm = (mode >> 6) & 7;
        const groupPerm = (mode >> 3) & 7;
        const otherPerm = mode & 7;
        item.permissions = ((mode >> 6) & 7).toString() + ((mode >> 3) & 7).toString() + (mode & 7).toString();
        item.permissionsRwx = permToRwx(ownerPerm) + permToRwx(groupPerm) + permToRwx(otherPerm);
      } catch (statError) {
        // If stat fails, provide default values
        item.size = 0;
        item.modified = null;
        item.permissions = '000';
        item.permissionsRwx = '---------';
      }
      
      if (entry.isDirectory() && currentDepth < maxDepth) {
        // Recursively get subdirectories but limit depth
        try {
          // Check if we can access the directory before trying to read it
          await fsPromises.access(item.path, fs.constants.R_OK);
          item.children = await getFileTree(item.path, maxDepth, currentDepth + 1, showHidden);
        } catch (e) {
          // Silently skip directories we can't access (permission denied, etc.)
          item.children = [];
        }
      }
      
      items.push(item);
    }
  } catch (error) {
    // Only log non-permission errors to avoid spam
    if (error.code !== 'EACCES' && error.code !== 'EPERM') {
      console.error('Error reading directory:', error);
    }
  }
  
  return items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}

const PORT = process.env.PORT || 8080;

// Initialize database and start server
async function startServer() {
  try {
    // Initialize authentication database
    await initializeDatabase();
    
    // Get local network IP
    const networkInterfaces = os.networkInterfaces();
    let localIP = 'localhost';
    
    // Find the local network IP (usually en0 on macOS)
    Object.keys(networkInterfaces).forEach(interfaceName => {
      networkInterfaces[interfaceName].forEach(iface => {
        if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168')) {
          localIP = iface.address;
        }
      });
    });
    
    // Listen on all interfaces (0.0.0.0) to allow access from network
    server.listen(PORT, '0.0.0.0', async () => {
      // Server started silently
      
      // Start watching the projects folder for changes
      await setupProjectsWatcher(); // Re-enabled with better-sqlite3
      
      // Setup memory optimization - force GC every 2 minutes if available
      if (global.gc) {
        setInterval(() => {
          const before = v8.getHeapStatistics();
          global.gc();
          const after = v8.getHeapStatistics();
          const freed = (before.used_heap_size - after.used_heap_size) / 1024 / 1024;
          // Silent garbage collection
        }, 2 * 60 * 1000);
        // Memory optimization enabled
      } else {
        // Memory optimization not available
      }
      
      // Start Vibe Kanban cleanup service silently
      cleanupService.start();
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown handling
let isShuttingDown = false;

async function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  
  
  // Stop accepting new connections
  server.close(() => {
  });
  
  // Close WebSocket connections gracefully
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ 
        type: 'server_shutdown',
        message: 'Server is shutting down gracefully' 
      }));
      client.close(1001, 'Server shutting down');
    }
  });
  
  // Stop Vibe Kanban proxy health checks
  if (vibeProxy) {
    vibeProxy.destroy();
  }
  
  // Close shell sessions
  if (global.shellSessions) {
    Object.values(global.shellSessions).forEach(session => {
      if (session && session.pty) {
        session.pty.kill();
      }
    });
  }
  
  // Close database connections
  if (global.db) {
// System-level settings: Codex auth mode override
    try {
      global.db.close();
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }
  }
  
  // Give processes time to clean up
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

// Register shutdown handlers
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't shutdown on unhandled rejections, just log them
});

// MCP cleanup removed - can interfere with normal Claude MCP usage
