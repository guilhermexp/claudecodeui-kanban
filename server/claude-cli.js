import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { createLogger } from './utils/logger.js';
import { getProcessManager } from './lib/ProcessManager.js';

const log = createLogger('CLAUDE-CLI');

const STREAM_MODE = (process.env.LOG_CLAUDE_STREAM || 'compact').toLowerCase();

function logClaudeEvent(ev) {
  if (STREAM_MODE === 'off') return;
  try {
    const type = ev?.type || ev?.event_type || 'unknown';
    if (type === 'system' && ev.subtype === 'init') {
      log.info('▶ init');
      return;
    }
    if (type === 'assistant') {
      // Claude often sends { message: { content: [ {type: 'text', text: '...'}, {type:'tool_use', ...} ] } }
      const content = ev.message?.content ?? ev.content;
      let txt = ev.message?.text || ev.text || '';
      if (!txt && Array.isArray(content)) {
        const firstTextBlock = content.find(b => b && b.type === 'text' && typeof b.text === 'string');
        if (firstTextBlock) txt = firstTextBlock.text;
        else {
          // If no text, summarize blocks for readable logs
          const desc = content
            .map(b => (b?.type === 'tool_use' ? `tool_use:${b.name || 'tool'}` : b?.type || 'block'))
            .slice(0, 3)
            .join(', ');
          txt = `[${desc}]`;
        }
      }
      if (!txt) return;
      const snippet = String(txt).replace(/\s+/g, ' ').slice(0, 140);
      if (STREAM_MODE === 'full') log.info(`assistant: ${snippet}`);
      else if (STREAM_MODE === 'compact') log.info(`▸ assistant: ${snippet}`);
      return;
    }
    if (type === 'tool_use') {
      const name = ev.tool_name || ev.name || 'tool';
      const id = ev.tool_use_id ? `#${ev.tool_use_id.slice(0, 6)}` : '';
      log.info(`⚙︎ tool_use ${name}${id}`);
      return;
    }
    if (type === 'tool_result') {
      const txt = ev.text || ev.message?.text || '';
      const snippet = txt ? `: ${String(txt).replace(/\s+/g, ' ').slice(0, 120)}` : '';
      log.info(`✓ tool_result${snippet}`);
      return;
    }
    if (type === 'error') {
      log.warn(`error: ${ev.error || ev.message || 'unknown'}`);
      return;
    }
    if (type === 'result') {
      log.success('done');
      return;
    }
    // Default fallback for unrecognized events (debug only)
    log.debug(`event: ${type}`);
  } catch {}
}

// Process manager replaces the simple Map for robust lifecycle management
const processManager = getProcessManager({
  maxProcesses: 50,
  gracefulTimeout: 5000,
  forceTimeout: 3000,
  healthCheckInterval: 30000,
  staleProcessTimeout: 300000
});

