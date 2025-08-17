#!/usr/bin/env node

import { spawn } from 'child_process';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Get local network IP
function getLocalNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.internal || iface.family !== 'IPv4') continue;
      if (name.startsWith('en') || name.startsWith('eth') || name.startsWith('wlan')) {
        return iface.address;
      }
    }
  }
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

// Check if users database exists
function hasUserDatabase() {
  const dbPath = path.join(__dirname, '..', 'server', 'database', 'users.db');
  return fs.existsSync(dbPath);
}

const localIP = getLocalNetworkIP();
const hasUsers = hasUserDatabase();

console.log(`${colors.cyan}[${new Date().toLocaleTimeString()}] [INIT] Starting Claude Code UI with Network Access & Ngrok${colors.reset}`);
console.log('');

// Environment setup
const env = { ...process.env };
env.HOST = '0.0.0.0';
env.PORT = '7347';
env.VITE_PORT = '5892';

// Warning about authentication
if (!hasUsers) {
  console.log(`${colors.yellow}⚠️  WARNING: No users database found. Running without authentication.${colors.reset}`);
  console.log(`${colors.yellow}   Your instance will be accessible to anyone on the network!${colors.reset}`);
  console.log('');
}

// Start server
console.log(`${colors.green}[${new Date().toLocaleTimeString()}] [SERVER] Starting: HOST=0.0.0.0 node server/index.js${colors.reset}`);
const server = spawn('node', ['server/index.js'], { 
  env,
  stdio: 'pipe'
});

// Start client
console.log(`${colors.blue}[${new Date().toLocaleTimeString()}] [CLIENT] Starting: npx vite --host 0.0.0.0 --port 5892${colors.reset}`);
const client = spawn('npx', ['vite', '--host', '0.0.0.0', '--port', '5892'], { 
  env,
  stdio: 'pipe'
});

// Start Vibe backend
console.log(`${colors.magenta}[${new Date().toLocaleTimeString()}] [VIBE-BACKEND] Starting: cargo run --release${colors.reset}`);
const vibeBackend = spawn('cargo', ['run', '--release'], {
  cwd: path.join(__dirname, '..', 'vibe-kanban'),
  env: { ...env, PORT: '6734', VIBE_NO_BROWSER: 'true' },
  stdio: 'pipe'
});

// Start ngrok tunnel
console.log(`${colors.bright}${colors.magenta}[${new Date().toLocaleTimeString()}] [NGROK] Starting: ngrok http --domain=claudecode.ngrok.app 5892${colors.reset}`);
const ngrok = spawn('ngrok', ['http', '--domain=claudecode.ngrok.app', '5892'], {
  env,
  stdio: 'pipe'
});

// Display ready message with all URLs
console.log(`${colors.cyan}[${new Date().toLocaleTimeString()}] [READY] Development servers starting...${colors.reset}`);
console.log('');
console.log(`${colors.bright}📱 Access URLs:${colors.reset}`);
console.log(`${colors.green}  Local:    http://localhost:5892${colors.reset}`);
console.log(`${colors.green}  Network:  http://${localIP}:5892${colors.reset}`);
console.log(`${colors.bright}${colors.magenta}  🔒 HTTPS:   https://claudecode.ngrok.app/${colors.reset}`);
console.log('');
console.log(`${colors.yellow}💡 Use the HTTPS URL for microphone access on mobile devices${colors.reset}`);
console.log('');

// Handle process outputs
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    console.log(`${colors.green}[${new Date().toLocaleTimeString()}] [SERVER] ${line}${colors.reset}`);
  });
});

server.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    if (!line.includes('DeprecationWarning')) {
      console.error(`${colors.red}[${new Date().toLocaleTimeString()}] [SERVER] ${line}${colors.reset}`);
    }
  });
});

client.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    console.log(`${colors.blue}[${new Date().toLocaleTimeString()}] [CLIENT] ${line}${colors.reset}`);
  });
});

client.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    if (!line.includes('DeprecationWarning')) {
      console.error(`${colors.red}[${new Date().toLocaleTimeString()}] [CLIENT] ${line}${colors.reset}`);
    }
  });
});

vibeBackend.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    console.log(`${colors.magenta}[${new Date().toLocaleTimeString()}] [VIBE-BACKEND] ${line}${colors.reset}`);
  });
});

vibeBackend.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    console.log(`${colors.red}[${new Date().toLocaleTimeString()}] [VIBE-BACKEND] ${line}${colors.reset}`);
  });
});

ngrok.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    console.log(`${colors.bright}${colors.magenta}[${new Date().toLocaleTimeString()}] [NGROK] ${line}${colors.reset}`);
  });
});

ngrok.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    // Ignore some common ngrok info messages
    if (!line.includes('Update available') && !line.includes('http://127.0.0.1:4040')) {
      console.log(`${colors.yellow}[${new Date().toLocaleTimeString()}] [NGROK] ${line}${colors.reset}`);
    }
  });
});

// Handle exit
process.on('SIGINT', () => {
  console.log('\n' + `${colors.yellow}[${new Date().toLocaleTimeString()}] [SHUTDOWN] Stopping all services...${colors.reset}`);
  
  server.kill();
  client.kill();
  vibeBackend.kill();
  ngrok.kill();
  
  setTimeout(() => {
    process.exit(0);
  }, 1000);
});

// Handle process errors
server.on('error', (err) => {
  console.error(`${colors.red}[SERVER] Failed to start:${colors.reset}`, err);
});

client.on('error', (err) => {
  console.error(`${colors.red}[CLIENT] Failed to start:${colors.reset}`, err);
});

vibeBackend.on('error', (err) => {
  console.error(`${colors.red}[VIBE-BACKEND] Failed to start:${colors.reset}`, err);
});

ngrok.on('error', (err) => {
  console.error(`${colors.yellow}[NGROK] Failed to start (ngrok may not be installed):${colors.reset}`, err.message);
  console.log(`${colors.yellow}Install ngrok with: brew install ngrok${colors.reset}`);
});