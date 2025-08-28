import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Spawn Codex CLI (OpenAI subscription-based CLI)
 * Similar to how Claude Code CLI works - using same approach as Vibe Kanban
 */
function extractSessionIdFromLine(line) {
  try {
    const m = /session_id:\s*([0-9a-fA-F-]{36})/.exec(line);
    return m ? m[1] : null;
  } catch { return null; }
}

function findRolloutFilePath(sessionId) {
  try {
    const home = os.homedir();
    const sessionsDir = path.join(home, '.codex', 'sessions');
    if (!fs.existsSync(sessionsDir)) return null;

    const stack = [sessionsDir];
    while (stack.length) {
      const dir = stack.pop();
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          stack.push(full);
        } else if (ent.isFile()) {
          if (ent.name.includes(sessionId) && ent.name.startsWith('rollout-') && ent.name.endsWith('.jsonl')) {
            return full;
          }
        }
      }
    }
  } catch {}
  return null;
}

export async function spawnCodex(prompt, options = {}, ws) {
  return new Promise((resolve, reject) => {
    const { projectPath, cwd, onSession, resumeRolloutPath, suppressOutput } = options;

    // Determine working directory. Avoid invalid placeholders like STANDALONE_MODE
    let workingDir = cwd || projectPath;
    if (!workingDir || workingDir === 'STANDALONE_MODE' || !fs.existsSync(workingDir)) {
      workingDir = process.cwd();
    }

    // Escape prompt for shell safety
    const escapedPrompt = String(prompt)
      .replace(/"/g, '\\"')
      .replace(/'/g, "\\'")
      .replace(/\$/g, '\\$');

    // Common args for codex exec
    const commonArgs = [
      'exec',
      '--json',
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check'
    ];
    if (workingDir) {
      commonArgs.push('-C', workingDir);
    }
    if (resumeRolloutPath) {
      commonArgs.push('-c', `experimental_resume=${resumeRolloutPath}`);
    }
    commonArgs.push(escapedPrompt);

    // Candidate paths to run codex directly via node (most reliable)
    // Prefer the exact Node binary running this server (process.execPath)
    const codexScriptCandidates = [
      '/opt/homebrew/lib/node_modules/@openai/codex/bin/codex.js', // macOS ARM (brew)
      '/usr/local/lib/node_modules/@openai/codex/bin/codex.js',    // macOS Intel / Linux
      '/usr/lib/node_modules/@openai/codex/bin/codex.js'           // Linux (alt)
    ].filter(p => {
      try { return fs.existsSync(p); } catch { return false; }
    });

    const envVars = {
      ...process.env,
      NODE_NO_WARNINGS: '1',
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`
    };

    const trySpawnViaNode = () => {
      if (codexScriptCandidates.length === 0) return null;
      const nodeBin = process.execPath; // absolute path to current Node
      const script = codexScriptCandidates[0];
      console.log('Starting Codex via node execPath:', nodeBin, script, commonArgs.join(' '));
      try {
        const p = spawn(nodeBin, [script, ...commonArgs], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: envVars,
          cwd: workingDir
        });
        return p;
      } catch (e) {
        console.error('Failed spawning Codex via node execPath:', e);
        return null;
      }
    };

    // Fallback: use shell + npx (works when PATH is correct)
    const trySpawnViaShell = () => {
      const dirFlag = workingDir ? ` -C "${workingDir}"` : '';
      const codexCommand = `npx @openai/codex exec --json --dangerously-bypass-approvals-and-sandbox --skip-git-repo-check${dirFlag} "${escapedPrompt}"`;

      // Choose a robust shell available in most environments
      const shellCandidates = ['/bin/bash', '/bin/sh', '/usr/bin/bash', '/usr/bin/sh'];
      const chosenShell = shellCandidates.find(p => {
        try { return fs.existsSync(p); } catch { return false; }
      }) || 'sh';

      console.log('Starting Codex with command:', codexCommand);
      console.log('Using shell:', chosenShell, 'cwd:', workingDir);
      try {
        const p = spawn(chosenShell, ['-lc', codexCommand], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: envVars,
          cwd: workingDir
        });
        return p;
      } catch (e) {
        console.error('Failed spawning Codex via shell:', e);
        return null;
      }
    };

    // Prefer node execPath strategy; fall back to shell+npx
    let codexProcess = trySpawnViaNode();
    if (!codexProcess) {
      codexProcess = trySpawnViaShell();
    }
    if (!codexProcess) {
      const err = new Error('Failed to start Codex using both node execPath and shell');
      ws?.send?.(JSON.stringify({ type: 'codex-error', error: err.message }));
      return reject(err);
    }

    // Notify frontend that task started
    ws?.send?.(JSON.stringify({ type: 'codex-start' }));

    // Handle stdout (JSON responses) - using exec mode format
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
          
          // Handle different message types from exec mode
          if (json.msg && json.msg.type === 'error') {
            // Handle error messages (like usage limit)
            ws.send(JSON.stringify({
              type: 'codex-error',
              error: json.msg.message
            }));
          } else if (json.msg && json.msg.type === 'agent_message' && json.msg.message) {
            // Send agent messages to frontend (skip during warmup)
            if (!suppressOutput) {
              console.log('Sending agent_message to frontend:', json.msg.message);
              ws.send(JSON.stringify({
                type: 'codex-response',
                text: json.msg.message
              }));
            }
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
          // If not JSON, could be debug output - ignore for now
          // Reduce noise: only forward raw lines if not a suppressed warmup
          if (!suppressOutput) {
            console.log('Non-JSON output from Codex:', line);
            ws?.send?.(JSON.stringify({ type: 'codex-output', data: line }));
          }
        }
      }
    });
    
    // Handle stderr
    codexProcess.stderr.on('data', (data) => {
      const error = data.toString();
      console.error('Codex stderr:', error);
      // Try to extract session id from stderr logs
      const lines = error.split('\n');
      let sessionFound = false;
      for (const line of lines) {
        const sid = extractSessionIdFromLine(line);
        if (sid) {
          const rollout = findRolloutFilePath(sid);
          sessionFound = true;
          if (typeof onSession === 'function') {
            try { onSession(sid, rollout || null); } catch {}
          }
          ws?.send?.(JSON.stringify({ type: 'codex-session-started', sessionId: sid, rolloutPath: rollout || null }));
          break;
        }
      }
      if (!sessionFound) {
        ws.send(JSON.stringify({ type: 'codex-error', error }));
      }
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
      // If first strategy failed and we haven\'t tried shell yet, attempt fallback
      // Note: This only triggers if initial spawn threw asynchronously (rare). Most sync failures are caught above.
      ws?.send?.(JSON.stringify({ type: 'codex-error', error: `Failed to start Codex: ${err.message}` }));
      reject(err);
    });
  });
}

export default { spawnCodex };