async function spawnClaude(command, options = {}, ws) {
  log.debug(`spawnClaude called`);
  return new Promise(async (resolve, reject) => {
    const { sessionId, projectPath, cwd, resume, toolsSettings, permissionMode, images, model, initOnly } = options;
    let capturedSessionId = sessionId; // Track session ID throughout the process
    let sessionCreatedSent = false; // Track if we've already sent session-created event
    
    
    // Use tools settings passed from frontend, or defaults
    const settings = toolsSettings || {
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: false
    };
    
    // Build Claude CLI command - use --print mode
    const args = [];
    
    // Add resume flag if resuming
    if (resume && sessionId) {
      args.push('--resume', sessionId);
    }
    
    // Store command to send after process starts
    let finalCommand = command;
    if (command && command.trim()) {
      // Handle images - add them to the command text
      if (images && images.length > 0) {
        const imageUrls = images.map((img, index) => `![Image ${index + 1}](${img})`).join('\n');
        finalCommand = command + '\n\n' + imageUrls;
      }
    } else if (initOnly) {
      // For init-only session creation, send a benign prompt
      finalCommand = 'ready';
    }
    
    // Use cwd (actual project directory) instead of projectPath (Claude's metadata directory)
    // If cwd is 'STANDALONE_MODE', use process.cwd() instead
    const workingDir = (cwd && cwd !== 'STANDALONE_MODE') ? cwd : process.cwd();
    
    // Add basic flags - Claude Code uses stream-json format
    // IMPORTANT: When using --print, --output-format=stream-json requires --verbose
    args.push('--output-format', 'stream-json', '--verbose');
    
    // Add MCP config flag only if MCP servers are configured
    try {
      // Use already imported modules (fs.promises is imported as fs, path, os)
      const fsSync = await import('fs'); // Import synchronous fs methods
      
      // Check for MCP config in ~/.claude.json
      const claudeConfigPath = path.join(os.homedir(), '.claude.json');
      
      
      let hasMcpServers = false;
      
      // Check Claude config for MCP servers
      if (fsSync.existsSync(claudeConfigPath)) {
        try {
          const claudeConfig = JSON.parse(fsSync.readFileSync(claudeConfigPath, 'utf8'));
          
          // Check global MCP servers
          if (claudeConfig.mcpServers && Object.keys(claudeConfig.mcpServers).length > 0) {
            hasMcpServers = true;
          }
          
          // Check project-specific MCP servers
          if (!hasMcpServers && claudeConfig.claudeProjects) {
            const currentProjectPath = process.cwd();
            const projectConfig = claudeConfig.claudeProjects[currentProjectPath];
            if (projectConfig && projectConfig.mcpServers && Object.keys(projectConfig.mcpServers).length > 0) {
              hasMcpServers = true;
            }
          }
        } catch (e) {
        }
      }
      
      
      if (hasMcpServers) {
        // Use Claude config file if it has MCP servers
        let configPath = null;
        
        if (fsSync.existsSync(claudeConfigPath)) {
          try {
            const claudeConfig = JSON.parse(fsSync.readFileSync(claudeConfigPath, 'utf8'));
            
            // Check if we have any MCP servers (global or project-specific)
            const hasGlobalServers = claudeConfig.mcpServers && Object.keys(claudeConfig.mcpServers).length > 0;
            const currentProjectPath = process.cwd();
            const projectConfig = claudeConfig.claudeProjects && claudeConfig.claudeProjects[currentProjectPath];
            const hasProjectServers = projectConfig && projectConfig.mcpServers && Object.keys(projectConfig.mcpServers).length > 0;
            
            if (hasGlobalServers || hasProjectServers) {
              configPath = claudeConfigPath;
            }
          } catch (e) {
            // No valid config found
          }
        }
        
        if (configPath) {
          args.push('--mcp-config', configPath);
        } else {
        }
      }
    } catch (error) {
      // If there's any error checking for MCP configs, don't add the flag
    }
    
    // Add model for new sessions
    if (!resume && model) {
      // Only add model if explicitly provided and it's a valid Claude model
      // Claude accepts aliases like 'sonnet', 'opus', 'haiku' or full model names
      const validClaudeModels = ['sonnet', 'opus', 'haiku', 'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'];
      const isValidModel = validClaudeModels.some(m => model.toLowerCase().includes(m));
      
      if (isValidModel) {
        args.push('--model', model);
      }
      // If no valid model, let Claude use its default
    }
    
    // Add permission mode if specified (works for both new and resumed sessions)
    if (permissionMode && permissionMode !== 'default') {
      args.push('--permission-mode', permissionMode);
    }
    
    // Add tools settings flags
    // Don't use --dangerously-skip-permissions when in plan mode
    if (settings.skipPermissions && permissionMode !== 'plan') {
      args.push('--dangerously-skip-permissions');
    } else {
      // Only add allowed/disallowed tools if not skipping permissions
      
      // Collect all allowed tools, including plan mode defaults
      let allowedTools = [...(settings.allowedTools || [])];
      
      // Add plan mode specific tools
      if (permissionMode === 'plan') {
        const planModeTools = ['Read', 'Task', 'exit_plan_mode', 'TodoRead', 'TodoWrite'];
        // Add plan mode tools that aren't already in the allowed list
        for (const tool of planModeTools) {
          if (!allowedTools.includes(tool)) {
            allowedTools.push(tool);
          }
        }
      }
      
      // Add allowed tools
      if (allowedTools.length > 0) {
        for (const tool of allowedTools) {
          args.push('--allowedTools', tool);
        }
      }
      
      // Add disallowed tools
      if (settings.disallowedTools && settings.disallowedTools.length > 0) {
        for (const tool of settings.disallowedTools) {
          args.push('--disallowedTools', tool);
        }
      }
      
      // Log when skip permissions is disabled due to plan mode
      if (settings.skipPermissions && permissionMode === 'plan') {
      }
    }
    
    // Use node directly with the CLI script
    // The claude wrapper seems to have issues with --print mode
    const nodeCommand = '/opt/homebrew/bin/node';
    const claudeScript = '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js';
    
    log.info(`Starting Claude interactive mode`);
    log.info(`Command: ${finalCommand || 'No command provided'}`);
    log.info(`cmd: ${nodeCommand} ${claudeScript}`);
    log.info(`args: ${args.join(' ')}`);
    log.info(`cwd: ${workingDir}`);
    log.info(`sessionId: ${sessionId || 'new session'}`);
    log.info(`resume: ${resume}`);
    
    const claudeProcess = spawn(nodeCommand, [claudeScript, ...args], {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` // Add homebrew to PATH
      }
    });
    
    log.debug(`spawned PID: ${claudeProcess.pid}`);
    log.debug(`waiting for output...`);
    
    // Send command to stdin after process starts
    if (finalCommand) {
      log.info(`📝 Sending command to stdin: ${finalCommand.substring(0, 100)}...`);
      claudeProcess.stdin.write(finalCommand + '\n');
      // Wait a bit then close stdin to signal end of input
      setTimeout(() => {
        log.info('📝 Closing stdin after command');
        claudeProcess.stdin.end();
      }, 100);
    } else {
      log.info('📝 No command to send, closing stdin');
      claudeProcess.stdin.end();
    }
    
    // Register process with ProcessManager for robust lifecycle management
    const processKey = capturedSessionId || sessionId || Date.now().toString();
    processManager.register(processKey, claudeProcess, {
      command: finalCommand?.substring(0, 100) || 'claude-cli',
      cwd: workingDir,
      type: 'claude-oneshot',
      resume: !!resume,
      model: model,
      permissionMode: permissionMode
    });
    
    // Handle stdout (streaming JSON responses)
    let isFirstOutput = true;
    claudeProcess.stdout.on('data', (data) => {
      if (isFirstOutput) {
        isFirstOutput = false;
        log.info('▶ First stdout received from Claude');
      }
      const rawOutput = data.toString();
      log.info(`▸ Claude output (${rawOutput.length} chars): ${rawOutput.substring(0, 200)}`);
      
      const lines = rawOutput.split('\n').filter(line => line.trim());
      log.info(`📦 Processing ${lines.length} line(s) from Claude`);
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          // Live, compact logging for one-shot mode
          logClaudeEvent(response);
          
          // Capture session ID if it's in the response
          if (response.session_id && !capturedSessionId) {
            capturedSessionId = response.session_id;
            
            // Check if Claude created a different session than requested
            if (sessionId && response.session_id !== sessionId) {
            }
            
            // Update process key with captured session ID
            if (processKey !== capturedSessionId) {
              processManager.unregister(processKey);
              processManager.register(capturedSessionId, claudeProcess, {
                command: finalCommand?.substring(0, 100) || 'claude-cli',
                cwd: workingDir,
                type: 'claude-oneshot',
                resume: !!resume,
                model: model,
                permissionMode: permissionMode,
                sessionIdUpdated: true
              });
            }
            
            // Send session-created event for all new sessions (even when resume fails)
            if (!sessionCreatedSent) {
              sessionCreatedSent = true;
              ws.send(JSON.stringify({
                type: 'session-created',
                sessionId: capturedSessionId,
                wasResumeAttempt: !!sessionId // Flag to indicate this was a resume attempt
              }));
            }
          }
          
          // Send parsed response to WebSocket unless this is an init-only run
          if (!initOnly) {
            ws.send(JSON.stringify({
              type: 'claude-response',
              data: response
            }));
          }
        } catch (parseError) {
          // If not JSON, send as raw text
          if (!initOnly) {
            ws.send(JSON.stringify({
              type: 'claude-output',
              data: line
            }));
          }
        }
      }
    });
    
    // Handle stderr
    let isFirstError = true;
    let stderrBuffer = '';
    claudeProcess.stderr.on('data', (data) => {
      if (isFirstError) {
        isFirstError = false;
        log.error('❌ First stderr received from Claude');
      }
      const errorStr = data.toString();
      log.error(`❌ Claude stderr: ${errorStr}`);
      stderrBuffer += errorStr;
      
      // Check for "No conversation found" error when trying to resume
      if (errorStr.includes('No conversation found with session ID') && resume && sessionId) {
        log.warn(`resume failed for session ${sessionId}; will create a new session`);
        
        // Send a special message indicating session needs to be recreated
        ws.send(JSON.stringify({
          type: 'session-not-found',
          sessionId: sessionId,
          message: 'Previous session expired. A new session will be created.',
          shouldCreateNew: true
        }));
        
        // Don't send the raw error to avoid confusing the user
        return;
      }
      
      ws.send(JSON.stringify({
        type: 'claude-error',
        error: errorStr
      }));
    });
    
    // Handle process completion
    claudeProcess.on('close', async (code) => {
      log.info(`🏁 Claude process closed with code=${code} session=${capturedSessionId || 'none'} hadOutput=${!isFirstOutput}`);
      
      // Clean up process reference using ProcessManager
      const finalSessionId = capturedSessionId || sessionId || processKey;
      processManager.unregister(finalSessionId);
      
      // For initOnly runs, ensure the frontend leaves the "Starting..." state
      if (initOnly && code === 0) {
        try {
          if (capturedSessionId) {
            ws.send(JSON.stringify({ type: 'claude-session-started', sessionId: capturedSessionId, temporary: false }));
          }
          // Don't send a temp session if we don't have a real session ID
        } catch {}
      }

      if (!initOnly) {
        ws.send(JSON.stringify({
          type: 'claude-complete',
          exitCode: code,
          isNewSession: !sessionId && !!command // Flag to indicate this was a new session
        }));
      }
      
      // No cleanup needed for images anymore
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Claude CLI exited with code ${code}`));
      }
    });
    
    // Handle process errors
    claudeProcess.on('error', (error) => {
      log.error(`process error: ${error?.message || error}`);
      
      // Clean up process reference on error using ProcessManager
      const finalSessionId = capturedSessionId || sessionId || processKey;
      processManager.unregister(finalSessionId);
      
      ws.send(JSON.stringify({
        type: 'claude-error',
        error: error.message
      }));
      
      reject(error);
    });
    
    // Handle stdin for interactive mode
    // We operate in --print mode or init-only; stdin should already be closed.
    // Avoid any writes to stdin to prevent ERR_STREAM_WRITE_AFTER_END.
    try { claudeProcess.stdin.end(); } catch {}
  });
}

