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
  console.log(`${colors.cyan}${colors.bright}
╔════════════════════════════════════════════════════════════════╗
║            Claude Code UI - Network Access Mode               ║
╚════════════════════════════════════════════════════════════════╝
${colors.reset}`);

  const localIP = getLocalNetworkIP();
  const hasAuth = hasUserDatabase();

  // Security warnings
  console.log(`${colors.yellow}${colors.bright}⚠️  AVISOS DE SEGURANÇA:${colors.reset}`);
  console.log(`${colors.yellow}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  if (!hasAuth) {
    console.log(`${colors.red}${colors.bright}❌ NENHUMA SENHA CONFIGURADA!${colors.reset}`);
    console.log(`${colors.red}   Qualquer pessoa na sua rede pode acessar o sistema.${colors.reset}`);
    console.log(`${colors.red}   Configure uma senha ao acessar pela primeira vez!${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✅ Autenticação ativada${colors.reset} - Login necessário para acessar\n`);
  }

  console.log(`${colors.yellow}Esta aplicação permite:${colors.reset}`);
  console.log('  • Executar comandos no seu computador');
  console.log('  • Ler e modificar arquivos');
  console.log('  • Acessar o Claude CLI com sua API key');
  console.log('  • Controlar projetos Git\n');

  console.log(`${colors.yellow}${colors.bright}Recomendações:${colors.reset}`);
  console.log('  1. Use APENAS em rede local confiável');
  console.log('  2. NUNCA exponha para a internet');
  console.log('  3. Configure senha forte se ainda não configurou');
  console.log('  4. Desative "Bypass Permissions" quando não precisar\n');

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  // Network information
  console.log(`${colors.green}${colors.bright}🌐 Endereços de Acesso:${colors.reset}`);
  console.log(`${colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
  
  console.log(`${colors.bright}Deste computador:${colors.reset}`);
  console.log(`  ${colors.blue}http://localhost:9000${colors.reset}\n`);
  
  console.log(`${colors.bright}De outros dispositivos na rede:${colors.reset}`);
  console.log(`  ${colors.blue}http://${localIP}:9000${colors.reset}\n`);
  
  console.log(`${colors.bright}Seu IP na rede local:${colors.reset} ${localIP}`);
  console.log(`${colors.bright}Nome do computador:${colors.reset} ${os.hostname()}\n`);

  console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

  // Set environment variables for network access
  const env = {
    ...process.env,
    HOST: '0.0.0.0',
    VITE_HOST: '0.0.0.0',
    VITE_API_URL: `http://${localIP}:8080`,
    VITE_WS_URL: `ws://${localIP}:8080`,
    PORT: '8080',
    VITE_PORT: '9000'
  };

  console.log(`${colors.green}🚀 Iniciando servidores...${colors.reset}\n`);

  // Start the smart dev orchestrator with network access
  const devProcess = spawn('npm', ['run', 'dev'], {
    stdio: 'inherit',
    env,
    shell: true
  });

  // Handle exit
  process.on('SIGINT', () => {
    console.log(`\n${colors.yellow}Encerrando servidores...${colors.reset}`);
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