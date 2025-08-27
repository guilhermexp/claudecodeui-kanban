import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3456/ws');

ws.on('open', () => {
  console.log('Connected to adapter server');
  
  // Send a test message to Codex
  const testMessage = {
    type: 'user.message',
    message: {
      content: [{
        type: 'text',
        text: 'Explain what JavaScript is in a simple way'
      }]
    }
  };
  
  console.log('Sending message to trigger typing indicator...');
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  // Log different message types differently
  if (message.type === 'state.update') {
    console.log('📍 State:', message.data.state, '-', message.data.description);
  } else if (message.type === 'messaging.update') {
    const parts = message.data.parts || [];
    if (parts[0]?.type === 'typing') {
      console.log('⌨️  Typing:', parts[0].text);
    } else if (parts[0]?.type === 'text') {
      console.log('💬 Response:', parts[0].text);
    }
  } else if (message.type === 'connected') {
    console.log('✅ Connected:', message.data.state.description);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket error:', err);
});

ws.on('close', () => {
  console.log('👋 Connection closed');
});

// Keep process alive for 15 seconds
setTimeout(() => {
  console.log('⏱️  Closing connection...');
  ws.close();
  process.exit();
}, 15000);