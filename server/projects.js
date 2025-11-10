import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import readline from 'readline';
import crypto from 'crypto';

// ===========================
// Constants & Configuration
// ===========================
const CONFIG = {
  CLAUDE_DIR: path.join(process.env.HOME || '', '.claude'),
  PROJECTS_SUBDIR: 'projects',
  CONFIG_FILE: 'project-config.json',
  CACHE_DURATIONS: {
    PROJECT_DIR: 2 * 60 * 60 * 1000,     // 2 hours
    PROJECTS_LIST: 30 * 60 * 1000,       // 30 minutes (reduced from 60)
    SESSIONS: 5 * 60 * 1000,              // 5 minutes
  },
  LIMITS: {
    MAX_PROJECT_NAME_LENGTH: 255,
    MAX_DISPLAY_NAME_LENGTH: 100,
    MAX_PATH_LENGTH: 4096,
    MAX_SESSIONS_PER_REQUEST: 100,
    MAX_JSONL_LINE_LENGTH: 5 * 1024 * 1024,  // 5MB per line (was 1MB)
  },
  PERFORMANCE: {
    SESSION_BATCH_SIZE: 10,
    PARALLEL_FILE_READS: 5,
  }
};

// ===========================
// Cache Manager Class
// ===========================
class CacheManager {
  constructor() {
    this.caches = new Map();
  }

  get(cacheKey, itemKey) {
    const cache = this.caches.get(cacheKey);
    if (!cache) return null;
    
    const item = cache.get(itemKey);
    if (!item) return null;
    
    const now = Date.now();
    if (item.expiresAt && now > item.expiresAt) {
      cache.delete(itemKey);
      return null;
    }
    
    return item.value;
  }

  set(cacheKey, itemKey, value, ttl = null) {
    if (!this.caches.has(cacheKey)) {
      this.caches.set(cacheKey, new Map());
    }
    
    const cache = this.caches.get(cacheKey);
    const expiresAt = ttl ? Date.now() + ttl : null;
    
    cache.set(itemKey, { value, expiresAt });
  }

  invalidate(cacheKey, itemKey = null) {
    if (itemKey) {
      const cache = this.caches.get(cacheKey);
      if (cache) cache.delete(itemKey);
    } else {
      this.caches.delete(cacheKey);
    }
  }

  invalidateAll() {
    this.caches.clear();
  }

  getStats() {
    const stats = {};
    for (const [key, cache] of this.caches.entries()) {
      stats[key] = {
        size: cache.size,
        items: Array.from(cache.keys())
      };
    }
    return stats;
  }
}

// ===========================
// Input Validation Utilities
// ===========================
class Validator {
  static sanitizeProjectName(name) {
    if (typeof name !== 'string') {
      throw new ValidationError('Project name must be a string');
    }
    
    // Remove null bytes and control characters
    let sanitized = name.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Limit length
    if (sanitized.length > CONFIG.LIMITS.MAX_PROJECT_NAME_LENGTH) {
      sanitized = sanitized.substring(0, CONFIG.LIMITS.MAX_PROJECT_NAME_LENGTH);
    }
    
    // Prevent directory traversal
    if (sanitized.includes('..') || sanitized.includes('~')) {
      throw new ValidationError('Invalid project name: contains forbidden characters');
    }
    
    return sanitized;
  }

  static sanitizePath(inputPath) {
    if (typeof inputPath !== 'string') {
      throw new ValidationError('Path must be a string');
    }
    
    // Remove null bytes
    let sanitized = inputPath.replace(/\x00/g, '');
    
    // Limit length
    if (sanitized.length > CONFIG.LIMITS.MAX_PATH_LENGTH) {
      throw new ValidationError('Path exceeds maximum length');
    }
    
    // Resolve to absolute path and check it doesn't escape boundaries
    const resolved = path.resolve(sanitized);
    
    return resolved;
  }

