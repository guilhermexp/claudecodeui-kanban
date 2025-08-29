#!/usr/bin/env node

import fetch from 'node-fetch';
import pkg from 'eventsource';
const { EventSource } = pkg;

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTc1NjQ2MzgwOH0.4jNdzv_muZIzamNt_2SbASF0e82u2F-9hqCELSj_dac';
const sessionId = 'test-' + Date.now();
const baseUrl = 'http://localhost:7347';

console.log('🚀 Testing Claude Chat Integration');
console.log('Session ID:', sessionId);

// Step 1: Establish SSE connection
console.log('\n1. Establishing SSE connection...');
const eventSource = new EventSource(`${baseUrl}/api/claude-stream/stream/${sessionId}`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

eventSource.onopen = () => {
  console.log('✅ SSE connection established');
};

eventSource.onerror = (error) => {
  console.error('❌ SSE error:', error);
  process.exit(1);
};

let realSessionId = null;

eventSource.addEventListener('session', (event) => {
  const data = JSON.parse(event.data);
  if (data.realSessionId) {
    realSessionId = data.realSessionId;
    console.log('📝 Real session ID received:', realSessionId);
  }
});

eventSource.addEventListener('patch', (event) => {
  const data = JSON.parse(event.data);
  console.log('📦 Patch received:', JSON.stringify(data, null, 2));
});

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);
  console.log('💬 Message:', data);
});

// Step 2: Send a message after connection is ready
setTimeout(async () => {
  console.log('\n2. Sending test message...');
  
  try {
    const response = await fetch(`${baseUrl}/api/claude-stream/message/${sessionId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        message: 'Hello Claude, can you see this message?',
        workingDir: process.cwd()
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Message sent successfully');
      console.log('Response:', result);
    } else {
      console.error('❌ Failed to send message:', result);
    }
  } catch (error) {
    console.error('❌ Error sending message:', error);
  }
  
  // Keep connection open for 10 seconds to receive responses
  setTimeout(() => {
    console.log('\n🛑 Closing connection...');
    eventSource.close();
    process.exit(0);
  }, 10000);
}, 2000);