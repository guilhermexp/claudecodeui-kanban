#!/usr/bin/env node

import fetch from 'node-fetch';

async function testEnhancer() {
  // First login
  const loginRes = await fetch('http://localhost:7347/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'test@test.com',
      password: 'test123'
    })
  });
  
  const loginData = await loginRes.json();
  if (!loginData.success) {
    console.error('Login failed');
    return;
  }
  
  const token = loginData.token;
  console.log('Token obtained successfully\n');
  
  // Test the enhancer
  console.log('Testing prompt enhancer...');
  const enhanceRes = await fetch('http://localhost:7347/api/prompt-enhancer/enhance', {
    method: 'POST', 
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      input: 'create a user authentication system',
      mode: 'implementation'
    })
  });
  
  console.log('Response status:', enhanceRes.status);
  console.log('Response headers:', enhanceRes.headers.raw());
  
  const text = await enhanceRes.text();
  console.log('\nRaw response:');
  console.log(text);
  
  try {
    const data = JSON.parse(text);
    console.log('\nParsed response:');
    console.log('Provider:', data.provider);
    console.log('Model:', data.model);
    console.log('Error:', data.error);
    console.log('Output length:', data.output ? data.output.length : 0);
  } catch (e) {
    console.error('Failed to parse as JSON');
  }
}

testEnhancer().catch(console.error);