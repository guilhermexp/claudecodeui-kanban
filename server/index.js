// Load environment variables from .env file
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  console.log('No .env file found or error reading it:', e.message);
}

console.log('PORT from env:', process.env.PORT);

import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import cors from 'cors';
import { promises as fsPromises } from 'fs';
import os from 'os';
import pty from 'node-pty';
import fetch from 'node-fetch';
import mime from 'mime-types';

import { getProjects, getSessions, getSessionMessages, renameProject, deleteSession, deleteProject, addProjectManually, extractProjectDirectory, clearProjectDirectoryCache } from './projects.js';
import { spawnClaude, abortClaudeSession } from './claude-cli.js';
import gitRoutes from './routes/git.js';
import authRoutes from './routes/auth.js';
import mcpRoutes from './routes/mcp.js';
import { initializeDatabase } from './database/db.js';
import { validateApiKey, authenticateToken, authenticateWebSocket } from './middleware/auth.js';

// File system watcher for projects folder
let projectsWatcher = null;
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
    console.log('WebSocket connection attempt to:', info.req.url);
    
    // Extract token from query parameters or headers
    const url = new URL(info.req.url, 'http://localhost');
    const token = url.searchParams.get('token') || 
                  info.req.headers.authorization?.split(' ')[1];
    
    // Verify token
    const user = authenticateWebSocket(token);
    if (!user) {
      console.log('❌ WebSocket authentication failed');
      return false;
    }
    
    // Store user info in the request for later use
    info.req.user = user;
    console.log('✅ WebSocket authenticated for user:', user.username);
    return true;
  }
});

app.use(cors());
app.use(express.json());

// Optional API key validation (if configured)
app.use('/api', validateApiKey);

// Authentication routes (public)
app.use('/api/auth', authRoutes);


// Health check endpoint (public)
app.get('/api/health', (req, res) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      server: 'running',
      database: 'connected',
      vibeKanban: vibeProxy.circuitOpen ? 'unavailable' : 'available'
    }
  };
  
  res.json(healthStatus);
});

// Git API Routes (protected)
app.use('/api/git', authenticateToken, gitRoutes);

// MCP API Routes (protected)
app.use('/api/mcp', authenticateToken, mcpRoutes);

// Static files served after API routes
app.use(express.static(path.join(__dirname, '../dist')));

// API Routes (protected)
app.get('/api/config', authenticateToken, (req, res) => {
  const host = req.headers.host || `${req.hostname}:${PORT}`;
  const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'wss' : 'ws';
  
  console.log('Config API called - Returning host:', host, 'Protocol:', protocol);
  
  res.json({
    serverPort: PORT,
    wsUrl: `${protocol}://${host}`
  });
});

app.get('/api/projects', authenticateToken, async (req, res) => {
  try {
    const projects = await getProjects();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    
    console.log('📄 File read request:', projectName, filePath);
    
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
    
    console.log('🖼️ Binary file serve request:', projectName, filePath);
    
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
    
    console.log('💾 File save request:', projectName, filePath);
    
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
      console.log('📋 Created backup:', backupPath);
    } catch (backupError) {
      console.warn('Could not create backup:', backupError.message);
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
  console.log('🔗 Client connected to:', url);
  
  // Parse URL to get pathname without query parameters
  const urlObj = new URL(url, 'http://localhost');
  const pathname = urlObj.pathname;
  
  if (pathname === '/shell') {
    handleShellConnection(ws, request);
  } else if (pathname === '/ws') {
    handleChatConnection(ws, request);
  } else {
    console.log('❌ Unknown WebSocket path:', pathname);
    ws.close();
  }
});

// Handle chat WebSocket connections
function handleChatConnection(ws, request) {
  console.log('💬 Chat WebSocket connected');
  
  // Store user context for session isolation
  const user = request.user; // From WebSocket authentication
  connectedClients.set(ws, {
    userId: user.userId,
    username: user.username,
    activeProject: null,
    lastActivity: Date.now()
  });
  
  console.log('✅ Chat connection registered for user:', user.username);
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'claude-command') {
        console.log('💬 User message:', data.command || '[Continue/Resume]');
        console.log('📁 Project:', data.options?.projectPath || 'Unknown');
        console.log('🔄 Session:', data.options?.sessionId ? 'Resume' : 'New');
        
        // Register user's active project for smart broadcasting
        if (data.options?.projectPath) {
          const projectName = data.options.projectPath.split('/').pop();
          registerUserProject(ws, projectName);
        }
        
        await spawnClaude(data.command, data.options, ws);
      } else if (data.type === 'abort-session') {
        console.log('🛑 Abort session request:', data.sessionId);
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
    console.log('🔌 Chat client disconnected');
    // Remove from connected clients
    connectedClients.delete(ws);
  });
}

