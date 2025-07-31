#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'fs';
import { glob } from 'glob';
import path from 'path';

const DRY_RUN = process.argv.includes('--dry-run');
const AGGRESSIVE = process.argv.includes('--aggressive');


// Find all JS/TS files excluding node_modules and dist
const files = glob.sync('**/*.{js,jsx,ts,tsx}', {
  ignore: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/target/**',
    '**/.next/**',
    '**/coverage/**'
  ]
});

let totalRemoved = 0;
const filesWithLogs = [];

files.forEach(file => {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  let modified = false;
  let removedInFile = 0;
  
  const newLines = lines.map((line, index) => {
    // Skip if it's part of a string or comment
    const trimmed = line.trim();
    
    // Keep console statements in certain files
    const keepFiles = ['logger.js', 'debug.js', 'test.js', 'test.ts', '.test.jsx', '.test.tsx'];
    if (keepFiles.some(keep => file.includes(keep))) {
      return line;
    }
    
    // Remove console.log, console.warn, console.info, console.debug
    // Keep console.error unless aggressive mode
    const consolePattern = AGGRESSIVE 
      ? /console\.(log|warn|error|info|debug|trace|time|timeEnd|group|groupEnd)\s*\(/
      : /console\.(log|warn|info|debug|trace|time|timeEnd|group|groupEnd)\s*\(/;
    
    if (consolePattern.test(line) && !line.includes('// keep') && !line.includes('// eslint-disable')) {
      // Check if it's a multi-line console statement
      let openParens = (line.match(/\(/g) || []).length;
      let closeParens = (line.match(/\)/g) || []).length;
      let linesToRemove = 1;
      
      if (openParens > closeParens) {
        // Multi-line console statement
        let i = index + 1;
        while (i < lines.length && openParens > closeParens) {
          openParens += (lines[i].match(/\(/g) || []).length;
          closeParens += (lines[i].match(/\)/g) || []).length;
          linesToRemove++;
          i++;
        }
      }
      
      modified = true;
      removedInFile++;
      totalRemoved++;
      
      // Return empty string to remove the line
      return null;
    }
    
    return line;
  }).filter(line => line !== null);
  
  if (modified) {
    filesWithLogs.push({ file, count: removedInFile });
    
    if (!DRY_RUN) {
      writeFileSync(file, newLines.join('\n'));
    }
  }
});


if (filesWithLogs.length > 0) {
  filesWithLogs
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .forEach(({ file, count }) => {
    });
    
  if (filesWithLogs.length > 20) {
  }
}

if (DRY_RUN) {
}