  static validateSessionId(sessionId) {
    if (typeof sessionId !== 'string') {
      throw new ValidationError('Session ID must be a string');
    }
    
    // Session IDs should be alphanumeric with hyphens
    if (!/^[a-zA-Z0-9-_]+$/.test(sessionId)) {
      throw new ValidationError('Invalid session ID format');
    }
    
    return sessionId;
  }

  static validateLimit(limit) {
    const num = parseInt(limit, 10);
    if (isNaN(num) || num < 1) return 5;
    return Math.min(num, CONFIG.LIMITS.MAX_SESSIONS_PER_REQUEST);
  }

  static validateOffset(offset) {
    const num = parseInt(offset, 10);
    if (isNaN(num) || num < 0) return 0;
    return num;
  }
}

// ===========================
// Custom Error Classes
// ===========================
class ProjectError extends Error {
  constructor(message, code = 'PROJECT_ERROR') {
    super(message);
    this.name = 'ProjectError';
    this.code = code;
  }
}

class ValidationError extends ProjectError {
  constructor(message) {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

class NotFoundError extends ProjectError {
  constructor(message) {
    super(message, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

// ===========================
// Logger
// ===========================
class Logger {
  static log(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...meta
    };
    
    if (level === 'error') {
      console.error(JSON.stringify(logEntry));
    } else if (level === 'warn') {
      console.warn(JSON.stringify(logEntry));
    } else if (process.env.NODE_ENV !== 'production' || level === 'info') {
      console.log(JSON.stringify(logEntry));
    }
  }

  static error(message, error = null) {
    this.log('error', message, { 
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code
      } : undefined 
    });
  }

  static warn(message, meta = {}) {
    this.log('warn', message, meta);
  }

  static info(message, meta = {}) {
    this.log('info', message, meta);
  }

  static debug(message, meta = {}) {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, meta);
    }
  }
}

// ===========================
// File System Utilities
// ===========================
class FileSystemUtils {
  static async ensureDirectory(dirPath) {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw new ProjectError(`Failed to create directory: ${error.message}`);
      }
    }
  }

  static async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  static async readJsonFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw new ProjectError(`Failed to read JSON file: ${error.message}`);
    }
  }

  static async writeJsonFile(filePath, data) {
    try {
      const content = JSON.stringify(data, null, 2);
      await fs.writeFile(filePath, content, 'utf8');
    } catch (error) {
      throw new ProjectError(`Failed to write JSON file: ${error.message}`);
    }
  }

  static async* readJsonLines(filePath) {
    const fileStream = fsSync.createReadStream(filePath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    for await (const line of rl) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Security: limit line length
      if (trimmed.length > CONFIG.LIMITS.MAX_JSONL_LINE_LENGTH) {
        // Reduce noise: log as debug instead of warn
        Logger.debug('Skipping oversized JSONL line', { 
          filePath, 
          lineLength: trimmed.length 
        });
        continue;
      }

      try {
        yield JSON.parse(trimmed);
      } catch (error) {
        Logger.debug('Failed to parse JSONL line', { filePath, error: error.message });
      }
    }
  }
}

// ===========================
// Project Manager Class
// ===========================
class ProjectManager {
  constructor() {
    this.cache = new CacheManager();
    this.configPath = path.join(CONFIG.CLAUDE_DIR, CONFIG.CONFIG_FILE);
    this.projectsDir = path.join(CONFIG.CLAUDE_DIR, CONFIG.PROJECTS_SUBDIR);
  }

  // Configuration Management
  async loadConfig() {
    const cached = this.cache.get('config', 'main');
    if (cached) return cached;

    const config = await FileSystemUtils.readJsonFile(this.configPath) || {};
    this.cache.set('config', 'main', config, CONFIG.CACHE_DURATIONS.PROJECTS_LIST);
    return config;
  }

  async saveConfig(config) {
    await FileSystemUtils.writeJsonFile(this.configPath, config);
    this.cache.invalidate('config');
    this.cache.invalidate('projects'); // Invalidate projects cache when config changes
  }