// Handle shell WebSocket connections
function handleShellConnection(ws, request) {
  console.log('🐚 Shell client connected');
  
  // Get user info from authenticated request
  const user = request.user || { userId: 'anonymous', username: 'anonymous' };
  console.log('👤 Shell user:', user.username);
  
  let shellProcess = null;
  let bypassPermissions = false;
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      console.log('📨 Shell message received:', data.type);
      
      if (data.type === 'init') {
        const projectPath = data.projectPath || process.cwd();
        const sessionId = data.sessionId;
        const hasSession = data.hasSession;
        bypassPermissions = data.bypassPermissions || false;
        
        // Shell process will be created fresh for each connection
        // Sessions are managed on the client side now
        
        // Create new shell session
        console.log('🆕 Creating new shell session');
          
          // Send welcome message
          const welcomeMsg = hasSession ? 
            `\x1b[36mResuming Claude session ${sessionId} in: ${projectPath}\x1b[0m\r\n` :
            `\x1b[36mStarting new Claude session in: ${projectPath}\x1b[0m\r\n`;
          
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
            // Build shell command - try multiple possible locations
            const possibleClaudePaths = [
              '/opt/homebrew/bin/claude',
              '/usr/local/bin/claude',
              'claude'
            ];
            
            // We'll try the most likely path first
            let claudeCommand = possibleClaudePaths[0];
            
            if (bypassPermissions) {
              claudeCommand += ' --dangerously-skip-permissions';
            }
            
            if (hasSession && sessionId) {
              claudeCommand += ` --resume ${sessionId}`;
            }
            
            // Start shell using PTY and then execute claude
            console.log('🔧 Starting shell in directory:', projectPath);
            
            // Use the user's default shell to ensure proper environment loading
            const userShell = process.env.SHELL || '/bin/bash';
            console.log('🐚 Using shell:', userShell);
            
            // Create an interactive shell with login flag to load user's profile
            shellProcess = pty.spawn(userShell, ['-l'], {
              name: 'xterm-256color',
              cols: data.cols || 80,
              rows: data.rows || 24,
              cwd: projectPath,
              env: {
                ...process.env,
                // Ensure PATH includes common locations for claude including Homebrew paths
                PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${process.env.PATH || ''}`,
                TERM: 'xterm-256color',
                SHELL: userShell
              }
            });
            
            // After shell starts, execute claude command
            setTimeout(() => {
              console.log('🚀 Executing claude command:', claudeCommand);
              // Clear the terminal first for a clean start
              shellProcess.write('clear\r');
              setTimeout(() => {
                // Show which command we're running
                shellProcess.write(`echo "Starting Claude CLI..."\r`);
                shellProcess.write(`echo "Command: ${claudeCommand}"\r`);
                shellProcess.write(`echo ""\r`);
                // Ensure PATH is set correctly before running claude
                shellProcess.write(`export PATH="/opt/homebrew/bin:$PATH"\r`);
                setTimeout(() => {
                  // Execute the claude command directly
                  shellProcess.write(`${claudeCommand}\r`);
                }, 100);
              }, 100);
            }, 200);
            
            console.log('🟢 Shell process started with PTY, PID:', shellProcess.pid);
            
            // Handle data output
            shellProcess.onData((data) => {
              const output = data.toString();
              // Log errors or important messages (but limit output to reduce spam)
              if (output.includes('zsh: command not found') || output.includes('bash: command not found')) {
                console.log('❌ Shell error: command not found');
              } else if (output.includes('Starting Claude CLI')) {
                console.log('🚀 Claude CLI starting...');
              } else if (output.includes('Welcome to Claude') || output.includes('claude>')) {
                console.log('✅ Claude CLI is running');
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
              console.log('🔚 Shell process exited with code:', exitCode.exitCode, 'signal:', exitCode.signal);
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
          try {
            shellProcess.write(data.data);
          } catch (error) {
            console.error('Error writing to shell:', error);
          }
        } else {
          console.warn('No active shell process to send input to');
        }
      } else if (data.type === 'resize') {
        // Handle terminal resize
        if (shellProcess && shellProcess.resize) {
          console.log('Terminal resize requested:', data.cols, 'x', data.rows);
          shellProcess.resize(data.cols, data.rows);
        }
      } else if (data.type === 'bypassPermissions') {
        // Handle bypass permissions toggle
        bypassPermissions = data.enabled;
        console.log('🔓 Bypass permissions:', bypassPermissions ? 'ENABLED' : 'DISABLED');
        
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
    console.log('🔌 Shell client disconnected');
    
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

// Initialize Vibe Kanban proxy with configuration
const vibeProxy = new VibeKanbanProxy({
  baseUrl: 'http://localhost:8081',
  timeout: 30000, // 30 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  healthCheckInterval: 30000, // 30 seconds
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000 // 1 minute
});

// Proxy VibeKanban API requests to Rust backend
app.use('/api/vibe-kanban', express.json(), async (req, res) => {
  try {
    const vibeKanbanPath = req.path.replace('/api/vibe-kanban', '');
    const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
    const fullPath = `${vibeKanbanPath}${queryString}`;
    
    console.log(`Proxying VibeKanban request: ${req.method} ${req.originalUrl}`);
    
    // Use the robust proxy
    const response = await vibeProxy.makeRequest(fullPath, {
      method: req.method,
      headers: req.headers,
      body: req.body
    });
    
    // Set response headers
    Object.entries(response.headers.raw()).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'content-encoding') {
        res.setHeader(key, value);
      }
    });
    
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
    console.log('✅ Database initialization skipped (testing)');
    
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
      console.log(`Claude Code UI server running on:`)
      console.log(`  - Local: http://localhost:${PORT}`);
      console.log(`  - Network: http://${localIP}:${PORT}`);
      
      // Start watching the projects folder for changes
      await setupProjectsWatcher(); // Re-enabled with better-sqlite3
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
  
  console.log(`\n🛑 ${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new connections
  server.close(() => {
    console.log('✅ HTTP server closed');
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
  console.log('✅ WebSocket connections closed');
  
  // Stop Vibe Kanban proxy health checks
  if (vibeProxy) {
    vibeProxy.destroy();
    console.log('✅ Vibe Kanban proxy stopped');
  }
  
  // Close shell sessions
  if (global.shellSessions) {
    Object.values(global.shellSessions).forEach(session => {
      if (session && session.pty) {
        session.pty.kill();
      }
    });
    console.log('✅ Shell sessions closed');
  }
  
  // Close database connections
  if (global.db) {
    try {
      global.db.close();
      console.log('✅ Database connections closed');
    } catch (error) {
      console.error('❌ Error closing database:', error);
    }
  }
  
  // Give processes time to clean up
  setTimeout(() => {
    console.log('✅ Graceful shutdown completed');
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