async function abortClaudeSession(sessionId) {
  log.info(`Aborting Claude session: ${sessionId}`);
  
  try {
    const success = await processManager.terminate(sessionId, 'user-abort');
    if (success) {
      log.info(`Successfully aborted Claude session: ${sessionId}`);
      return true;
    } else {
      log.warn(`No process found for Claude session: ${sessionId}`);
      return false;
    }
  } catch (error) {
    log.error(`Error aborting Claude session ${sessionId}: ${error.message}`);
    return false;
  }
}

export {
  spawnClaude,
  abortClaudeSession
};

// Streaming-mode (persistent) Claude process for overlay
import { spawn as spawnProc } from 'child_process';
import * as fsSync from 'fs';

function buildMcpConfigArg() {
  try {
    const cfgPath = path.join(os.homedir(), '.claude.json');
    if (fsSync.existsSync(cfgPath)) return ['--mcp-config', cfgPath];
  } catch {}
  return [];
}

function spawnClaudeStream(options = {}, ws, onSession) {
  const {
    projectPath,
    cwd,
    sessionId,
    model,
    permissionMode,
    toolsSettings,
    images,
  } = options;

  const workingDir = (cwd && cwd !== 'STANDALONE_MODE') ? cwd : process.cwd();
  // Persistent stream mode (no --print). Input and output via stream-json
  const args = ['--output-format','stream-json','--input-format','stream-json','--verbose'];
  // Default for overlay sessions: bypass permissions so tools podem executar sem prompts
  const skippingPermissions = options.forceBypassPermissions !== false;
  if (skippingPermissions) {
    args.push('--dangerously-skip-permissions');
  }

  if (sessionId) {
    args.push('--resume', sessionId);
  }
  if (model) {
    args.push('--model', model);
  }
  // Add images as CLI flags when provided
  if (Array.isArray(images) && images.length) {
    for (const imgPath of images) {
      if (typeof imgPath === 'string' && imgPath.length) {
        args.push('-i', imgPath);
      }
    }
  }
  // Permissions/tools flags similar to spawnClaude
  // Avoid redundant or conflicting flags: don't send --permission-mode when skipping permissions
  if (!skippingPermissions && permissionMode && permissionMode !== 'default') {
    args.push('--permission-mode', permissionMode);
  }
  if (toolsSettings && Array.isArray(toolsSettings.allowedTools) && toolsSettings.allowedTools.length) {
    for (const t of toolsSettings.allowedTools) args.push('--allowedTools', t);
  }
  if (toolsSettings && Array.isArray(toolsSettings.disallowedTools) && toolsSettings.disallowedTools.length) {
    for (const t of toolsSettings.disallowedTools) args.push('--disallowedTools', t);
  }
  args.push(...buildMcpConfigArg());

  const nodeCommand = '/opt/homebrew/bin/node';
  const claudeScript = '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js';

  log.info('🚀 Starting Claude stream mode');
  log.info(`📦 Args: ${args.join(' ')}`);
  log.info(`📁 CWD: ${workingDir}`);
  log.info(`⚙️ CMD: ${nodeCommand} ${claudeScript}`);
  log.info(`🆔 SessionID: ${sessionId || 'new session'}`);

  const proc = spawnProc(nodeCommand, [claudeScript, ...args], {
    cwd: workingDir,
    stdio: ['pipe','pipe','pipe'],
    env: {
      ...process.env,
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}`
    }
  });

  let capturedId = sessionId || null;
  // Register streaming process with ProcessManager early
  const streamProcessKey = capturedId || `stream-${Date.now()}`;
  
  // Stream buffer for handling partial JSON messages
  let streamBuffer = '';
  
  const onData = (chunk) => {
    const chunkStr = chunk.toString();
    log.info(`📥 Received from Claude (${chunkStr.length} chars): ${chunkStr.substring(0, 200)}...`);
    
    // Append to buffer
    streamBuffer += chunkStr;
    
    // Log the full response if it's an init message for debugging
    if (chunkStr.includes('"type":"system"') && chunkStr.includes('"subtype":"init"')) {
      log.warn(`🔍 FULL INIT RESPONSE: ${chunkStr.substring(0, 500)}`);
    }
    
    // Process complete messages from buffer
    let processedMessages = 0;
    while (streamBuffer.length > 0) {
      // Find the end of a complete JSON message
      const messageEnd = findCompleteMessage(streamBuffer);
      
      if (messageEnd === -1) {
        // No complete message found, wait for more data
        log.debug(`📦 Buffer contains ${streamBuffer.length} chars, waiting for complete message`);
        break;
      }
      
      // Extract complete message
      const messageStr = streamBuffer.substring(0, messageEnd).trim();
      streamBuffer = streamBuffer.substring(messageEnd);
      
      if (messageStr.length === 0) continue;
      
      try {
        const data = JSON.parse(messageStr);
        processedMessages++;
        log.info(`🎯 Parsed event type: ${data.type || data.event_type || 'unknown'} (${processedMessages})`);
        
        if (data.session_id && !capturedId) {
          capturedId = data.session_id;
          log.info(`🆔 Captured session ID: ${capturedId}`);
          // Let the onSession callback handle session communication to avoid duplicates
          try { if (typeof onSession === 'function') onSession(capturedId); } catch {}
        }
        
        // Validate and send message with error recovery
        try { 
          const response = { type: 'claude-response', data };
          
          // Validate the response structure
          if (!validateClaudeResponse(data)) {
            log.warn(`⚠️ Invalid Claude response structure, attempting to sanitize`);
            // Attempt to sanitize the response
            const sanitized = sanitizeClaudeResponse(data);
            if (sanitized) {
              ws.send(JSON.stringify({ type: 'claude-response', data: sanitized }));
            } else {
              ws.send(JSON.stringify({ 
                type: 'claude-error', 
                error: 'Received malformed response from Claude CLI',
                raw_data: typeof data === 'object' ? JSON.stringify(data).substring(0, 500) : String(data).substring(0, 500)
              }));
            }
          } else {
            ws.send(JSON.stringify(response));
          }
        } catch (sendError) {
          log.error(`❌ Failed to send message to WebSocket: ${sendError.message}`);
          // Try to send a simplified error message
          try {
            ws.send(JSON.stringify({ 
              type: 'claude-error', 
              error: 'Failed to forward Claude response',
              details: sendError.message
            }));
          } catch (fallbackError) {
            log.error(`❌ Critical: Cannot send any messages to WebSocket: ${fallbackError.message}`);
          }
        }
        
        // Live, compact logging
        logClaudeEvent(data);
      } catch (e) {
        log.warn(`⚠️ Failed to parse message: ${messageStr.substring(0, 100)}... Error: ${e.message}`);
        // Skip malformed message and continue processing
      }
    }
    
    // Prevent buffer from growing too large (safety mechanism)
    if (streamBuffer.length > 1024 * 1024) { // 1MB limit
      log.error(`🚨 Stream buffer exceeded 1MB, clearing to prevent memory issues`);
      streamBuffer = '';
    }
  };
  
  /**
   * Finds the end position of a complete JSON message in the buffer
   * Claude CLI outputs newline-delimited JSON, so we need to find complete JSON objects
   * @param {string} buffer - The buffer containing potentially partial JSON messages
   * @returns {number} - Position after the complete message, or -1 if no complete message
   */
  function findCompleteMessage(buffer) {
    let braceCount = 0;
    let inString = false;
    let escaped = false;
    
    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];
      
      if (escaped) {
        escaped = false;
        continue;
      }
      
      if (char === '\\' && inString) {
        escaped = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString) {
        if (char === '{') {
          braceCount++;
        } else if (char === '}') {
          braceCount--;
          
          // Complete JSON object found
          if (braceCount === 0) {
            // Look for end of line or end of buffer
            let endPos = i + 1;
            while (endPos < buffer.length && (buffer[endPos] === '\n' || buffer[endPos] === '\r')) {
              endPos++;
            }
            return endPos;
          }
        }
      }
    }
    
    // No complete message found
    return -1;
  }
  
  /**
   * Validates Claude response structure to prevent malformed data from causing issues
   * @param {any} data - The parsed JSON data from Claude
   * @returns {boolean} - True if valid, false if invalid
   */
  function validateClaudeResponse(data) {
    try {
      // Basic structure check
      if (!data || typeof data !== 'object') {
        return false;
      }
      
      // Check for required fields based on common Claude response types
      if (data.type) {
        switch (data.type) {
          case 'system':
            return true; // System messages are generally valid
          case 'stream':
            return data.content !== undefined; // Stream messages should have content
          case 'tool_use':
            return data.name && data.input; // Tool use needs name and input
          case 'tool_result':
            return data.tool_use_id !== undefined; // Tool results need tool_use_id
          default:
            return true; // Unknown types are allowed for forward compatibility
        }
      }
      
      // If no type field, check for other common fields
      if (data.event_type || data.session_id || data.message) {
        return true;
      }
      
      // Empty object or other structures might be valid
      return true;
    } catch (error) {
      log.warn(`Validation error: ${error.message}`);
      return false;
    }
  }
  
  /**
   * Attempts to sanitize malformed Claude responses
   * @param {any} data - The potentially malformed data
   * @returns {object|null} - Sanitized data or null if unable to sanitize
   */
  function sanitizeClaudeResponse(data) {
    try {
      // If data is string, try to parse it
      if (typeof data === 'string') {
        try {
          data = JSON.parse(data);
        } catch {
          // If can't parse, wrap in a generic structure
          return {
            type: 'stream',
            content: data,
            timestamp: Date.now(),
            sanitized: true
          };
        }
      }
      
      // If it's an object, ensure it has basic structure
      if (data && typeof data === 'object') {
        const sanitized = { ...data };
        
        // Ensure it has a type
        if (!sanitized.type) {
          sanitized.type = 'stream';
        }
        
        // Mark as sanitized
        sanitized.sanitized = true;
        sanitized.timestamp = Date.now();
        
        return sanitized;
      }
      
      // For other types, wrap in generic structure
      return {
        type: 'stream',
        content: String(data),
        timestamp: Date.now(),
        sanitized: true,
        original_type: typeof data
      };
    } catch (error) {
      log.error(`Sanitization failed: ${error.message}`);
      return null;
    }
  }
  
  proc.stdout.on('data', onData);
  proc.stderr.on('data', (e) => {
    const errStr = e.toString();
    log.error(`🚨 STDERR: ${errStr}`);
    try { ws.send(JSON.stringify({ type: 'claude-error', error: errStr })); } catch {}
    // Detect resume failures and notify client so it can clear stale session
    if (errStr.includes('No conversation found with session ID')) {
      const m = errStr.match(/session ID[:\s]+([0-9a-fA-F-]{8,})/);
      const sid = m ? m[1] : undefined;
      try { ws.send(JSON.stringify({ type: 'session-not-found', sessionId: sid, message: 'Previous session expired. A new session will be created.', shouldCreateNew: true })); } catch {}
    }
  });
  proc.on('close', (code, signal) => {
    log.warn(`🔴 Claude process closed - code: ${code}, signal: ${signal}`);
    
    // Process any remaining messages in buffer before closing
    if (streamBuffer.length > 0) {
      log.info(`📦 Processing remaining ${streamBuffer.length} chars in buffer before close`);
      
      // Try to find and process any complete messages still in buffer
      let remainingProcessed = 0;
      while (streamBuffer.length > 0) {
        const messageEnd = findCompleteMessage(streamBuffer);
        if (messageEnd === -1) break;
        
        const messageStr = streamBuffer.substring(0, messageEnd).trim();
        streamBuffer = streamBuffer.substring(messageEnd);
        
        if (messageStr.length === 0) continue;
        
        try {
          const data = JSON.parse(messageStr);
          remainingProcessed++;
          log.info(`🎯 Final message processed: ${data.type || data.event_type || 'unknown'}`);
          
          try { 
            ws.send(JSON.stringify({ type: 'claude-response', data })); 
            logClaudeEvent(data);
          } catch {}
        } catch (e) {
          log.warn(`⚠️ Failed to parse final message: ${messageStr.substring(0, 100)}...`);
        }
      }
      
      if (remainingProcessed > 0) {
        log.info(`✅ Processed ${remainingProcessed} final messages from buffer`);
      }
    }
    
    // Clear buffer to prevent memory leaks
    streamBuffer = '';
    
    // Clean up from ProcessManager
    processManager.unregister(streamProcessKey);
    
    try { ws.send(JSON.stringify({ type: 'claude-session-closed', exitCode: code, signal })); } catch {}
  });
  proc.on('error', (error) => {
    log.error(`stream error: ${error?.message || error}`);
    
    // Clear buffer on error to prevent memory leaks
    streamBuffer = '';
    
    // Clean up from ProcessManager on error
    processManager.unregister(streamProcessKey);
    
    try { ws.send(JSON.stringify({ type: 'claude-error', error: error.message })); } catch {}
  });

  const writeMessage = (text, sid = capturedId) => {
    log.info(`✍️ Sending message to Claude: "${String(text).substring(0, 100)}..."`);
    if (!proc.stdin.writable) {
      log.error('❌ stdin not writable!');
      return false;
    }
    
    // Update activity tracking
    processManager.updateActivity(streamProcessKey);
    
    const msg = {
      type: 'user',
      message: { role: 'user', content: String(text) },
      parent_tool_use_id: null,
      session_id: sid || 'default'
    };
    try {
      const msgStr = JSON.stringify(msg);
      log.info(`📨 Writing to stdin: ${msgStr.substring(0, 200)}...`);
      proc.stdin.write(msgStr + '\n');
      log.info('✅ Message sent successfully');
      return true;
    } catch (e) {
      log.error(`❌ Failed to send message: ${e.message}`);
      return false;
    }
  };

  // Register with ProcessManager (streamProcessKey already defined above)
  processManager.register(streamProcessKey, proc, {
    command: 'claude-stream',
    cwd: workingDir,
    type: 'claude-stream',
    model: model,
    permissionMode: permissionMode
  });

  const stop = async () => { 
    try {
      await processManager.terminate(streamProcessKey, 'stream-stop');
    } catch (error) {
      log.error(`Error stopping stream process: ${error.message}`);
      try { proc.kill('SIGTERM'); } catch {}
    }
  };
  return { proc, writeMessage, getSessionId: () => capturedId, stop };
}

export { spawnClaudeStream };
