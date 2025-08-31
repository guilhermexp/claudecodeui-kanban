#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');


// Limpar cache do Node.js
try {
  const nodeModulesCache = path.join(rootDir, 'node_modules/.cache');
  if (fs.existsSync(nodeModulesCache)) {
    fs.rmSync(nodeModulesCache, { recursive: true, force: true });
  } else {
  }
} catch (err) {
}

// Limpar cache do Vite
try {
  const viteCache = path.join(rootDir, 'node_modules/.vite');
  if (fs.existsSync(viteCache)) {
    fs.rmSync(viteCache, { recursive: true, force: true });
  } else {
  }
} catch (err) {
}

// Limpar banco de dados temporário (se existir)
const tempDbs = [
  path.join(rootDir, 'server/database/projects.db-wal'),
  path.join(rootDir, 'server/database/projects.db-shm'),
  path.join(rootDir, 'server/database/users.db-wal'),
  path.join(rootDir, 'server/database/users.db-shm'),
];

tempDbs.forEach(dbFile => {
  if (fs.existsSync(dbFile)) {
    try {
      fs.unlinkSync(dbFile);
    } catch (err) {
    }
  }
});

// Informações sobre o que fazer no navegador
