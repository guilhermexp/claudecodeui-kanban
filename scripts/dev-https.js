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
  return 'localhost';
}

// Check if certificates exist
function checkCertificates() {
  const certPath = path.join(__dirname, '..', 'certs', 'localhost.pem');
  const keyPath = path.join(__dirname, '..', 'certs', 'localhost-key.pem');
  return fs.existsSync(certPath) && fs.existsSync(keyPath);
}

const localIP = getLocalNetworkIP();

// Check for certificates
if (!checkCertificates()) {
  process.exit(1);
}


// Environment setup
const env = { ...process.env };
env.HOST = '0.0.0.0';
env.PORT = '7347';
env.VITE_PORT = '5892';

// Start server
const server = spawn('node', ['server/index.js'], { 
  env,
  stdio: 'pipe'
});

// Start client with HTTPS config
const client = spawn('npx', ['vite', '--config', 'vite.config.https.js'], { 
  env,
  stdio: 'pipe'
});

// Start Vibe backend
const vibeBackend = spawn('cargo', ['run', '--release'], {
  cwd: path.join(__dirname, '..', 'vibe-kanban'),
  env: { ...env, PORT: '6734', VIBE_NO_BROWSER: 'true' },
  stdio: 'pipe'
});

// Display ready message
setTimeout(() => {
}, 2000);

// Handle process outputs
server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
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
  });
});

vibeBackend.stderr.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
  });
});

// Handle exit
process.on('SIGINT', () => {
  
  server.kill();
  client.kill();
  vibeBackend.kill();
  
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