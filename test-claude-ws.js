const WebSocket = require('ws');

// Get auth token
const token = process.env.AUTH_TOKEN || 'test-token';

// Connect to WebSocket
const ws = new WebSocket(`ws://localhost:7347/ws?token=${token}`);

ws.on('open', () => {
  console.log('Connected to WebSocket');
  
  // Start Claude session
  ws.send(JSON.stringify({
    type: 'claude-start-session',
    options: { projectPath: '/tmp/test' }
  }));
  
  // Send Claude command after a delay
  setTimeout(() => {
    ws.send(JSON.stringify({
      type: 'claude-command',
      command: 'say hello',
      options: { 
        projectPath: '/tmp/test',
        cwd: '/tmp/test'
      }
    }));
  }, 1000);
});

ws.on('message', (data) => {
  console.log('Received:', JSON.parse(data.toString()));
});

ws.on('error', (error) => {
  console.error('WebSocket error:', error);
});

ws.on('close', () => {
  console.log('WebSocket closed');
});

// Exit after 10 seconds
setTimeout(() => {
  ws.close();
  process.exit(0);
}, 10000);
