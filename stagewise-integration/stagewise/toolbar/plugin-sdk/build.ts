import { rmSync, cpSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Get the current directory (for ES modules)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const distPath = join(__dirname, 'dist');
const dependencyPath = join(
  __dirname,
  'node_modules/@stagewise/toolbar/dist/plugin-sdk',
);

console.log('🧹 Cleaning up existing dist folder...');
if (existsSync(distPath)) {
  rmSync(distPath, { recursive: true, force: true });
  console.log('✅ Existing dist folder removed');
} else {
  console.log('ℹ️  No existing dist folder found');
}

console.log('📦 Checking for dependency source...');
if (!existsSync(dependencyPath)) {
  console.error(`❌ Dependency not found at: ${dependencyPath}`);
  console.error('Make sure "@stagewise/toolbar/plugin-sdk" is installed');
  process.exit(1);
}

console.log('📁 Copying files from dependency to dist folder...');
try {
  cpSync(dependencyPath, distPath, {
    recursive: true,
    force: true,
  });
  console.log('✅ Files copied successfully to dist folder');
} catch (error) {
  console.error('❌ Error copying files:', error);
  process.exit(1);
}

console.log('🎉 Build completed successfully!');
