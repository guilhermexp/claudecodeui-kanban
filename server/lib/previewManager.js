import { spawn } from 'child_process';
import net from 'net';
import path from 'path';

// In-memory registry
const processes = new Map(); // key: projectName -> { proc, port, logs: string[], startedAt }
const portsInUse = new Set(); // Track ports allocated to preview processes
let broadcaster = null; // function(messageObj)

export function setPreviewBroadcaster(fn) {
  broadcaster = fn;
}

function broadcast(message) {
  if (!broadcaster) return;
  try { broadcaster(message); } catch {}
}

export async function findFreePort(start = 4000, end = 4999) {
  const isPortFree = (port) => new Promise((resolve) => {
    // Skip ports we already allocated to preview processes
    if (portsInUse.has(port)) {
      resolve(false);
      return;
    }
    
    // First, try to connect to see if something is already listening
    const client = new net.Socket();
    let resolved = false;
    
    const cleanup = () => {
      if (!resolved) {
        resolved = true;
        client.destroy();
      }
    };
    
    client.setTimeout(50);
    
    client.once('connect', () => {
      // Successfully connected, port is in use
      cleanup();
      resolve(false);
    });
    
    client.once('error', (err) => {
      // Connection failed
      cleanup();
      
      // Now try to bind to the port to make sure we can use it
      const srv = net.createServer();
      srv.once('error', () => {
        // Can't bind, port is in use
        resolve(false);
      });
      srv.once('listening', () => {
        // Can bind, port is free
        srv.close(() => resolve(true));
      });
      srv.listen(port, '127.0.0.1');
    });
    
    client.once('timeout', () => {
      // Connection timed out
      cleanup();
      
      // Try to bind to the port
      const srv = net.createServer();
      srv.once('error', () => {
        resolve(false);
      });
      srv.once('listening', () => {
        srv.close(() => resolve(true));
      });
      srv.listen(port, '127.0.0.1');
    });
    
    // Try to connect to the port
    client.connect(port, '127.0.0.1');
  });

  // Log port scanning for debugging
  console.log(`[Preview] Scanning for free port from ${start} to ${end} (allocated: ${Array.from(portsInUse).join(', ') || 'none'})`);
  
  for (let p = start; p <= end; p++) {
    // eslint-disable-next-line no-await-in-loop
    const ok = await isPortFree(p);
    if (ok) {
      console.log(`[Preview] Found free port: ${p}`);
      return p;
    } else {
      const reason = portsInUse.has(p) ? 'allocated to another preview' : 'in use by external process';
      console.log(`[Preview] Port ${p} is ${reason}, trying next...`);
    }
  }
  throw new Error(`No free preview port available in range ${start}-${end}`);
}

export function getStatus(projectName) {
  const rec = processes.get(projectName);
  if (!rec) return { running: false };
  const running = rec.proc && !rec.proc.killed && rec.proc.exitCode == null;
  return { 
    running, 
    port: rec.port, 
    startedAt: rec.startedAt,
    allocatedPorts: Array.from(portsInUse).sort((a, b) => a - b)
  };
}

export function getAllocatedPorts() {
  return Array.from(portsInUse).sort((a, b) => a - b);
}

export function getActivePreview() {
  const previews = [];
  for (const [name, rec] of processes.entries()) {
    const running = rec.proc && !rec.proc.killed && rec.proc.exitCode == null;
    if (running) {
      previews.push({
        project: name,
        port: rec.port,
        startedAt: rec.startedAt,
        path: rec.repoPath
      });
    }
  }
  return previews;
}

export function getLogs(projectName, lines = 200) {
  const rec = processes.get(projectName);
  if (!rec) return 'No logs available';
  const logs = rec.logs || [];
  return logs.slice(-lines).join('');
}

