import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Spawn Codex CLI (OpenAI subscription-based CLI)
 * Similar to how Claude Code CLI works
 */
export async function spawnCodex(prompt, options = {}, ws) {
  return new Promise((resolve, reject) => {
    const { projectPath, cwd } = options;
    
    // Build Codex command
    const codexArgs = [
      'exec',
      '--json',
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check'
    ];
    
    // Add directory flag if project path is provided
    const workingDir = cwd || projectPath || process.cwd();
    if (workingDir) {
      codexArgs.push('-C', workingDir);
    }
    
    // Add the prompt as the last argument
    codexArgs.push(prompt);
    
    // Resolve Codex executable: prefer system 'codex', then Homebrew path, then npx fallback
    const envBin = process.env.CODEX_BIN && process.env.CODEX_BIN.trim();
    const candidates = envBin ? [envBin] : [
      'codex',
      '/opt/homebrew/bin/codex',
      '/usr/local/bin/codex'
    ];
    // Return the first existing candidate; otherwise null (we'll use npx)
    const resolveExec = () => {
      for (const p of candidates) {
        try {
          // If it's a bare command, let spawn resolve via PATH
          if (!p.includes('/')) return p;
          if (fs.existsSync(p)) return p;
        } catch {}
      }
      return null;
    };
    let execCmd = resolveExec();
    let execArgs = codexArgs;
    let spawnOpts = {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1'
      },
      cwd: workingDir
    };

    if (!execCmd) {
      // Fallback to npx @openai/codex
      execCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';
      execArgs = ['@openai/codex', ...codexArgs];
    }

    console.log('Starting Codex with command:', execCmd, execArgs.join(' '));
    const codexProcess = spawn(execCmd, execArgs, spawnOpts);
    
    // Handle stdout (JSON responses)
    codexProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Codex output:', output);
      
      // Parse JSON lines
      const lines = output.split('\n').filter(line => line.trim());
      
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          
          // Skip metadata messages
          if (json.prompt || json.reasoning_summaries || json.id === undefined) {
            continue;
          }
          
          // Handle different message types
          if (json.msg && json.msg.type === 'error') {
            // Handle error messages (like usage limit)
            ws.send(JSON.stringify({
              type: 'codex-error',
              error: json.msg.message
            }));
          } else if (json.type === 'tool_use') {
            ws.send(JSON.stringify({
              type: 'codex-tool',
              data: json
            }));
          } else if (json.type === 'text' && json.text) {
            ws.send(JSON.stringify({
              type: 'codex-response',
              text: json.text
            }));
          } else if (json.content) {
            // Handle content blocks
            ws.send(JSON.stringify({
              type: 'codex-response',
              text: json.content
            }));
          }
        } catch (parseError) {
          // If not JSON, send as raw output
          if (line.trim()) {
            ws.send(JSON.stringify({
              type: 'codex-output',
              data: line
            }));
          }
        }
      }
    });
    
    // Handle stderr
    codexProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('Codex stderr:', error);
      ws.send(JSON.stringify({
        type: 'codex-error',
        error: error
      }));
    });
    
    // Handle process completion
    codexProcess.on('close', (code) => {
      console.log('Codex process exited with code', code);
      ws.send(JSON.stringify({
        type: 'codex-complete',
        exitCode: code
      }));
      
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Codex CLI exited with code ${code}`));
      }
    });
    
    // Handle process errors
    codexProcess.on('error', (err) => {
      console.error('Failed to start Codex:', err);
      ws.send(JSON.stringify({
        type: 'codex-error',
        error: `Failed to start Codex: ${err.message}`
      }));
      reject(err);
    });
  });
}

export default { spawnCodex };
