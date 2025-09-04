#!/usr/bin/env node

// Quick setup script to create a default user for Claude Code UI
import fetch from 'node-fetch';

async function setupUser() {
  const baseUrl = 'http://localhost:7347';
  
  // First check if setup is needed
  try {
    const statusRes = await fetch(`${baseUrl}/api/auth/status`);
    const status = await statusRes.json();
    
    if (!status.needsSetup) {
      console.log('✓ User already exists. Try logging in with your credentials.');
      return;
    }
    
    // Create default user
    console.log('Creating default user...');
    const registerRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin',
        password: 'admin123'
      })
    });
    
    const result = await registerRes.json();
    
    if (result.success) {
      console.log('✅ User created successfully!');
      console.log('Username: admin');
      console.log('Password: admin123');
      console.log('\nYou can now login with these credentials.');
    } else {
      console.error('Failed to create user:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.message);
    console.log('\nMake sure the server is running (npm run dev)');
  }
}

setupUser();