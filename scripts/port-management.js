#!/usr/bin/env node

import { execSync } from 'child_process';

const command = process.argv[2];

if (command === 'stop-all') {
  console.log('Stopping all Claude Code UI processes...');
  try {
    // Kill frontend
    execSync("lsof -ti:5892 | xargs kill -9 2>/dev/null || true", { stdio: 'inherit' });
    // Kill backend
    execSync("lsof -ti:7347 | xargs kill -9 2>/dev/null || true", { stdio: 'inherit' });
    // Kill Vibe Kanban
    execSync("lsof -ti:6734 | xargs kill -9 2>/dev/null || true", { stdio: 'inherit' });
    console.log('All processes stopped.');
  } catch (error) {
    console.log('Some processes may have already been stopped.');
  }
} else if (command === 'detect') {
  // Detect current mode based on running processes
  try {
    const frontend = execSync("lsof -ti:5892", { encoding: 'utf8' }).trim();
    const backend = execSync("lsof -ti:7347", { encoding: 'utf8' }).trim();
    const vibe = execSync("lsof -ti:6734", { encoding: 'utf8' }).trim();
    
    if (frontend && backend && vibe) {
      console.log('Current mode: DEVELOPMENT');
    } else if (backend && vibe && !frontend) {
      console.log('Current mode: PRODUCTION');
    } else if (frontend || backend || vibe) {
      console.log('Current mode: MIXED');
    } else {
      console.log('Current mode: STOPPED');
    }
  } catch (error) {
    console.log('Current mode: UNKNOWN');
  }
} else if (command === 'stop-dev') {
  console.log('Stopping development mode processes...');
  try {
    // Kill only frontend (dev mode specific)
    execSync("lsof -ti:5892 | xargs kill -9 2>/dev/null || true", { stdio: 'inherit' });
    console.log('Development processes stopped.');
  } catch (error) {
    console.log('Development processes may have already been stopped.');
  }
} else if (command === 'port-status') {
  console.log('Checking port status...');
  try {
    const frontend = execSync("lsof -ti:5892", { encoding: 'utf8' }).trim();
    const backend = execSync("lsof -ti:7347", { encoding: 'utf8' }).trim();
    const vibe = execSync("lsof -ti:6734", { encoding: 'utf8' }).trim();
    
    console.log('Port Status:');
    console.log(`Frontend (5892): ${frontend ? 'ACTIVE' : 'FREE'}`);
    console.log(`Backend (7347): ${backend ? 'ACTIVE' : 'FREE'}`);
    console.log(`Vibe Kanban (6734): ${vibe ? 'ACTIVE' : 'FREE'}`);
  } catch (error) {
    console.log('Ports are free.');
  }
} else {
  console.log('Unknown command:', command);
}