export async function startPreview(projectName, repoPath, preferredPort = null) {
  // First, check if there's already a dev server running for this project
  // This happens when user manually started the project outside of our UI
  const checkExistingServer = async (checkPort) => {
    try {
      const testUrl = `http://localhost:${checkPort}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 500);
      await fetch(testUrl, { 
        method: 'HEAD', 
        signal: controller.signal,
        headers: { 'Accept': '*/*' }
      });
      clearTimeout(timeout);
      return true;
    } catch {
      return false;
    }
  };
  
  // Try to detect port from package.json first
  let detectedPort = null;
  try {
    const packageJsonPath = path.join(repoPath, 'package.json');
    const fs = await import('fs').then(m => m.promises);
    const packageContent = await fs.readFile(packageJsonPath, 'utf8');
    const packageJson = JSON.parse(packageContent);
    
    // Check dev script for port configuration
    const devScript = packageJson?.scripts?.dev || '';
    const portMatch = devScript.match(/-p\s+(\d+)|--port[=\s]+(\d+)/);
    if (portMatch) {
      detectedPort = parseInt(portMatch[1] || portMatch[2], 10);
      console.log(`[Preview] Detected port ${detectedPort} from package.json for ${projectName}`);
      
      // Check if server is already running on this port
      if (await checkExistingServer(detectedPort)) {
        console.log(`[Preview] Server already running on port ${detectedPort} for ${projectName}, using existing server`);
        
        // Register this as running without starting a new process
        processes.set(projectName, { 
          proc: null, // No process since we're using existing server
          port: detectedPort, 
          logs: ['Using existing server'], 
          startedAt: Date.now(), 
          repoPath: path.resolve(repoPath),
          external: true // Flag to indicate this is an external server
        });
        
        broadcast({ type: 'preview_success', project: projectName, port: detectedPort, url: `http://localhost:${detectedPort}` });
        return { port: detectedPort, url: `http://localhost:${detectedPort}` };
      }
    }
  } catch (e) {
    console.log(`[Preview] Could not detect port from package.json: ${e.message}`);
  }
  
  // Check if this project should not have preview
  const blockedPaths = [
    '/Users/guilhermevarela/.claude',
    '/.claude'
  ];
  
  // These paths should be blocked only as exact matches, not subdirectories
  const exactMatchOnlyPaths = [
    '/Users/guilhermevarela',
    '/Users/guilhermevarela/Documents',
    '/Users/guilhermevarela/Desktop',
    '/Users/guilhermevarela/Downloads'
  ];
  
  const normalizedPath = path.resolve(repoPath);
  
  // Check if it's a blocked path (includes subdirectories)
  const isBlocked = blockedPaths.some(blocked => {
    const resolvedBlocked = path.resolve(blocked);
    return normalizedPath === resolvedBlocked || normalizedPath.startsWith(resolvedBlocked + '/');
  });
  
  // Check if it's an exact match only path (no subdirectories)
  const isExactBlocked = exactMatchOnlyPaths.some(blocked => {
    const resolvedBlocked = path.resolve(blocked);
    return normalizedPath === resolvedBlocked;
  });
  
  const shouldBlock = isBlocked || isExactBlocked;
  
  if (shouldBlock) {
    console.log(`[Preview] Blocked preview for system/config directory: ${repoPath}`);
    broadcast({ 
      type: 'preview_error', 
      project: projectName, 
      error: 'Preview is not available for system or configuration directories' 
    });
    return { 
      error: 'Preview not available for this directory type',
      blocked: true 
    };
  }
  
  // Check if it's standalone/static mode (no package.json) and try a static preview
  const fs = await import('fs').then(m => m.promises);
  const packageJsonPath = path.join(repoPath, 'package.json');
  let hasPkg = true;
  try { await fs.access(packageJsonPath); } catch { hasPkg = false; }
  if (!hasPkg) {
    // Try common static roots that have index.html
    const candidates = ['', 'public', 'dist', 'build', 'docs'];
    let staticRoot = null;
    for (const c of candidates) {
      const root = path.join(repoPath, c);
      try {
        await fs.access(path.join(root, 'index.html'));
        staticRoot = root;
        break;
      } catch {}
    }
    if (!staticRoot) {
      console.log(`[Preview] No package.json or index.html found in ${repoPath}`);
      broadcast({ 
        type: 'preview_error', 
        project: projectName, 
        error: 'Preview not available: no package.json or index.html' 
      });
      return { error: 'Preview not available', blocked: true };
    }
    // Register static root in process map (no process/port required)
    processes.set(projectName, {
      proc: null,
      port: null,
      logs: ['Static preview'],
      startedAt: Date.now(),
      repoPath: path.resolve(repoPath),
      staticRoot,
      external: true
    });
    broadcast({ type: 'preview_success', project: projectName, url: `/preview-static/${encodeURIComponent(projectName)}/` });
    return { url: `/preview-static/${encodeURIComponent(projectName)}/` };
  }
  
  // Stop existing
  try { await stopPreview(projectName); } catch {}

  // If preferred port is provided, check if it's free first
  let port;
  if (preferredPort) {
    const tryPort = (p) => new Promise((resolve) => {
      const srv = net.createServer();
      srv.once('error', () => resolve(false));
      srv.once('listening', () => srv.close(() => resolve(true)));
      srv.listen(p, '127.0.0.1');
    });
    
    const isPreferredFree = await tryPort(preferredPort);
    if (isPreferredFree) {
      port = preferredPort;
      console.log(`[Preview] Using preferred port ${port} for ${projectName}`);
    } else {
      console.log(`[Preview] Preferred port ${preferredPort} is in use for ${projectName}, finding alternative...`);
      // Find next available port starting from preferredPort + 1
      port = await findFreePort(
        preferredPort + 1,
        Number(process.env.PREVIEW_PORT_END) || 4999
      );
    }
  } else {
    // No preferred port, find first available starting from 4000
    port = await findFreePort(
      Number(process.env.PREVIEW_PORT_START) || 4000,
      Number(process.env.PREVIEW_PORT_END) || 4999
    );
  }

  // Detect the right command to run
  let command = 'npm';
  let args = ['run', 'dev'];
  let isNextJs = false;
  let isVite = false;
  let packageJson = null;
  
  try {
    // Check if package.json exists and what scripts are available
    const packageJsonPath = path.join(repoPath, 'package.json');
    const fs = await import('fs').then(m => m.promises);
    const packageContent = await fs.readFile(packageJsonPath, 'utf8');
    packageJson = JSON.parse(packageContent);
    
    // Detect framework
    if (packageJson.dependencies) {
      isNextJs = !!packageJson.dependencies.next || !!packageJson.devDependencies?.next;
      isVite = !!packageJson.dependencies.vite || !!packageJson.devDependencies?.vite;
    }
    
    if (packageJson.scripts) {
      // Priority order for dev server scripts
      if (packageJson.scripts.dev) {
        args = ['run', 'dev'];
      } else if (packageJson.scripts.start) {
        args = ['start'];
      } else if (packageJson.scripts.serve) {
        args = ['run', 'serve'];
      } else if (packageJson.scripts.preview) {
        args = ['run', 'preview'];
      } else {
        // Log available scripts for debugging
        console.log(`Available scripts for ${projectName}:`, Object.keys(packageJson.scripts));
        broadcast({ type: 'preview_error', project: projectName, error: `No dev script found. Available: ${Object.keys(packageJson.scripts).join(', ')}` });
      }
    }
  } catch (e) {
    console.error(`Failed to read package.json for ${projectName}:`, e.message);
    // Fall back to default
  }

  // Append port argument based on framework
  let fullArgs;
  
  // First check if the script already contains a port specification
  const scriptCommand = packageJson?.scripts?.[args[1]] || '';
  const scriptHasPort = scriptCommand.includes(' -p ') || scriptCommand.includes('--port');
  
  // Extract port from script if it exists
  let scriptPort = null;
  if (scriptHasPort) {
    // Try to extract port number from script
    const portMatch = scriptCommand.match(/-p\s+(\d+)|--port[=\s]+(\d+)/);
    if (portMatch) {
      scriptPort = parseInt(portMatch[1] || portMatch[2], 10);
      console.log(`[Preview] Found port ${scriptPort} in script for ${projectName}`);
    }
  }
  
  // Use script port if available, otherwise use the assigned port
  if (scriptPort) {
    port = scriptPort;
    console.log(`[Preview] Using script-defined port ${port} for ${projectName}`);
    fullArgs = [...args];
  } else if (isNextJs) {
    // Next.js uses -p PORT directly (no --)
    fullArgs = [...args, '-p', String(port)];
  } else if (isVite) {
    // Vite uses --port PORT
    fullArgs = [...args, '--', '--port', String(port)];
  } else {
    // Generic npm script - try to pass port via --
    fullArgs = [...args, '--', '-p', String(port)];
  }

  const env = { ...process.env, PORT: String(port), NODE_ENV: 'development' };

  console.log(`Starting preview for ${projectName} with command: ${command} ${fullArgs.join(' ')}`);
  
  const proc = spawn(command, fullArgs, {
    cwd: repoPath,
    env,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  const logs = [];
  let portErrorDetected = false;
  
  const append = (buf) => {
    const text = typeof buf === 'string' ? buf : buf.toString('utf8');
    logs.push(text);
    if (logs.length > 2000) logs.splice(0, logs.length - 2000);

    // Heuristic error/success detection
    const low = text.toLowerCase();
    
    // Success detection
    if (low.includes('ready in') || low.includes('compiled') || low.includes('listening on') || 
        low.includes('started server') || low.includes('local:') || low.includes('server running')) {
      broadcast({ type: 'preview_success', project: projectName, port, url: `http://localhost:${port}` });
    }
    
    // Port error detection - retry with next port
    if ((low.includes('eaddrinuse') || low.includes('address already in use') || 
         low.includes('port is already in use') || low.includes(`port ${port} is in use`)) && !portErrorDetected) {
      portErrorDetected = true;
      console.log(`[Preview] Port ${port} error detected for ${projectName}, will retry with next port...`);
      broadcast({ type: 'preview_error', project: projectName, error: `Port ${port} is in use, retrying with next available port...` });
      
      // Clean up this failed attempt
      portsInUse.delete(port); // Release this port since it failed
      try { proc.kill('SIGTERM'); } catch {}
      processes.delete(projectName);
      
      // Retry with next port asynchronously
      setTimeout(async () => {
        console.log(`[Preview] Retrying ${projectName} with next available port...`);
        try {
          // Start search from next port
          const nextPort = await findFreePort(port + 1, Number(process.env.PREVIEW_PORT_END) || 4999);
          console.log(`[Preview] Retrying ${projectName} on port ${nextPort}`);
          await startPreview(projectName, repoPath, nextPort);
        } catch (e) {
          console.error(`[Preview] Failed to retry ${projectName}:`, e);
          broadcast({ type: 'preview_error', project: projectName, error: `Failed to start preview: ${e.message}` });
        }
      }, 1000);
      return;
    }
    
    // Other errors
    if (low.includes('error') || low.includes('failed') || low.includes('uncaught') || low.includes('module not found')) {
      if (!portErrorDetected) { // Don't broadcast generic errors if we're handling port error
        broadcast({ type: 'preview_error', project: projectName, error: text.slice(0, 500) });
      }
    }
  };
  proc.stdout?.on('data', append);
  proc.stderr?.on('data', append);

  proc.on('exit', (code, signal) => {
    // Clean up port allocation
    const processRec = processes.get(projectName);
    if (processRec && processRec.port) {
      portsInUse.delete(processRec.port);
      console.log(`[Preview] Released port ${processRec.port} from ${projectName}`);
    }
    
    broadcast({ type: 'preview_stopped', project: projectName, code, signal });
    processes.delete(projectName);
  });

  // Register the port as in use
  portsInUse.add(port);
  
  processes.set(projectName, { proc, port, logs, startedAt: Date.now(), repoPath: path.resolve(repoPath) });

  // Optimistic URL
  broadcast({ type: 'preview_starting', project: projectName, port, url: `http://localhost:${port}` });
  return { port, url: `http://localhost:${port}` };
}

export async function stopPreview(projectName) {
  const rec = processes.get(projectName);
  if (!rec) return { success: true };
  
  try {
    const { proc, port } = rec;
    
    // Clean up port allocation
    if (port) {
      portsInUse.delete(port);
      console.log(`[Preview] Released port ${port} from ${projectName} (manual stop)`);
    }
    
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