  // Display Name Generation
  async generateDisplayName(projectName, projectPath = null) {
    const actualPath = projectPath || projectName.replace(/-/g, '/');
    
    // Try package.json first
    try {
      const packageJsonPath = path.join(actualPath, 'package.json');
      const packageJson = await FileSystemUtils.readJsonFile(packageJsonPath);
      if (packageJson?.name) {
        return packageJson.name;
      }
    } catch {
      // Ignore and fall back to path-based naming
    }

    // Generate from path
    if (actualPath.startsWith('/')) {
      const parts = actualPath.split('/').filter(Boolean);
      if (parts.length > 3) {
        return `.../${parts.slice(-2).join('/')}`;
      }
      return actualPath;
    }
    
    return actualPath;
  }

  // Project Directory Extraction
  async extractProjectDirectory(projectName) {
    const sanitizedName = Validator.sanitizeProjectName(projectName);
    
    // Check cache
    const cached = this.cache.get('projectDirs', sanitizedName);
    if (cached) return cached;

    const projectDir = path.join(this.projectsDir, sanitizedName);
    
    // Check if directory exists
    if (!await FileSystemUtils.fileExists(projectDir)) {
      const fallback = sanitizedName.replace(/-/g, '/');
      this.cache.set('projectDirs', sanitizedName, fallback, CONFIG.CACHE_DURATIONS.PROJECT_DIR);
      return fallback;
    }

    try {
      const files = await fs.readdir(projectDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      
      if (jsonlFiles.length === 0) {
        const fallback = sanitizedName.replace(/-/g, '/');
        this.cache.set('projectDirs', sanitizedName, fallback, CONFIG.CACHE_DURATIONS.PROJECT_DIR);
        return fallback;
      }

      // Analyze working directories from sessions
      const cwdStats = new Map();
      let latestCwd = null;
      let latestTimestamp = 0;

      for (const file of jsonlFiles.slice(0, CONFIG.PERFORMANCE.PARALLEL_FILE_READS)) {
        const filePath = path.join(projectDir, file);
        
        for await (const entry of FileSystemUtils.readJsonLines(filePath)) {
          if (entry.cwd) {
            cwdStats.set(entry.cwd, (cwdStats.get(entry.cwd) || 0) + 1);
            
            const timestamp = new Date(entry.timestamp || 0).getTime();
            if (timestamp > latestTimestamp) {
              latestTimestamp = timestamp;
              latestCwd = entry.cwd;
            }
          }
        }
      }

      // Determine best working directory
      let result;
      if (cwdStats.size === 0) {
        result = sanitizedName.replace(/-/g, '/');
      } else if (cwdStats.size === 1) {
        result = Array.from(cwdStats.keys())[0];
      } else {
        // Use most recent if it has reasonable usage
        const maxCount = Math.max(...cwdStats.values());
        const recentCount = cwdStats.get(latestCwd) || 0;
        
        if (recentCount >= maxCount * 0.25) {
          result = latestCwd;
        } else {
          // Find most used
          for (const [cwd, count] of cwdStats.entries()) {
            if (count === maxCount) {
              result = cwd;
              break;
            }
          }
        }
      }

      result = result || sanitizedName.replace(/-/g, '/');
      this.cache.set('projectDirs', sanitizedName, result, CONFIG.CACHE_DURATIONS.PROJECT_DIR);
      return result;

    } catch (error) {
      Logger.error(`Error extracting project directory for ${sanitizedName}`, error);
      const fallback = sanitizedName.replace(/-/g, '/');
      this.cache.set('projectDirs', sanitizedName, fallback, CONFIG.CACHE_DURATIONS.PROJECT_DIR);
      return fallback;
    }
  }

  // Get All Projects
  async getProjects() {
    // Check cache
    const cached = this.cache.get('projects', 'list');
    if (cached) return cached;

    const config = await this.loadConfig();
    const projects = [];
    const existingProjects = new Set();

    try {
      // Ensure projects directory exists
      await FileSystemUtils.ensureDirectory(this.projectsDir);
      
      // Read existing project directories
      const entries = await fs.readdir(this.projectsDir, { withFileTypes: true });
      
      // Process directories in parallel batches
      const directories = entries.filter(e => e.isDirectory());
      const batchSize = CONFIG.PERFORMANCE.PARALLEL_FILE_READS;
      
      for (let i = 0; i < directories.length; i += batchSize) {
        const batch = directories.slice(i, i + batchSize);
        const batchPromises = batch.map(async (entry) => {
          existingProjects.add(entry.name);
          
          try {
            const actualDir = await this.extractProjectDirectory(entry.name);
            const customName = config[entry.name]?.displayName;
            const autoName = await this.generateDisplayName(entry.name, actualDir);
            
            const project = {
              name: entry.name,
              path: actualDir,
              displayName: customName || autoName,
              fullPath: actualDir,
              isCustomName: !!customName,
              sessions: [],
              sessionMeta: { total: 0, hasMore: false }
            };

            // Load most recent session for sorting
            try {
              const sessions = await this.getSessions(entry.name, 1, 0);
              if (sessions.sessions.length > 0) {
                project.sessions = sessions.sessions;
                project.sessionMeta = {
                  total: sessions.total,
                  hasMore: sessions.hasMore
                };
                project.lastActivity = sessions.sessions[0].updated_at;
              }
            } catch (error) {
              Logger.debug(`Failed to load sessions for ${entry.name}`, { error: error.message });
            }

            return project;
          } catch (error) {
            Logger.error(`Error processing project ${entry.name}`, error);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        projects.push(...batchResults.filter(p => p !== null));
      }

      // Add manually configured projects and clean up orphaned entries
      let configModified = false;
      for (const [projectName, projectConfig] of Object.entries(config)) {
        if (!existingProjects.has(projectName)) {
          // Check if the project directory should exist
          const projectDir = path.join(this.projectsDir, projectName);
          
          if (projectConfig.manuallyAdded) {
            // For manually added projects, create directory if missing
            if (!await FileSystemUtils.fileExists(projectDir)) {
              Logger.info(`Creating missing directory for manually added project ${projectName}`);
              await FileSystemUtils.ensureDirectory(projectDir);
            }
            
            const actualDir = projectConfig.originalPath || 
                             await this.extractProjectDirectory(projectName);
            
            projects.push({
              name: projectName,
              path: actualDir,
              displayName: projectConfig.displayName || 
                          await this.generateDisplayName(projectName, actualDir),
              fullPath: actualDir,
              isCustomName: !!projectConfig.displayName,
              isManuallyAdded: true,
              sessions: [],
              sessionMeta: { total: 0, hasMore: false }
            });
          } else {
            // Clean up orphaned config entries for non-manual projects
            Logger.info(`Cleaning up orphaned config for ${projectName}`);
            delete config[projectName];
            configModified = true;
          }
        }
      }
      
      // Save config if modified
      if (configModified) {
        await this.saveConfig(config);
      }

      // Sort by most recent activity
      projects.sort((a, b) => {
        const aTime = a.lastActivity || 0;
        const bTime = b.lastActivity || 0;
        return new Date(bTime) - new Date(aTime);
      });

      // Cache results
      this.cache.set('projects', 'list', projects, CONFIG.CACHE_DURATIONS.PROJECTS_LIST);
      return projects;

    } catch (error) {
      Logger.error('Error getting projects', error);
      throw new ProjectError('Failed to retrieve projects');
    }
  }

  // Get Sessions for a Project
  async getSessions(projectName, limit = 5, offset = 0) {
    const sanitizedName = Validator.sanitizeProjectName(projectName);
    const validLimit = Validator.validateLimit(limit);
    const validOffset = Validator.validateOffset(offset);
    
    const cacheKey = `sessions_${sanitizedName}_${validLimit}_${validOffset}`;
    const cached = this.cache.get('sessions', cacheKey);
    if (cached) return cached;

    const projectDir = path.join(this.projectsDir, sanitizedName);

    try {
      if (!await FileSystemUtils.fileExists(projectDir)) {
        return { sessions: [], hasMore: false, total: 0 };
      }

      const files = await fs.readdir(projectDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      
      if (jsonlFiles.length === 0) {
        return { sessions: [], hasMore: false, total: 0 };
      }

      // Get file stats for sorting
      const filesWithStats = await Promise.all(
        jsonlFiles.map(async (file) => {
          const filePath = path.join(projectDir, file);
          const stats = await fs.stat(filePath);
          return { file, mtime: stats.mtime };
        })
      );

      // Sort by modification time (newest first)
      filesWithStats.sort((a, b) => b.mtime - a.mtime);

      const allSessions = new Map();
      
      // Process files
      for (const { file } of filesWithStats) {
        const filePath = path.join(projectDir, file);
        const sessions = await this.parseJsonlSessions(filePath);
        
        // Merge sessions
        for (const session of sessions) {
          if (!allSessions.has(session.id)) {
            allSessions.set(session.id, session);
          }
        }

        // Early exit if we have enough
        if (allSessions.size >= validLimit + validOffset) {
          break;
        }
      }

      // Sort and paginate
      const sortedSessions = Array.from(allSessions.values())
        .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
      
      const total = sortedSessions.length;
      const paginatedSessions = sortedSessions.slice(validOffset, validOffset + validLimit);
      
      const result = {
        sessions: paginatedSessions.map(s => ({
          ...s,
          updated_at: s.updated_at || s.lastActivity,
          created_at: s.created_at || s.lastActivity
        })),
        hasMore: validOffset + validLimit < total,
        total,
        offset: validOffset,
        limit: validLimit
      };

      // Cache result
      this.cache.set('sessions', cacheKey, result, CONFIG.CACHE_DURATIONS.SESSIONS);
      return result;

    } catch (error) {
      Logger.error(`Error getting sessions for ${sanitizedName}`, error);
      return { sessions: [], hasMore: false, total: 0 };
    }
  }

  // Parse JSONL Sessions File
  async parseJsonlSessions(filePath) {
    const sessions = new Map();
    
    try {
      for await (const entry of FileSystemUtils.readJsonLines(filePath)) {
        if (!entry.sessionId) continue;

        if (!sessions.has(entry.sessionId)) {
          sessions.set(entry.sessionId, {
            id: entry.sessionId,
            summary: 'New Session',
            messageCount: 0,
            lastActivity: new Date(),
            cwd: entry.cwd || ''
          });
        }

        const session = sessions.get(entry.sessionId);

        // Update summary
        if (entry.type === 'summary' && entry.summary) {
          session.summary = entry.summary;
        } else if (entry.message?.role === 'user' && 
                   entry.message?.content && 
                   session.summary === 'New Session') {
          const content = String(entry.message.content);
          if (!content.startsWith('<command-name>')) {
            session.summary = content.length > 50 
              ? content.substring(0, 50) + '...' 
              : content;
          }
        }

        // Update activity
        if (entry.timestamp) {
          session.lastActivity = new Date(entry.timestamp);
        }

        // Track messages
        if (!session.hasMessages && entry.message) {
          session.hasMessages = true;
          session.messageCount = 1;
        }
      }

      return Array.from(sessions.values()).map(session => ({
        ...session,
        lastActivity: session.lastActivity.toISOString(),
        updated_at: session.lastActivity.toISOString(),
        created_at: session.lastActivity.toISOString()
      }));

    } catch (error) {
      Logger.error(`Error parsing JSONL file ${filePath}`, error);
      return [];
    }
  }

  // Get Session Messages
  async getSessionMessages(projectName, sessionId) {
    const sanitizedName = Validator.sanitizeProjectName(projectName);
    const validSessionId = Validator.validateSessionId(sessionId);
    
    const projectDir = path.join(this.projectsDir, sanitizedName);
    
    try {
      const files = await fs.readdir(projectDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      
      const messages = [];
      
      for (const file of jsonlFiles) {
        const filePath = path.join(projectDir, file);
        
        for await (const entry of FileSystemUtils.readJsonLines(filePath)) {
          if (entry.sessionId === validSessionId) {
            messages.push(entry);
          }
        }
      }
      
      // Sort by timestamp
      messages.sort((a, b) => 
        new Date(a.timestamp || 0) - new Date(b.timestamp || 0)
      );
      
      return messages;
      
    } catch (error) {
      Logger.error(`Error getting messages for session ${validSessionId}`, error);
      return [];
    }
  }

  // Project Operations
  async renameProject(projectName, newDisplayName) {
    const sanitizedName = Validator.sanitizeProjectName(projectName);
    
    const config = await this.loadConfig();
    
    if (!newDisplayName || newDisplayName.trim() === '') {
      delete config[sanitizedName];
    } else {
      const sanitizedDisplayName = newDisplayName.trim()
        .substring(0, CONFIG.LIMITS.MAX_DISPLAY_NAME_LENGTH);
      
      if (!config[sanitizedName]) {
        config[sanitizedName] = {};
      }
      
      config[sanitizedName].displayName = sanitizedDisplayName;
    }
    
    await this.saveConfig(config);
    this.cache.invalidate('projects');
    
    return true;
  }

  async deleteSession(projectName, sessionId) {
    const sanitizedName = Validator.sanitizeProjectName(projectName);
    const validSessionId = Validator.validateSessionId(sessionId);
    
    const projectDir = path.join(this.projectsDir, sanitizedName);
    
    try {
      const files = await fs.readdir(projectDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));
      
      if (jsonlFiles.length === 0) {
        throw new NotFoundError('No session files found');
      }
      
      for (const file of jsonlFiles) {
        const filePath = path.join(projectDir, file);
        const content = await fs.readFile(filePath, 'utf8');
        const lines = content.split('\n').filter(line => line.trim());
        
        const hasSession = lines.some(line => {
          try {
            const data = JSON.parse(line);
            return data.sessionId === validSessionId;
          } catch {
            return false;
          }
        });
        
        if (hasSession) {
          const filteredLines = lines.filter(line => {
            try {
              const data = JSON.parse(line);
              return data.sessionId !== validSessionId;
            } catch {
              return true; // Keep malformed lines
            }
          });
          
          await fs.writeFile(
            filePath, 
            filteredLines.join('\n') + (filteredLines.length > 0 ? '\n' : '')
          );
          
          // Invalidate caches
          this.cache.invalidate('sessions');
          this.cache.invalidate('projects');
          
          return true;
        }
      }
      
      throw new NotFoundError(`Session ${validSessionId} not found`);
      
    } catch (error) {
      if (error instanceof NotFoundError) throw error;
      Logger.error(`Error deleting session ${validSessionId}`, error);
      throw new ProjectError('Failed to delete session');
    }
  }

  async isProjectEmpty(projectName) {
    try {
      const result = await this.getSessions(projectName, 1, 0);
      return result.total === 0;
    } catch {
      return false;
    }
  }

  async deleteProject(projectName) {
    const sanitizedName = Validator.sanitizeProjectName(projectName);
    const projectDir = path.join(this.projectsDir, sanitizedName);
    
    try {
      const isEmpty = await this.isProjectEmpty(sanitizedName);
      if (!isEmpty) {
        throw new ValidationError('Cannot delete project with existing sessions');
      }
      
      await fs.rm(projectDir, { recursive: true, force: true });
      
      const config = await this.loadConfig();
      delete config[sanitizedName];
      await this.saveConfig(config);
      
      // Invalidate all project-related caches
      this.cache.invalidate('projects');
      this.cache.invalidate('sessions');
      this.cache.invalidate('projectDirs', sanitizedName);
      
      return true;
      
    } catch (error) {
      if (error instanceof ValidationError) throw error;
      Logger.error(`Error deleting project ${sanitizedName}`, error);
      throw new ProjectError('Failed to delete project');
    }
  }

  async deleteProjectCompletely(projectName) {
    const sanitizedName = Validator.sanitizeProjectName(projectName);
    const projectDir = path.join(this.projectsDir, sanitizedName);
    
    try {
      await fs.rm(projectDir, { recursive: true, force: true });
      
      const config = await this.loadConfig();
      delete config[sanitizedName];
      await this.saveConfig(config);
      
      // Invalidate all project-related caches
      this.cache.invalidate('projects');
      this.cache.invalidate('sessions');
      this.cache.invalidate('projectDirs', sanitizedName);
      
      return true;
      
    } catch (error) {
      Logger.error(`Error deleting project completely ${sanitizedName}`, error);
      throw new ProjectError('Failed to delete project');
    }
  }

  async addProjectManually(projectPath, displayName = null) {
    const absolutePath = Validator.sanitizePath(projectPath);
    
    if (!await FileSystemUtils.fileExists(absolutePath)) {
      throw new NotFoundError(`Path does not exist: ${absolutePath}`);
    }
    
    // Generate project name
    const projectName = absolutePath.replace(/\//g, '-');
    const sanitizedName = Validator.sanitizeProjectName(projectName);
    
    // Check if already exists
    const config = await this.loadConfig();
    const projectDir = path.join(this.projectsDir, sanitizedName);
    
    // If project is in config but directory doesn't exist, clean it up
    if (config[sanitizedName] && !await FileSystemUtils.fileExists(projectDir)) {
      Logger.info(`Cleaning up orphaned project config for ${sanitizedName}`);
      delete config[sanitizedName];
      await this.saveConfig(config);
    }
    
    if (await FileSystemUtils.fileExists(projectDir)) {
      throw new ValidationError(`Project already exists for path: ${absolutePath}`);
    }
    
    if (config[sanitizedName]) {
      throw new ValidationError(`Project already configured for path: ${absolutePath}`);
    }
    
    // Add to config
    config[sanitizedName] = {
      manuallyAdded: true,
      originalPath: absolutePath
    };
    
    if (displayName) {
      config[sanitizedName].displayName = displayName.trim()
        .substring(0, CONFIG.LIMITS.MAX_DISPLAY_NAME_LENGTH);
    }
    
    await this.saveConfig(config);
    this.cache.invalidate('projects');
    
    return {
      name: sanitizedName,
      path: absolutePath,
      fullPath: absolutePath,
      displayName: displayName || await this.generateDisplayName(sanitizedName, absolutePath),
      isManuallyAdded: true,
      sessions: []
    };
  }

  // Cache Management
  clearCache() {
    this.cache.invalidateAll();
  }

  getCacheStats() {
    return this.cache.getStats();
  }
}

// ===========================
// Singleton Instance
// ===========================
let projectManagerInstance = null;

function getProjectManager() {
  if (!projectManagerInstance) {
    projectManagerInstance = new ProjectManager();
  }
  return projectManagerInstance;
}

// ===========================
// Exported API (Backward Compatible)
// ===========================
const manager = getProjectManager();

export async function getProjects() {
  return manager.getProjects();
}

export async function getSessions(projectName, limit = 5, offset = 0) {
  return manager.getSessions(projectName, limit, offset);
}

export async function getSessionMessages(projectName, sessionId) {
  return manager.getSessionMessages(projectName, sessionId);
}

export async function parseJsonlSessions(filePath) {
  return manager.parseJsonlSessions(filePath);
}

export async function renameProject(projectName, newDisplayName) {
  return manager.renameProject(projectName, newDisplayName);
}

export async function deleteSession(projectName, sessionId) {
  return manager.deleteSession(projectName, sessionId);
}

export async function isProjectEmpty(projectName) {
  return manager.isProjectEmpty(projectName);
}

export async function deleteProject(projectName) {
  return manager.deleteProject(projectName);
}

export async function deleteProjectCompletely(projectName) {
  return manager.deleteProjectCompletely(projectName);
}

export async function addProjectManually(projectPath, displayName = null) {
  return manager.addProjectManually(projectPath, displayName);
}

export async function loadProjectConfig() {
  return manager.loadConfig();
}

export async function saveProjectConfig(config) {
  return manager.saveConfig(config);
}

export async function extractProjectDirectory(projectName) {
  return manager.extractProjectDirectory(projectName);
}

export function clearProjectDirectoryCache() {
  manager.clearCache();
}

// Export manager for advanced usage
export { getProjectManager, ProjectError, ValidationError, NotFoundError };
