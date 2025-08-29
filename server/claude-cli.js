import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

let activeClaudeProcesses = new Map(); // Track active processes by session ID

async function spawnClaude(command, options = {}, ws) {
  console.log('spawnClaude called with:', { command: command?.substring(0, 50), options });
  return new Promise(async (resolve, reject) => {
    const { sessionId, projectPath, cwd, resume, toolsSettings, permissionMode, images, model } = options;
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
    
    // Add print flag with command
    let finalCommand = command;
    if (command && command.trim()) {
      // Handle images - add them to the command text
      if (images && images.length > 0) {
        const imageUrls = images.map((img, index) => `![Image ${index + 1}](${img})`).join('\n');
        finalCommand = command + '\n\n' + imageUrls;
      }
      args.push('--print', finalCommand);
    }
    
    // Use cwd (actual project directory) instead of projectPath (Claude's metadata directory)
    // If cwd is 'STANDALONE_MODE', use process.cwd() instead
    const workingDir = (cwd && cwd !== 'STANDALONE_MODE') ? cwd : process.cwd();
    
    // Add basic flags - Claude Code uses stream-json format
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
        console.log('Skip permissions disabled in plan mode');
      }
    }
    
    // Use node directly with the CLI script
    // The claude wrapper seems to have issues with --print mode
    const nodeCommand = '/opt/homebrew/bin/node';
    const claudeScript = '/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js';
    
    console.log('Spawning Claude with command:', nodeCommand, claudeScript, args.join(' '));
    console.log('Working directory:', workingDir);
    
    const claudeProcess = spawn(nodeCommand, [claudeScript, ...args], {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { 
        ...process.env,
        PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH}` // Add homebrew to PATH
      }
    });
    
    console.log(`[SERVER] Claude process spawned with PID: ${claudeProcess.pid}`);
    console.log(`[SERVER] Waiting for Claude CLI output...`);
    
    // Close stdin immediately since we're using --print mode
    claudeProcess.stdin.end();
    
    // Store process reference for potential abort
    const processKey = capturedSessionId || sessionId || Date.now().toString();
    activeClaudeProcesses.set(processKey, claudeProcess);
    
    // Handle stdout (streaming JSON responses)
    let isFirstOutput = true;
    claudeProcess.stdout.on('data', (data) => {
      if (isFirstOutput) {
        isFirstOutput = false;
        console.log('[SERVER] First stdout output received from Claude CLI');
      }
      const rawOutput = data.toString();
      console.log('[SERVER] Claude stdout raw:', rawOutput.substring(0, 200)); // Log first 200 chars
      
      const lines = rawOutput.split('\n').filter(line => line.trim());
      console.log(`[SERVER] Processing ${lines.length} lines from Claude output`);
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          
          // Capture session ID if it's in the response
          if (response.session_id && !capturedSessionId) {
            capturedSessionId = response.session_id;
            
            // Check if Claude created a different session than requested
            if (sessionId && response.session_id !== sessionId) {
            }
            
            // Update process key with captured session ID
            if (processKey !== capturedSessionId) {
              activeClaudeProcesses.delete(processKey);
              activeClaudeProcesses.set(capturedSessionId, claudeProcess);
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
          
          // Send parsed response to WebSocket
          ws.send(JSON.stringify({
            type: 'claude-response',
            data: response
          }));
        } catch (parseError) {
          // If not JSON, send as raw text
          ws.send(JSON.stringify({
            type: 'claude-output',
            data: line
          }));
        }
      }
    });
    
    // Handle stderr
    let isFirstError = true;
    let stderrBuffer = '';
    claudeProcess.stderr.on('data', (data) => {
      if (isFirstError) {
        isFirstError = false;
      }
      const errorStr = data.toString();
      console.error('Claude CLI stderr:', errorStr);
      stderrBuffer += errorStr;
      
      // Check for "No conversation found" error when trying to resume
      if (errorStr.includes('No conversation found with session ID') && resume && sessionId) {
        console.log(`Session ${sessionId} not found in Claude CLI, will create new session on next message`);
        
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
      console.log(`[SERVER] Claude process closed with code: ${code}`);
      console.log(`[SERVER] Session ID captured: ${capturedSessionId || 'none'}`);
      console.log(`[SERVER] Output received: ${!isFirstOutput}`);
      
      // Clean up process reference
      const finalSessionId = capturedSessionId || sessionId || processKey;
      activeClaudeProcesses.delete(finalSessionId);
      
      ws.send(JSON.stringify({
        type: 'claude-complete',
        exitCode: code,
        isNewSession: !sessionId && !!command // Flag to indicate this was a new session
      }));
      
      // No cleanup needed for images anymore
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Claude CLI exited with code ${code}`));
      }
    });
    
    // Handle process errors
    claudeProcess.on('error', (error) => {
      console.error('Claude CLI process error:', error);
      
      // Clean up process reference on error
      const finalSessionId = capturedSessionId || sessionId || processKey;
      activeClaudeProcesses.delete(finalSessionId);
      
      ws.send(JSON.stringify({
        type: 'claude-error',
        error: error.message
      }));
      
      reject(error);
    });
    
    // Handle stdin for interactive mode
    if (command && command.trim() !== '') {
      // For --print mode with arguments, we don't need to write to stdin
      claudeProcess.stdin.end();
    } else if (command === '') {
      // Empty command - just close stdin to let Claude initialize
      claudeProcess.stdin.end();
    } else {
      // For interactive mode, we need to write the command to stdin if provided later
      // Keep stdin open for interactive session
      if (command !== undefined) {
        claudeProcess.stdin.write(command + '\n');
        claudeProcess.stdin.end();
      }
      // If no command provided, stdin stays open for interactive use
    }
  });
}

function abortClaudeSession(sessionId) {
  const process = activeClaudeProcesses.get(sessionId);
  if (process) {
    process.kill('SIGTERM');
    activeClaudeProcesses.delete(sessionId);
    return true;
  }
  return false;
}

export {
  spawnClaude,
  abortClaudeSession
};