#!/usr/bin/env node

import bcrypt from 'bcrypt';
import { userDb } from '../server/database/db.js';

const command = process.argv[2];

function listUsers() {
  const users = userDb.getAllUsers();
  console.log('\nCurrent users:');
  users.forEach(user => {
    console.log(`  - ID: ${user.id}, Username: ${user.username}, Created: ${user.created_at}`);
  });
  console.log(`\nTotal: ${users.length} users\n`);
}

async function createUser(username, password) {
  try {
    if (!username || !password) {
      console.error('Error: Username and password are required');
      process.exit(1);
    }

    // Check if user already exists
    const existing = userDb.getUserByUsername(username);
    if (existing) {
      console.error(`Error: User '${username}' already exists`);
      process.exit(1);
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Create user
    const user = userDb.createUser(username, passwordHash);
    console.log(`✅ User created successfully: ${user.username} (ID: ${user.id})`);
  } catch (error) {
    console.error('Error creating user:', error.message);
    process.exit(1);
  }
}

async function resetPassword(username, newPassword) {
  try {
    if (!username || !newPassword) {
      console.error('Error: Username and new password are required');
      process.exit(1);
    }

    // Get user
    const user = userDb.getUserByUsername(username);
    if (!user) {
      console.error(`Error: User '${username}' not found`);
      process.exit(1);
    }

    // Hash new password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    userDb.updateUserPassword(user.id, passwordHash);
    console.log(`✅ Password reset successfully for user: ${username}`);
  } catch (error) {
    console.error('Error resetting password:', error.message);
    process.exit(1);
  }
}

async function deleteUser(username) {
  try {
    if (!username) {
      console.error('Error: Username is required');
      process.exit(1);
    }

    // Get user
    const user = userDb.getUserByUsername(username);
    if (!user) {
      console.error(`Error: User '${username}' not found`);
      process.exit(1);
    }

    // Delete user
    userDb.deleteUser(user.id);
    console.log(`✅ User deleted successfully: ${username}`);
  } catch (error) {
    console.error('Error deleting user:', error.message);
    process.exit(1);
  }
}

// Main command handler
async function main() {
  switch (command) {
    case 'list':
      listUsers();
      break;
    
    case 'create':
      await createUser(process.argv[3], process.argv[4]);
      break;
    
    case 'reset':
      await resetPassword(process.argv[3], process.argv[4]);
      break;
    
    case 'delete':
      await deleteUser(process.argv[3]);
      break;
    
    default:
      console.log(`
Claude Code UI - User Management

Usage:
  node scripts/user-management.js <command> [options]

Commands:
  list                          List all users
  create <username> <password>  Create a new user
  reset <username> <password>   Reset user password
  delete <username>             Delete a user

Examples:
  node scripts/user-management.js list
  node scripts/user-management.js create admin@example.com admin123
  node scripts/user-management.js reset admin@example.com newpassword
  node scripts/user-management.js delete admin@example.com
`);
  }
  
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
