#!/usr/bin/env node

import fetch from 'node-fetch';

async function testAPIs() {
  const baseUrl = 'http://localhost:7347';
  
  const cred = { username: 'test@test.com', password: 'test123' };
  
  let token = null;
  
  console.log('🔐 Attempting to authenticate...\n');
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
    }
  } catch {}

  if (!token) {
    console.log('No user found — registering test user...');
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cred)
    });
    const regData = await regRes.json();
    if (regData.success) {
      console.log('✅ Registration successful');
      token = regData.token;
    }
  }
  
  if (!token) {
    console.log('❌ Could not authenticate/register');
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

  // Test projects list (should not error, may be empty)
  console.log('\n📁 Testing Projects API...\n');
  try {
    const res = await fetch(`${baseUrl}/api/projects`, { headers: { 'Authorization': `Bearer ${token}` } });
    console.log('Projects status:', res.status);
    const txt = await res.text();
    console.log('Projects raw:', txt.slice(0, 120).replace(/\n/g,' '), '...');
    try {
      const data = JSON.parse(txt);
      console.log('Projects length:', Array.isArray(data) ? data.length : (Array.isArray(data?.projects) ? data.projects.length : 0));
    } catch {}
  } catch (error) {
    console.error('Projects error:', error.message);
  }

  // Test TTS summarize (expected to error if keys/scripts missing, but endpoint should respond JSON)
  console.log('\n🔊 Testing TTS Summarize (expect graceful error without keys)...\n');
  try {
    const res = await fetch(`${baseUrl}/api/tts/gemini-summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text: 'Este é um teste de síntese em áudio.', voiceName: 'Zephyr' })
    });
    const data = await res.json();
    console.log('TTS status:', res.status, 'error:', data.error || 'none');
  } catch (error) {
    console.error('TTS error:', error.message);
  }
  
  console.log('\n✨ API Testing Complete!');
}

testAPIs().catch(console.error);