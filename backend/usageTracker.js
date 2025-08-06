import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import Database from 'better-sqlite3';

class UsageTracker {
  constructor() {
    const dbDir = path.join(os.homedir(), '.claudecodeui');
    // Create directory if it doesn't exist
    if (!fsSync.existsSync(dbDir)) {
      fsSync.mkdirSync(dbDir, { recursive: true });
    }
    
    const dbPath = path.join(dbDir, 'usage.db');
    this.db = new Database(dbPath);
    this.initDatabase();
    this.claudeProjectsPath = path.join(os.homedir(), '.claude', 'projects');
  }

  initDatabase() {
    // Create usage tracking tables if they don't exist
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS usage_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        project_path TEXT,
        session_id TEXT,
        model TEXT,
        input_tokens INTEGER DEFAULT 0,
        output_tokens INTEGER DEFAULT 0,
        cache_write_tokens INTEGER DEFAULT 0,
        cache_read_tokens INTEGER DEFAULT 0,
        cost REAL DEFAULT 0,
        request_id TEXT,
        message_id TEXT UNIQUE
      )
    `);

    // Create session duration table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session_durations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_path TEXT,
        session_id TEXT,
        start_time DATETIME,
        end_time DATETIME,
        duration_minutes REAL,
        UNIQUE(project_path, session_id)
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_logs(project_path);
      CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_logs(session_id);
      CREATE INDEX IF NOT EXISTS idx_duration_project ON session_durations(project_path);
      CREATE INDEX IF NOT EXISTS idx_duration_session ON session_durations(session_id);
    `);
  }

  calculateCost(model, inputTokens, outputTokens, cacheWriteTokens = 0, cacheReadTokens = 0) {
    const pricing = {
      // Claude Opus 4 (modelo atual)
      'claude-opus-4': {
        input: 15.00 / 1_000_000,
        output: 75.00 / 1_000_000,
        cacheWrite: 18.75 / 1_000_000,
        cacheRead: 1.50 / 1_000_000
      },
      // Claude Sonnet 4
      'claude-sonnet-4': {
        input: 3.00 / 1_000_000,
        output: 15.00 / 1_000_000,
        cacheWrite: 3.75 / 1_000_000,
        cacheRead: 0.30 / 1_000_000
      }
    };

    // Identificar o modelo correto
    let pricingKey = 'claude-opus-4'; // Default
    if (model && model.includes('opus-4')) {
      pricingKey = 'claude-opus-4';
    } else if (model && model.includes('sonnet-4')) {
      pricingKey = 'claude-sonnet-4';
    }
    
    const modelPricing = pricing[pricingKey];
    
    return (inputTokens * modelPricing.input) +
           (outputTokens * modelPricing.output) +
           (cacheWriteTokens * modelPricing.cacheWrite) +
           (cacheReadTokens * modelPricing.cacheRead);
  }

  trackUsage(params) {
    const {
      projectPath,
      sessionId,
      model,
      inputTokens = 0,
      outputTokens = 0,
      cacheWriteTokens = 0,
      cacheReadTokens = 0,
      requestId = null,
      messageId = null,
      timestamp = null
    } = params;

    const cost = this.calculateCost(model, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens);

    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO usage_logs (
          timestamp, project_path, session_id, model,
          input_tokens, output_tokens, cache_write_tokens, cache_read_tokens,
          cost, request_id, message_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        timestamp || new Date().toISOString(),
        projectPath, sessionId, model,
        inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens,
        cost, requestId, messageId
      );

      return { cost, totalTokens: inputTokens + outputTokens };
    } catch (error) {
      // Ignore duplicate entries
      if (!error.message.includes('UNIQUE constraint')) {
        console.error('Error tracking usage:', error);
      }
      return { cost: 0, totalTokens: 0 };
    }
  }

  clearAllData() {
    try {
      this.db.exec('DELETE FROM usage_logs');
      this.db.exec('DELETE FROM session_durations');
      console.log('All usage data cleared');
      return { success: true, message: 'All data cleared' };
    } catch (error) {
      console.error('Error clearing data:', error);
      throw error;
    }
  }

  async importFromClaudeProjects() {
    try {
      // Check if Claude projects directory exists
      const exists = await fs.access(this.claudeProjectsPath).then(() => true).catch(() => false);
      if (!exists) {
        console.log('Claude projects directory not found at:', this.claudeProjectsPath);
        return { imported: 0, errors: 0, message: 'Claude projects directory not found' };
      }

      // Clear existing data before importing
      this.db.exec('DELETE FROM usage_logs');
      console.log('Cleared existing usage data');

      // Read all project directories
      const projects = await fs.readdir(this.claudeProjectsPath);
      let totalImported = 0;
      let totalErrors = 0;
      let totalFiles = 0;
      
      // Track session durations
      const sessionTimestamps = {}; // sessionId -> { first: timestamp, last: timestamp }
      const messageCountBySession = {}; // Track message count to filter out noise

      console.log(`Found ${projects.length} project directories`);

      for (const projectDir of projects) {
        const projectPath = path.join(this.claudeProjectsPath, projectDir);
        const stats = await fs.stat(projectPath);
        
        if (!stats.isDirectory()) continue;

        // O nome do diretório é o path codificado com - no lugar de /
        // Por exemplo: -Users-guilhermevarela-Documents-projeto
        let decodedProjectPath = projectDir;
        if (projectDir.startsWith('-')) {
          // Convert back to real path
          decodedProjectPath = '/' + projectDir.substring(1).replace(/-/g, '/');
        }

        // Read all JSONL files in project directory
        const files = await fs.readdir(projectPath);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl') && !f.includes('.backup'));

        console.log(`Processing ${jsonlFiles.length} JSONL files in ${decodedProjectPath}`);

        for (const jsonlFile of jsonlFiles) {
          totalFiles++;
          const sessionId = path.basename(jsonlFile, '.jsonl');
          const filePath = path.join(projectPath, jsonlFile);

          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.trim().split('\n');
            
            let actualProjectPath = decodedProjectPath; // Will be updated from cwd
            let sessionKey = `${actualProjectPath}::${sessionId}`;

            for (const line of lines) {
              if (!line.trim()) continue;
              
              try {
                const data = JSON.parse(line);
                
                // Update project path from cwd if available
                if (data.cwd) {
                  actualProjectPath = data.cwd;
                  sessionKey = `${actualProjectPath}::${sessionId}`;
                }
                
                // Track timestamps for session duration
                if (data.timestamp) {
                  if (!sessionTimestamps[sessionKey]) {
                    sessionTimestamps[sessionKey] = {
                      first: data.timestamp,
                      last: data.timestamp,
                      projectPath: actualProjectPath,
                      sessionId: data.sessionId || sessionId
                    };
                    messageCountBySession[sessionKey] = 0;
                  } else {
                    // Update last timestamp
                    if (data.timestamp > sessionTimestamps[sessionKey].last) {
                      sessionTimestamps[sessionKey].last = data.timestamp;
                    }
                    // Update first timestamp if earlier
                    if (data.timestamp < sessionTimestamps[sessionKey].first) {
                      sessionTimestamps[sessionKey].first = data.timestamp;
                    }
                  }
                  
                  // Count messages with actual usage
                  if (data.message && data.message.usage) {
                    messageCountBySession[sessionKey] = (messageCountBySession[sessionKey] || 0) + 1;
                  }
                }
                
                // Look for usage data in the message
                if (data.message && data.message.usage) {
                  const usage = data.message.usage;
                  
                  // Skip messages without actual token usage
                  const hasUsage = usage.input_tokens > 0 || 
                                  usage.output_tokens > 0 || 
                                  usage.cache_creation_input_tokens > 0 || 
                                  usage.cache_read_input_tokens > 0;
                  
                  if (!hasUsage) continue;
                  
                  const result = this.trackUsage({
                    projectPath: actualProjectPath,
                    sessionId: data.sessionId || sessionId,
                    model: data.message.model || 'unknown',
                    inputTokens: usage.input_tokens || 0,
                    outputTokens: usage.output_tokens || 0,
                    cacheWriteTokens: usage.cache_creation_input_tokens || 0,
                    cacheReadTokens: usage.cache_read_input_tokens || 0,
                    requestId: data.requestId || null,
                    messageId: data.message.id || null,
                    timestamp: data.timestamp || null
                  });
                  
                  if (result.cost > 0) {
                    totalImported++;
                  }
                }
              } catch (parseError) {
                // Silently skip lines that aren't valid JSON
                continue;
              }
            }
          } catch (fileError) {
            console.error(`Error reading file ${jsonlFile}:`, fileError.message);
            totalErrors++;
          }
        }
      }
      
      // Store session durations with message count for better estimation
      this.storeSessionDurations(sessionTimestamps, messageCountBySession);

      console.log(`Import complete: ${totalImported} records imported from ${totalFiles} files (${totalErrors} errors)`);
      return { 
        imported: totalImported, 
        errors: totalErrors, 
        filesProcessed: totalFiles,
        message: `Successfully imported ${totalImported} usage records` 
      };
    } catch (error) {
      console.error('Error importing from Claude projects:', error);
      return { imported: 0, errors: 1, error: error.message };
    }
  }

  getUsageStats(startDate = null, endDate = null) {
    let dateFilter = '';
    const params = [];

    if (startDate && endDate) {
      dateFilter = 'WHERE timestamp BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    // Get total stats
    const totals = this.db.prepare(`
      SELECT 
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
        COALESCE(SUM(input_tokens), 0) as total_input_tokens,
        COALESCE(SUM(output_tokens), 0) as total_output_tokens,
        COALESCE(SUM(cache_write_tokens), 0) as total_cache_creation_tokens,
        COALESCE(SUM(cache_read_tokens), 0) as total_cache_read_tokens,
        COUNT(DISTINCT session_id) as total_sessions
      FROM usage_logs
      ${dateFilter}
    `).get(...params) || {};

    // Get stats by model
    const byModel = this.db.prepare(`
      SELECT 
        model,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
        COALESCE(SUM(input_tokens), 0) as input_tokens,
        COALESCE(SUM(output_tokens), 0) as output_tokens,
        COALESCE(SUM(cache_write_tokens), 0) as cache_creation_tokens,
        COALESCE(SUM(cache_read_tokens), 0) as cache_read_tokens,
        COUNT(DISTINCT session_id) as session_count
      FROM usage_logs
      ${dateFilter}
      GROUP BY model
      ORDER BY total_cost DESC
    `).all(...params) || [];

    // Get stats by date
    const byDate = this.db.prepare(`
      SELECT 
        DATE(timestamp) as date,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
        GROUP_CONCAT(DISTINCT model) as models_used
      FROM usage_logs
      ${dateFilter}
      GROUP BY DATE(timestamp)
      ORDER BY date DESC
      LIMIT 30
    `).all(...params) || [];

    // Get stats by project
    const byProject = this.db.prepare(`
      SELECT 
        project_path,
        project_path as project_name,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
        COUNT(DISTINCT session_id) as session_count,
        MAX(timestamp) as last_used
      FROM usage_logs
      ${dateFilter}
      GROUP BY project_path
      ORDER BY total_cost DESC
      LIMIT 20
    `).all(...params) || [];

    // Format the response
    return {
      total_cost: totals.total_cost || 0,
      total_tokens: totals.total_tokens || 0,
      total_input_tokens: totals.total_input_tokens || 0,
      total_output_tokens: totals.total_output_tokens || 0,
      total_cache_creation_tokens: totals.total_cache_creation_tokens || 0,
      total_cache_read_tokens: totals.total_cache_read_tokens || 0,
      total_sessions: totals.total_sessions || 0,
      by_model: byModel || [],
      by_date: byDate.map(d => ({
        ...d,
        models_used: d.models_used ? d.models_used.split(',') : []
      })) || [],
      by_project: byProject || []
    };
  }

  storeSessionDurations(sessionTimestamps, messageCountBySession = {}) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO session_durations (
        project_path, session_id, start_time, end_time, duration_minutes
      ) VALUES (?, ?, ?, ?, ?)
    `);
    
    for (const [key, data] of Object.entries(sessionTimestamps)) {
      const startTime = new Date(data.first);
      const endTime = new Date(data.last);
      const durationMs = endTime - startTime;
      let durationMinutes = durationMs / (1000 * 60); // Convert to minutes
      
      // Skip sessions with very few messages or unrealistic durations
      const messageCount = messageCountBySession[key] || 0;
      if (messageCount < 2) continue; // Skip sessions with less than 2 messages
      
      // REALISTIC CONSTRAINTS:
      // 1. Maximum session duration: 4 hours (240 minutes) - realistic for focused work
      // 2. Minimum time per message: 1 minute (reading + typing)
      // 3. Average time per message: 2-3 minutes for normal interaction
      
      // If duration is 0 or very small, estimate based on messages
      if (durationMinutes < 1) {
        durationMinutes = Math.min(messageCount * 2, 240); // 2 min per message, max 4 hours
      }
      
      // If session is longer than 4 hours, it was probably left open
      if (durationMinutes > 240) {
        // Estimate based on message activity
        // More messages = more active session, but with diminishing returns
        const estimatedMinutes = Math.min(
          messageCount * 2.5, // 2.5 minutes average per message
          240 // Never more than 4 hours
        );
        durationMinutes = estimatedMinutes;
      }
      
      // Additional sanity check: if calculated time is still unrealistic
      if (durationMinutes > 240) {
        durationMinutes = 240; // Hard cap at 4 hours
      }
      
      // Minimum session time if there are messages
      if (messageCount > 0 && durationMinutes < messageCount) {
        durationMinutes = Math.min(messageCount * 1.5, 240); // At least 1.5 min per message
      }
      
      stmt.run(
        data.projectPath,
        data.sessionId,
        data.first,
        data.last,
        durationMinutes
      );
    }
  }

  getUsageTime(startDate = null, endDate = null) {
    let dateFilter = '';
    const params = [];

    if (startDate && endDate) {
      dateFilter = 'WHERE start_time BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    // Get total usage time
    const totalTime = this.db.prepare(`
      SELECT 
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(SUM(duration_minutes) / 60, 0) as total_hours,
        COUNT(DISTINCT session_id) as total_sessions,
        COUNT(DISTINCT DATE(start_time)) as days_used
      FROM session_durations
      ${dateFilter}
    `).get(...params) || {};

    // Get usage time by date
    const byDate = this.db.prepare(`
      SELECT 
        DATE(start_time) as date,
        COALESCE(SUM(duration_minutes), 0) as minutes_used,
        COALESCE(SUM(duration_minutes) / 60, 0) as hours_used,
        COUNT(DISTINCT session_id) as sessions
      FROM session_durations
      ${dateFilter}
      GROUP BY DATE(start_time)
      ORDER BY date DESC
      LIMIT 30
    `).all(...params) || [];

    // Get usage time by project
    const byProject = this.db.prepare(`
      SELECT 
        project_path,
        COALESCE(SUM(duration_minutes), 0) as total_minutes,
        COALESCE(SUM(duration_minutes) / 60, 0) as total_hours,
        COUNT(DISTINCT session_id) as session_count,
        MAX(end_time) as last_used
      FROM session_durations
      ${dateFilter}
      GROUP BY project_path
      ORDER BY total_minutes DESC
      LIMIT 20
    `).all(...params) || [];

    // Get average session duration
    const avgDuration = this.db.prepare(`
      SELECT 
        COALESCE(AVG(duration_minutes), 0) as avg_session_minutes,
        COALESCE(MIN(duration_minutes), 0) as min_session_minutes,
        COALESCE(MAX(duration_minutes), 0) as max_session_minutes
      FROM session_durations
      ${dateFilter}
    `).get(...params) || {};

    return {
      total_minutes: totalTime.total_minutes || 0,
      total_hours: totalTime.total_hours || 0,
      total_sessions: totalTime.total_sessions || 0,
      days_used: totalTime.days_used || 0,
      avg_session_minutes: avgDuration.avg_session_minutes || 0,
      min_session_minutes: avgDuration.min_session_minutes || 0,
      max_session_minutes: avgDuration.max_session_minutes || 0,
      by_date: byDate || [],
      by_project: byProject || []
    };
  }

  getSessionStats(startDate = null, endDate = null) {
    let dateFilter = '';
    const params = [];

    if (startDate && endDate) {
      dateFilter = 'WHERE timestamp BETWEEN ? AND ?';
      params.push(startDate, endDate);
    }

    const sessions = this.db.prepare(`
      SELECT 
        project_path,
        project_path as project_name,
        session_id,
        COALESCE(SUM(cost), 0) as total_cost,
        COALESCE(SUM(input_tokens + output_tokens), 0) as total_tokens,
        MAX(timestamp) as last_used
      FROM usage_logs
      ${dateFilter}
      GROUP BY project_path, session_id
      ORDER BY last_used DESC
      LIMIT 50
    `).all(...params) || [];

    return sessions || [];
  }
}

export default UsageTracker;