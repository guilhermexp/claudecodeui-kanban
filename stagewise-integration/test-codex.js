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
        text: 'Say hello and tell me what is 2+2'
      }]
    }
  };
  
  console.log('Sending test message:', testMessage);
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  console.log('Received:', JSON.stringify(message, null, 2));
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});

ws.on('close', () => {
  console.log('Connection closed');
});

// Keep process alive
setTimeout(() => {
  console.log('Closing connection...');
  ws.close();
  process.exit();
}, 30000); // Wait 30 seconds for response