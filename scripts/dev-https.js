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
  console.log(`${colors.yellow}⚠️  Certificados HTTPS não encontrados!${colors.reset}`);
  console.log(`${colors.yellow}   Execute primeiro: ./scripts/setup-https.sh${colors.reset}`);
  console.log('');
  process.exit(1);
}

console.log(`${colors.cyan}[${new Date().toLocaleTimeString()}] [INIT] Starting Claude Code UI with HTTPS${colors.reset}`);
console.log('');

// Environment setup
const env = { ...process.env };
env.HOST = '0.0.0.0';
env.PORT = '8080';
env.VITE_PORT = '9000';

// Start server
console.log(`${colors.green}[${new Date().toLocaleTimeString()}] [SERVER] Starting: node server/index.js${colors.reset}`);
const server = spawn('node', ['server/index.js'], { 
  env,
  stdio: 'pipe'
});

// Start client with HTTPS config
console.log(`${colors.blue}[${new Date().toLocaleTimeString()}] [CLIENT] Starting: npx vite --config vite.config.https.js${colors.reset}`);
const client = spawn('npx', ['vite', '--config', 'vite.config.https.js'], { 
  env,
  stdio: 'pipe'
});

// Start Vibe backend
console.log(`${colors.magenta}[${new Date().toLocaleTimeString()}] [VIBE-BACKEND] Starting: cargo run --release${colors.reset}`);
const vibeBackend = spawn('cargo', ['run', '--release'], {
  cwd: path.join(__dirname, '..', 'vibe-kanban'),
  env: { ...env, PORT: '8081', VIBE_NO_BROWSER: 'true' },
  stdio: 'pipe'
});

// Display ready message
setTimeout(() => {
  console.log('');
  console.log(`${colors.bright}✅ HTTPS Local Configurado!${colors.reset}`);
  console.log('');
  console.log(`${colors.bright}📱 URLs de Acesso (com HTTPS):${colors.reset}`);
  console.log(`${colors.green}  🔒 https://localhost:9000${colors.reset}`);
  console.log(`${colors.green}  🔒 https://${localIP}:9000${colors.reset}`);
  console.log('');
  console.log(`${colors.yellow}⚠️  Primeira vez: Aceite o certificado no navegador${colors.reset}`);
  console.log(`${colors.cyan}🎤 Microfone funcionará em ambas URLs!${colors.reset}`);
  console.log('');
  console.log(`${colors.bright}Vantagens:${colors.reset}`);
  console.log('  ✅ Não precisa de túnel externo');
  console.log('  ✅ Funciona na rede local');
  console.log('  ✅ HTTPS para microfone');
  console.log('  ✅ Mais rápido que ngrok');
  console.log('');
}, 2000);

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

// Handle exit
process.on('SIGINT', () => {
  console.log('\n' + `${colors.yellow}[${new Date().toLocaleTimeString()}] [SHUTDOWN] Stopping all services...${colors.reset}`);
  
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