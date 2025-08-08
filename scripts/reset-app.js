#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

console.log('🔄 Resetando Claude Code UI...\n');

// Limpar cache do Node.js
console.log('1. Limpando cache do Node.js...');
try {
  const nodeModulesCache = path.join(rootDir, 'node_modules/.cache');
  if (fs.existsSync(nodeModulesCache)) {
    fs.rmSync(nodeModulesCache, { recursive: true, force: true });
    console.log('   ✅ Cache do Node.js limpo');
  } else {
    console.log('   ℹ️  Nenhum cache do Node.js encontrado');
  }
} catch (err) {
  console.log('   ❌ Erro ao limpar cache do Node.js:', err.message);
}

// Limpar cache do Vite
console.log('2. Limpando cache do Vite...');
try {
  const viteCache = path.join(rootDir, 'node_modules/.vite');
  if (fs.existsSync(viteCache)) {
    fs.rmSync(viteCache, { recursive: true, force: true });
    console.log('   ✅ Cache do Vite limpo');
  } else {
    console.log('   ℹ️  Nenhum cache do Vite encontrado');
  }
} catch (err) {
  console.log('   ❌ Erro ao limpar cache do Vite:', err.message);
}

// Limpar banco de dados temporário (se existir)
console.log('3. Verificando bancos temporários...');
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
      console.log(`   ✅ Removido: ${path.basename(dbFile)}`);
    } catch (err) {
      console.log(`   ❌ Erro ao remover ${path.basename(dbFile)}:`, err.message);
    }
  }
});

// Informações sobre o que fazer no navegador
console.log('\n4. Próximos passos:\n');
console.log('   🌐 No seu navegador:');
console.log('      • Pressione Ctrl+Shift+R (ou Cmd+Shift+R no Mac) para recarregar');
console.log('      • Ou abra Developer Tools (F12) > Application > Storage > Clear storage');
console.log('      • Ou use modo incognito/privado');
console.log('');
console.log('   🔄 Para reiniciar completamente:');
console.log('      • Pare o servidor (Ctrl+C)');
console.log('      • Execute: npm run dev');
console.log('');

console.log('✅ Reset concluído!');