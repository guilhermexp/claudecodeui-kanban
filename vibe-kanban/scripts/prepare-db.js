#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');


// Change to backend directory
const backendDir = path.join(__dirname, '..', 'backend');
process.chdir(backendDir);

// Create temporary database file
const dbFile = path.join(backendDir, 'prepare_db.sqlite');
fs.writeFileSync(dbFile, '');

try {
  // Get absolute path (cross-platform)
  const dbPath = path.resolve(dbFile);
  const databaseUrl = `sqlite:${dbPath}`;
  
  
  // Run migrations
  execSync('cargo sqlx migrate run', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });
  
  // Prepare queries
  execSync('cargo sqlx prepare', {
    stdio: 'inherit', 
    env: { ...process.env, DATABASE_URL: databaseUrl }
  });
  
  
} finally {
  // Clean up temporary file
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }
}