#!/usr/bin/env node

import fetch from 'node-fetch';

async function testAPIs() {
  const baseUrl = 'http://localhost:7347';
  
  // Common test credentials - you may need to adjust these
  const credentials = [
    { username: 'guilherme-varela@hotmail.com', password: 'password' },
    { username: 'test@test.com', password: 'test123' },
    { username: 'test@test.com', password: 'password' },
    { username: 'admin', password: 'admin123' }
  ];
  
  let token = null;
  
  // Try to login with different credentials
  console.log('🔐 Attempting to authenticate...\n');
  for (const cred of credentials) {
    try {
      const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cred)
      });
      
      const data = await loginRes.json();
      if (data.success) {
        console.log(`✅ Login successful with: ${cred.username}`);
        token = data.token;
        break;
      }
    } catch (e) {
      // Try next credential
    }
  }
  
  if (!token) {
    console.log('❌ Could not authenticate with any credentials');
    console.log('Please provide valid credentials or run: node setup-user.js');
    return;
  }
  
  // Test prompt enhancer status
  console.log('\n📊 Testing Prompt Enhancer API Status...\n');
  try {
    const statusRes = await fetch(`${baseUrl}/api/prompt-enhancer/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const status = await statusRes.json();
    console.log('Available APIs:');
    console.log(`  • Gemini: ${status.gemini ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`  • OpenAI: ${status.openai ? '✅ Configured' : '❌ Not configured'}`);
    console.log(`  • Local: ${status.local ? '✅ Available' : '❌ Not available'}`);
    console.log(`  • Preferred Provider: ${status.preferredProvider || 'None'}`);
  } catch (error) {
    console.error('Error checking status:', error.message);
  }
  
  // Test actual enhancement
  console.log('\n🚀 Testing Prompt Enhancement...\n');
  const testPrompts = [
    { input: 'create a react component', mode: 'implementation' },
    { input: 'fix login error', mode: 'debug' },
    { input: 'design a landing page', mode: 'creative' }
  ];
  
  for (const test of testPrompts) {
    try {
      console.log(`Testing mode: ${test.mode}`);
      console.log(`Input: "${test.input}"`);
      
      const enhanceRes = await fetch(`${baseUrl}/api/prompt-enhancer/enhance`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(test)
      });
      
      const result = await enhanceRes.json();
      if (result.output) {
        console.log(`Provider: ${result.provider} ${result.model ? `(${result.model})` : ''}`);
        console.log(`Output preview: ${result.output.substring(0, 100)}...`);
        console.log('---');
      } else {
        console.log('Error:', result.error || 'No output');
        console.log('---');
      }
    } catch (error) {
      console.error(`Error testing ${test.mode}:`, error.message);
    }
  }
  
  console.log('\n✨ API Testing Complete!');
}

testAPIs().catch(console.error);