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

function shouldExcludeDir(name) {
  const lower = name.toLowerCase();
  return (
    lower === 'node_modules' ||
    lower === '.git' ||
    lower === 'dist' ||
    lower === 'build' ||
    lower === '.next' ||
    lower === 'target' ||
    lower === 'vendor' ||
    lower === 'coverage'
  );
}

function copyDirSafe(src, dest, maxBytes = 1024 * 1024) {
  try { fs.mkdirSync(dest, { recursive: true }); } catch {}
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldExcludeDir(entry.name)) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    try {
      const stat = fs.statSync(s);
      // Skip very large files (>1MB by default)
      if (stat.isFile() && stat.size > maxBytes) continue;
    } catch {}
    if (entry.isDirectory()) {
      copyDirSafe(s, d, maxBytes);
    } else if (entry.isFile()) {
      try { fs.copyFileSync(s, d); } catch {}
    }
  }
}

export async function spawnCodex(prompt, options = {}, ws) {
  return new Promise((resolve, reject) => {
    const { projectPath, cwd, onSession, resumeRolloutPath, suppressOutput, dangerous, plannerMode, modelLabel } = options;

    // Determine working directory. Avoid invalid placeholders like STANDALONE_MODE
    let workingDir = cwd || projectPath;
    if (!workingDir || workingDir === 'STANDALONE_MODE' || !fs.existsSync(workingDir)) {
      workingDir = process.cwd();
    }

    // Safe mode by default: run Codex in a temporary mirror to prevent writes
    let tempMirrorPath = null;
    const safeMode = !dangerous; // default true
    if (safeMode) {
      try {
        const prefix = path.join(os.tmpdir(), 'codex-safe-');
        tempMirrorPath = fs.mkdtempSync(prefix);
        // Copy a lightweight snapshot of the project (no node_modules/.git, size-capped)
        copyDirSafe(workingDir, tempMirrorPath, 1024 * 1024); // 1MB/file cap
        workingDir = tempMirrorPath;
        console.log('[Codex SafeMode] Using temp mirror:', workingDir);
      } catch (e) {
        console.warn('[Codex SafeMode] Failed to create mirror, falling back to real dir:', e.message);
      }
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
      '--skip-git-repo-check'
    ];
    if (dangerous) {
      commonArgs.splice(2, 0, '--dangerously-bypass-approvals-and-sandbox');
    }
    if (workingDir) {
      commonArgs.push('-C', workingDir);
    }
    if (resumeRolloutPath) {
      commonArgs.push('-c', `experimental_resume=${resumeRolloutPath}`);
    }
    commonArgs.push(escapedPrompt);

    // Allow environment overrides for Codex location
    const CODEX_SCRIPT_PATH = process.env.CODEX_SCRIPT_PATH;
    const CODEX_BIN = process.env.CODEX_BIN;

    // Candidate paths to run codex directly via node (most reliable)
    // Prefer the exact Node binary running this server (process.execPath)
    const codexScriptCandidates = [
      ...(CODEX_SCRIPT_PATH ? [CODEX_SCRIPT_PATH] : []),
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
      console.log('[Codex Spawn] Strategy=node+script');
      console.log('[Codex Spawn] node:', nodeBin);
      console.log('[Codex Spawn] script:', script);
      console.log('[Codex Spawn] args:', commonArgs.join(' '));
      console.log('[Codex Spawn] cwd:', workingDir);
      console.log('[Codex Spawn] PATH:', envVars.PATH);
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

    // Explicit binary override via CODEX_BIN, supports additional built-in args
    const trySpawnViaBin = () => {
      if (!CODEX_BIN) return null;
      const parts = CODEX_BIN.split(/\s+/).filter(Boolean);
      if (parts.length === 0) return null;
      const bin = parts[0];
      const binArgs = parts.slice(1);
      console.log('[Codex Spawn] Strategy=bin');
      console.log('[Codex Spawn] bin:', bin);
      console.log('[Codex Spawn] binArgs:', binArgs.join(' '));
      console.log('[Codex Spawn] args:', commonArgs.join(' '));
      console.log('[Codex Spawn] cwd:', workingDir);
      console.log('[Codex Spawn] PATH:', envVars.PATH);
      try {
        const p = spawn(bin, [...binArgs, ...commonArgs], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: envVars,
          cwd: workingDir
        });
        return p;
      } catch (e) {
        console.error('Failed spawning Codex via CODEX_BIN:', e);
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

      console.log('[Codex Spawn] Strategy=shell+npx');
      console.log('[Codex Spawn] command:', codexCommand);
      console.log('[Codex Spawn] shell:', chosenShell);
      console.log('[Codex Spawn] cwd:', workingDir);
      console.log('[Codex Spawn] PATH:', envVars.PATH);
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

    // Prefer explicit bin, then node execPath strategy; fall back to shell+npx
    let codexProcess = trySpawnViaBin();
    if (!codexProcess) {
      codexProcess = trySpawnViaNode();
    }
    if (!codexProcess) {
      codexProcess = trySpawnViaShell();
    }
    if (!codexProcess) {
      const err = new Error('Failed to start Codex using both node execPath and shell');
      ws?.send?.(JSON.stringify({ type: 'codex-error', error: err.message }));
      return reject(err);
    }

    // Planner enforcement state
    let planApproved = plannerMode !== 'Planer';

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
          } else if (json.msg && json.msg.type === 'exec_command_begin') {
            if (plannerMode === 'Chat') {
              try { codexProcess.kill('SIGINT'); } catch {}
              ws.send(JSON.stringify({ type: 'codex-error', error: 'Tool use is disabled in Chat mode.' }));
              continue;
            }
            if (plannerMode === 'Planer' && !planApproved) {
              try { codexProcess.kill('SIGINT'); } catch {}
              ws.send(JSON.stringify({ type: 'codex-error', error: 'Provide a concise plan first before executing tools.' }));
              continue;
            }
            ws.send(JSON.stringify({
              type: 'codex-exec-begin',
              callId: json.msg.call_id,
              command: json.msg.command,
              cwd: json.msg.cwd
            }));
          } else if (json.msg && json.msg.type === 'exec_command_output_delta') {
            const chunk = json.msg.chunk;
            let text = '';
            try {
              if (Array.isArray(chunk)) {
                text = Buffer.from(chunk).toString('utf8');
              } else if (typeof chunk === 'string') {
                text = chunk;
              }
            } catch {}
            ws.send(JSON.stringify({
              type: 'codex-exec-delta',
              callId: json.msg.call_id,
              stream: json.msg.stream,
              text
            }));
          } else if (json.msg && json.msg.type === 'exec_command_end') {
            ws.send(JSON.stringify({
              type: 'codex-exec-end',
              callId: json.msg.call_id,
              exit_code: json.msg.exit_code,
              duration: json.msg.duration,
              stdout: json.msg.stdout,
              stderr: json.msg.stderr
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
            if (plannerMode === 'Planer' && !planApproved) {
              const text = json.msg.message || '';
              if (/\n\s*[-\*•]/.test(text) || /\n\s*\d+\./.test(text) || /\bplan\b/i.test(text) || /\bTODO\b/i.test(text)) {
                planApproved = true;
              }
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
          } else if (json.limits || json.rate_limit || json.rate_limits || json.usage) {
            // Forward potential account/usage metadata transparently
            ws.send(JSON.stringify({
              type: 'codex-meta',
              data: json
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
        // Forward noteworthy limit/quota lines verbatim to client as warning
        if (/rate limit|quota|renewal|limit exceeded/i.test(line)) {
          ws?.send?.(JSON.stringify({ type: 'codex-meta', data: { stderr: line } }));
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
      // Cleanup temp mirror if any
      if (tempMirrorPath) {
        try { fs.rmSync(tempMirrorPath, { recursive: true, force: true }); } catch {}
      }
      
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
      if (tempMirrorPath) {
        try { fs.rmSync(tempMirrorPath, { recursive: true, force: true }); } catch {}
      }
      reject(err);
    });
  });
}

export default { spawnCodex };
