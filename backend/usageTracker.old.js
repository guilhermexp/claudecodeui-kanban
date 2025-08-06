import { promises as fs } from 'fs';
import fsSync from 'fs';
import path from 'path';
import os from 'os';
import { initializeDatabase } from '../server/database/db.js';
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
        message_id TEXT
      )
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_logs(timestamp);
      CREATE INDEX IF NOT EXISTS idx_usage_project ON usage_logs(project_path);
      CREATE INDEX IF NOT EXISTS idx_usage_session ON usage_logs(session_id);
    `);
  }

  calculateCost(model, inputTokens, outputTokens, cacheWriteTokens = 0, cacheReadTokens = 0) {
    const pricing = {
      // Claude Opus 4 (modelo atual que você usa)
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
      },
      // Legacy models
      'claude-3-opus-20240229': {
        input: 15.00 / 1_000_000,
        output: 75.00 / 1_000_000,
        cacheWrite: 18.75 / 1_000_000,
        cacheRead: 1.88 / 1_000_000
      },
      'claude-3-5-sonnet-20241022': {
        input: 3.00 / 1_000_000,
        output: 15.00 / 1_000_000,
        cacheWrite: 3.75 / 1_000_000,
        cacheRead: 0.38 / 1_000_000
      }
    };

    // Identificar o modelo correto
    let pricingKey = null;
    if (model.includes('opus-4')) {
      pricingKey = 'claude-opus-4';
    } else if (model.includes('sonnet-4')) {
      pricingKey = 'claude-sonnet-4';
    } else {
      // Fallback para modelos desconhecidos
      pricingKey = 'claude-opus-4'; // Default to Opus 4 pricing
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
      messageId = null
    } = params;

    const cost = this.calculateCost(model, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens);

    const stmt = this.db.prepare(`
      INSERT INTO usage_logs (
        project_path, session_id, model,
        input_tokens, output_tokens, cache_write_tokens, cache_read_tokens,
        cost, request_id, message_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      projectPath, sessionId, model,
      inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens,
      cost, requestId, messageId
    );

    return { cost, totalTokens: inputTokens + outputTokens };
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

  async importFromClaudeProjects() {
    try {
      // Check if Claude projects directory exists
      const exists = await fs.access(this.claudeProjectsPath).then(() => true).catch(() => false);
      if (!exists) {
        console.log('Claude projects directory not found');
        return { imported: 0, errors: 0 };
      }

      // Read all project directories
      const projects = await fs.readdir(this.claudeProjectsPath);
      let totalImported = 0;
      let totalErrors = 0;

      for (const projectDir of projects) {
        const projectPath = path.join(this.claudeProjectsPath, projectDir);
        const stats = await fs.stat(projectPath);
        
        if (!stats.isDirectory()) continue;

        // Decode project path from directory name
        const decodedProjectPath = Buffer.from(projectDir, 'base64').toString('utf-8');

        // Read all JSONL files in project directory
        const files = await fs.readdir(projectPath);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

        for (const jsonlFile of jsonlFiles) {
          const sessionId = path.basename(jsonlFile, '.jsonl');
          const filePath = path.join(projectPath, jsonlFile);

          try {
            const content = await fs.readFile(filePath, 'utf-8');
            const lines = content.trim().split('\n');

            for (const line of lines) {
              if (!line.trim()) continue;
              
              try {
                const data = JSON.parse(line);
                
                // Look for usage data in the message
                if (data.message && data.message.usage) {
                  const usage = data.message.usage;
                  this.trackUsage({
                    projectPath: decodedProjectPath,
                    sessionId: sessionId,
                    model: data.message.model || 'claude-3-5-sonnet-20241022',
                    inputTokens: usage.input_tokens || 0,
                    outputTokens: usage.output_tokens || 0,
                    cacheWriteTokens: usage.cache_creation_input_tokens || 0,
                    cacheReadTokens: usage.cache_read_input_tokens || 0,
                    requestId: data.requestId,
                    messageId: data.message.id
                  });
                  totalImported++;
                }
              } catch (parseError) {
                console.error(`Error parsing line in ${jsonlFile}:`, parseError.message);
                totalErrors++;
              }
            }
          } catch (fileError) {
            console.error(`Error reading file ${jsonlFile}:`, fileError.message);
            totalErrors++;
          }
        }
      }

      return { imported: totalImported, errors: totalErrors };
    } catch (error) {
      console.error('Error importing from Claude projects:', error);
      return { imported: 0, errors: 0, error: error.message };
    }
  }

  // Generate sample data for testing
  async generateSampleData() {
    const models = [
      'claude-3-opus-20240229',
      'claude-3-5-sonnet-20241022',
      'claude-3-haiku-20240307'
    ];

    const projects = [
      '/Users/user/projects/web-app',
      '/Users/user/projects/api-server',
      '/Users/user/projects/mobile-app',
      '/Users/user/projects/data-pipeline'
    ];

    // Generate data for the last 30 days
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Generate 1-5 sessions per day
      const sessionsPerDay = Math.floor(Math.random() * 5) + 1;
      
      for (let j = 0; j < sessionsPerDay; j++) {
        const model = models[Math.floor(Math.random() * models.length)];
        const project = projects[Math.floor(Math.random() * projects.length)];
        const sessionId = `session-${date.toISOString().split('T')[0]}-${j}`;
        
        // Generate 5-20 messages per session
        const messagesPerSession = Math.floor(Math.random() * 16) + 5;
        
        for (let k = 0; k < messagesPerSession; k++) {
          const inputTokens = Math.floor(Math.random() * 2000) + 100;
          const outputTokens = Math.floor(Math.random() * 3000) + 200;
          const cacheWriteTokens = Math.random() > 0.7 ? Math.floor(Math.random() * 500) : 0;
          const cacheReadTokens = Math.random() > 0.5 ? Math.floor(Math.random() * 1000) : 0;
          
          this.trackUsage({
            projectPath: project,
            sessionId: sessionId,
            model: model,
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            cacheWriteTokens: cacheWriteTokens,
            cacheReadTokens: cacheReadTokens,
            requestId: `req-${Date.now()}-${k}`,
            messageId: `msg-${Date.now()}-${k}`
          });
        }
      }
    }

    return { message: 'Sample data generated successfully' };
  }
}

export default UsageTracker;