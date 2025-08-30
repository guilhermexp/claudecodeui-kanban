import { spawn } from 'child_process';
import net from 'net';
import path from 'path';

// In-memory registry
const processes = new Map(); // key: projectName -> { proc, port, logs: string[], startedAt }
let broadcaster = null; // function(messageObj)

export function setPreviewBroadcaster(fn) {
  broadcaster = fn;
}

function broadcast(message) {
  if (!broadcaster) return;
  try { broadcaster(message); } catch {}
}

export async function findFreePort(start = 4000, end = 4999) {
  const tryPort = (port) => new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });

  for (let p = start; p <= end; p++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await tryPort(p);
    if (ok) return p;
  }
  throw new Error('No free preview port available');
}

export function getStatus(projectName) {
  const rec = processes.get(projectName);
  if (!rec) return { running: false };
  const running = rec.proc && !rec.proc.killed && rec.proc.exitCode == null;
  return { running, port: rec.port, startedAt: rec.startedAt };
}

export function getLogs(projectName, lines = 200) {
  const rec = processes.get(projectName);
  if (!rec) return 'No logs available';
  const logs = rec.logs || [];
  return logs.slice(-lines).join('');
}

export async function startPreview(projectName, repoPath, preferredPort = null) {
  // Stop existing
  try { await stopPreview(projectName); } catch {}

  const port = preferredPort || await findFreePort(
    Number(process.env.PREVIEW_PORT_START) || 4000,
    Number(process.env.PREVIEW_PORT_END) || 4999
  );

  // Basic command: npm run dev -- -p PORT
  const env = { ...process.env, PORT: String(port), NODE_ENV: 'development' };

  const proc = spawn('npm', ['run', 'dev', '--', '-p', String(port)], {
    cwd: repoPath,
    env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const logs = [];
  const append = (buf) => {
    const text = typeof buf === 'string' ? buf : buf.toString('utf8');
    logs.push(text);
    if (logs.length > 2000) logs.splice(0, logs.length - 2000);

    // Heuristic error/success detection
    const low = text.toLowerCase();
    if (low.includes('ready in') || low.includes('compiled') || low.includes('listening on') || low.includes('started server')) {
      broadcast({ type: 'preview_success', project: projectName, port, url: `http://localhost:${port}` });
    }
    if (low.includes('error') || low.includes('failed') || low.includes('uncaught') || low.includes('module not found')) {
      broadcast({ type: 'preview_error', project: projectName, error: text.slice(0, 500) });
    }
  };
  proc.stdout?.on('data', append);
  proc.stderr?.on('data', append);

  proc.on('exit', (code, signal) => {
    broadcast({ type: 'preview_stopped', project: projectName, code, signal });
    processes.delete(projectName);
  });

  processes.set(projectName, { proc, port, logs, startedAt: Date.now(), repoPath: path.resolve(repoPath) });

  // Optimistic URL
  broadcast({ type: 'preview_starting', project: projectName, port, url: `http://localhost:${port}` });
  return { port, url: `http://localhost:${port}` };
}

export async function stopPreview(projectName) {
  const rec = processes.get(projectName);
  if (!rec) return { success: true };
  try {
    const { proc } = rec;
    if (proc && proc.pid) {
      if (process.platform !== 'win32') {
        try { process.kill(-proc.pid, 'SIGTERM'); } catch { try { proc.kill('SIGTERM'); } catch {} }
      } else {
        try { proc.kill('SIGTERM'); } catch {}
      }
    }
  } finally {
    processes.delete(projectName);
  }
  return { success: true };
}

