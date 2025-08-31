#!/usr/bin/env node

import { execSync } from 'child_process';

const command = process.argv[2];

if (command === 'stop-all') {
  try {
    // Kill frontend
    execSync("lsof -ti:5892 | xargs kill -9 2>/dev/null || true", { stdio: 'inherit' });
    // Kill backend
    execSync("lsof -ti:7347 | xargs kill -9 2>/dev/null || true", { stdio: 'inherit' });
    // Kill Vibe Kanban
    execSync("lsof -ti:6734 | xargs kill -9 2>/dev/null || true", { stdio: 'inherit' });
  } catch (error) {
  }
} else if (command === 'detect') {
  // Detect current mode based on running processes
  try {
    const frontend = execSync("lsof -ti:5892", { encoding: 'utf8' }).trim();
    const backend = execSync("lsof -ti:7347", { encoding: 'utf8' }).trim();
    const vibe = execSync("lsof -ti:6734", { encoding: 'utf8' }).trim();
    
    if (frontend && backend && vibe) {
    } else if (backend && vibe && !frontend) {
    } else if (frontend || backend || vibe) {
    } else {
    }
  } catch (error) {
  }
} else if (command === 'stop-dev') {
  try {
    // Kill only frontend (dev mode specific)
    execSync("lsof -ti:5892 | xargs kill -9 2>/dev/null || true", { stdio: 'inherit' });
  } catch (error) {
  }
} else if (command === 'port-status') {
  try {
    const frontend = execSync("lsof -ti:5892", { encoding: 'utf8' }).trim();
    const backend = execSync("lsof -ti:7347", { encoding: 'utf8' }).trim();
    const vibe = execSync("lsof -ti:6734", { encoding: 'utf8' }).trim();
    
  } catch (error) {
  }
} else {
}