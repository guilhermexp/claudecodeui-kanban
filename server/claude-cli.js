import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

let activeClaudeProcesses = new Map(); // Track active processes by session ID

async function spawnClaude(command, options = {}, ws) {
  return new Promise(async (resolve, reject) => {
    const { sessionId, projectPath, cwd, resume, toolsSettings, permissionMode, images } = options;
    let capturedSessionId = sessionId; // Track session ID throughout the process
    let sessionCreatedSent = false; // Track if we've already sent session-created event
    
    // Use tools settings passed from frontend, or defaults
    const settings = toolsSettings || {
      allowedTools: [],
      disallowedTools: [],
      skipPermissions: false
    };
    
    // Build Claude CLI command - start with print/resume flags first
    const args = [];
    
    // Add print flag with command if we have a command
    if (command && command.trim()) {
      args.push('--print', command);
    }
    
    // Use cwd (actual project directory) instead of projectPath (Claude's metadata directory)
    const workingDir = cwd || process.cwd();
    
    // Handle images - Claude Code CLI doesn't support direct image input
    // We'll include a note about the images in the command text
    let tempImagePaths = [];
    let tempDir = null;
    
    if (images && images.length > 0) {
      console.log(`📸 User provided ${images.length} image(s) with their message`);
      
      // Send a warning to the UI that images aren't supported in CLI mode
      ws.send(JSON.stringify({
        type: 'claude-response',
        data: {
          type: 'info',
          content: '⚠️ Note: Claude Code CLI does not currently support image input. The images you attached cannot be processed. To analyze images, please use the Claude web interface or API directly.'
        }
      }));
      
      // If there's a command, add a note about the images
      if (command && command.trim()) {
        const imageNote = `\n\n[Note: ${images.length} image(s) were attached to this message, but Claude Code CLI doesn't support image input. The images cannot be analyzed.]`;
        const modifiedCommand = command + imageNote;
        
        // Update the command in args
        const printIndex = args.indexOf('--print');
        if (printIndex !== -1 && args[printIndex + 1] === command) {
          args[printIndex + 1] = modifiedCommand;
        }
      }
    }
    
    // Add resume flag if resuming
    if (resume && sessionId) {
      args.push('--resume', sessionId);
    }
    
    // Add basic flags
    args.push('--output-format', 'stream-json', '--verbose');
    
    // Add MCP config flag only if MCP servers are configured
    try {
      console.log('🔍 Starting MCP config check...');
      // Use already imported modules (fs.promises is imported as fs, path, os)
      const fsSync = await import('fs'); // Import synchronous fs methods
      console.log('✅ Successfully imported fs sync methods');
      
      // Check for MCP config in ~/.claude.json
      const claudeConfigPath = path.join(os.homedir(), '.claude.json');
      
      console.log(`🔍 Checking for MCP configs in: ${claudeConfigPath}`);
      console.log(`  Claude config exists: ${fsSync.existsSync(claudeConfigPath)}`);
      
      let hasMcpServers = false;
      
      // Check Claude config for MCP servers
      if (fsSync.existsSync(claudeConfigPath)) {
        try {
          const claudeConfig = JSON.parse(fsSync.readFileSync(claudeConfigPath, 'utf8'));
          
          // Check global MCP servers
          if (claudeConfig.mcpServers && Object.keys(claudeConfig.mcpServers).length > 0) {
            console.log(`✅ Found ${Object.keys(claudeConfig.mcpServers).length} global MCP servers`);
            hasMcpServers = true;
          }
          
          // Check project-specific MCP servers
          if (!hasMcpServers && claudeConfig.claudeProjects) {
            const currentProjectPath = process.cwd();
            const projectConfig = claudeConfig.claudeProjects[currentProjectPath];
            if (projectConfig && projectConfig.mcpServers && Object.keys(projectConfig.mcpServers).length > 0) {
              console.log(`✅ Found ${Object.keys(projectConfig.mcpServers).length} project MCP servers`);
              hasMcpServers = true;
            }
          }
        } catch (e) {
          console.log(`❌ Failed to parse Claude config:`, e.message);
        }
      }
      
      console.log(`🔍 hasMcpServers result: ${hasMcpServers}`);
      
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
          console.log(`📡 Adding MCP config: ${configPath}`);
          args.push('--mcp-config', configPath);
        } else {
          console.log('⚠️ MCP servers detected but no valid config file found');
        }
      }
    } catch (error) {
      // If there's any error checking for MCP configs, don't add the flag
      console.log('❌ MCP config check failed:', error.message);
      console.log('📍 Error stack:', error.stack);
      console.log('Note: MCP config check failed, proceeding without MCP support');
    }
    
    // Add model for new sessions
    if (!resume) {
      args.push('--model', 'sonnet');
    }
    
    // Add permission mode if specified (works for both new and resumed sessions)
    if (permissionMode && permissionMode !== 'default') {
      args.push('--permission-mode', permissionMode);
      console.log('🔒 Using permission mode:', permissionMode);
    }
    
    // Add tools settings flags
    // Don't use --dangerously-skip-permissions when in plan mode
    if (settings.skipPermissions && permissionMode !== 'plan') {
      args.push('--dangerously-skip-permissions');
      console.log('⚠️  Using --dangerously-skip-permissions (skipping other tool settings)');
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
        console.log('📝 Plan mode: Added default allowed tools:', planModeTools);
      }
      
      // Add allowed tools
      if (allowedTools.length > 0) {
        for (const tool of allowedTools) {
          args.push('--allowedTools', tool);
          console.log('✅ Allowing tool:', tool);
        }
      }
      
      // Add disallowed tools
      if (settings.disallowedTools && settings.disallowedTools.length > 0) {
        for (const tool of settings.disallowedTools) {
          args.push('--disallowedTools', tool);
          console.log('❌ Disallowing tool:', tool);
        }
      }
      
      // Log when skip permissions is disabled due to plan mode
      if (settings.skipPermissions && permissionMode === 'plan') {
        console.log('📝 Skip permissions disabled due to plan mode');
      }
    }
    
    console.log('Spawning Claude CLI:', 'claude', args.map(arg => {
      const cleanArg = arg.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
      return cleanArg.includes(' ') ? `"${cleanArg}"` : cleanArg;
    }).join(' '));
    console.log('Working directory:', workingDir);
    console.log('Session info - Input sessionId:', sessionId, 'Resume:', resume);
    console.log('🔍 Full command args:', JSON.stringify(args, null, 2));
    console.log('🔍 Final Claude command will be: claude ' + args.join(' '));
    
    const claudeProcess = spawn('claude', args, {
      cwd: workingDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env } // Inherit all environment variables
    });
    
    // No temp files to attach anymore since we don't save images
    
    // Store process reference for potential abort
    const processKey = capturedSessionId || sessionId || Date.now().toString();
    activeClaudeProcesses.set(processKey, claudeProcess);
    
    // Handle stdout (streaming JSON responses)
    claudeProcess.stdout.on('data', (data) => {
      const rawOutput = data.toString();
      console.log('📤 Claude CLI stdout:', rawOutput);
      
      const lines = rawOutput.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const response = JSON.parse(line);
          console.log('📄 Parsed JSON response:', response);
          
          // Capture session ID if it's in the response
          if (response.session_id && !capturedSessionId) {
            capturedSessionId = response.session_id;
            console.log('📝 Captured session ID:', capturedSessionId);
            
            // Update process key with captured session ID
            if (processKey !== capturedSessionId) {
              activeClaudeProcesses.delete(processKey);
              activeClaudeProcesses.set(capturedSessionId, claudeProcess);
            }
            
            // Send session-created event only once for new sessions
            if (!sessionId && !sessionCreatedSent) {
              sessionCreatedSent = true;
              ws.send(JSON.stringify({
                type: 'session-created',
                sessionId: capturedSessionId
              }));
            }
          }
          
          // Send parsed response to WebSocket
          ws.send(JSON.stringify({
            type: 'claude-response',
            data: response
          }));
        } catch (parseError) {
          console.log('📄 Non-JSON response:', line);
          // If not JSON, send as raw text
          ws.send(JSON.stringify({
            type: 'claude-output',
            data: line
          }));
        }
      }
    });
    
    // Handle stderr
    claudeProcess.stderr.on('data', (data) => {
      console.error('Claude CLI stderr:', data.toString());
      ws.send(JSON.stringify({
        type: 'claude-error',
        error: data.toString()
      }));
    });
    
    // Handle process completion
    claudeProcess.on('close', async (code) => {
      console.log(`Claude CLI process exited with code ${code}`);
      
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
    if (command) {
      // For --print mode with arguments, we don't need to write to stdin
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
    console.log(`🛑 Aborting Claude session: ${sessionId}`);
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