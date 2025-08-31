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
  cyan: '\x1b[36m'
};

// Get local network IP
function getLocalNetworkIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.internal || iface.family !== 'IPv4') continue;
      // Prefer en0/eth0/wlan0 interfaces
      if (name.startsWith('en') || name.startsWith('eth') || name.startsWith('wlan')) {
        return iface.address;
      }
    }
  }
  // Fallback to any non-internal IPv4
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

// Main function
async function startNetworkServer() {
  console.clear();
╔════════════════════════════════════════════════════════════════╗
║            Claude Code UI - Network Access Mode               ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  const localIP = getLocalNetworkIP();
  const hasAuth = hasUserDatabase();

  // Security warnings

  if (!hasAuth) {
  } else {
  }




  // Network information
  
  
  


  // Set environment variables for network access
  const env = {
    ...process.env,
    HOST: '0.0.0.0',
    VITE_HOST: '0.0.0.0',
    VITE_API_URL: `http://${localIP}:7347`,
    VITE_WS_URL: `ws://${localIP}:7347`,
    PORT: '7347',
    VITE_PORT: '5892'
  };


  // Start the smart dev orchestrator with network access
  const devProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env,
    shell: true
  });

  // Handle exit
  process.on('SIGINT', () => {
    devProcess.kill('SIGINT');
    process.exit(0);
  });

  devProcess.on('error', (err) => {
    console.error(`${colors.red}Erro ao iniciar servidor:${colors.reset}`, err);
    process.exit(1);
  });

  devProcess.on('exit', (code) => {
    if (code !== null && code !== 0) {
      console.error(`${colors.red}Servidor encerrado com código ${code}${colors.reset}`);
    }
    process.exit(code || 0);
  });
}

// Run the script
startNetworkServer().catch(err => {
  console.error(`${colors.red}Erro fatal:${colors.reset}`, err);
  process.exit(1);
});