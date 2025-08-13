#!/usr/bin/env node

// Script para testar a proteção de portas
// Simula um processo tentando usar as portas do Claude Code UI

import { spawn } from 'child_process';
import net from 'net';

const PROTECTED_PORTS = [8080, 9000, 8081];

console.log('🚀 Testing Port Protection...');
console.log(`Attempting to occupy Claude Code UI ports: ${PROTECTED_PORTS.join(', ')}`);

// Function to try to occupy a port
function occupyPort(port) {
  console.log(`\n🎯 Attempting to occupy port ${port}...`);
  
  const server = net.createServer();
  
  server.listen(port, () => {
    console.log(`✅ Successfully occupied port ${port}! (This should be detected and killed)`);
    
    // Keep server alive for a while
    setTimeout(() => {
      server.close();
      console.log(`⚰️  Released port ${port} voluntarily`);
    }, 30000); // Keep alive for 30 seconds
  });
  
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`❌ Port ${port} is already in use (likely by Claude Code UI)`);
    } else {
      console.log(`❌ Error occupying port ${port}: ${err.message}`);
    }
  });
  
  server.on('close', () => {
    console.log(`🔒 Port ${port} was closed (possibly by Port Protection Service)`);
  });
  
  return server;
}

// Try to occupy all protected ports
const servers = [];

for (const port of PROTECTED_PORTS) {
  setTimeout(() => {
    const server = occupyPort(port);
    servers.push(server);
  }, 1000 * PROTECTED_PORTS.indexOf(port));
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down test servers...');
  servers.forEach(server => {
    if (server && !server.destroyed) {
      server.close();
    }
  });
  process.exit(0);
});

console.log('\n💡 This script will try to occupy protected ports.');
console.log('💡 If port protection is working, these attempts should be blocked.');
console.log('💡 Press Ctrl+C to stop the test.');