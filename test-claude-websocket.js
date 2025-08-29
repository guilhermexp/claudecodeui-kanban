// Test Claude WebSocket communication
const WebSocket = require('ws');

async function testClaudeWebSocket() {
  console.log('🧪 Testing Claude WebSocket communication...\n');
  
  // Get auth token
  const token = 'test-token'; // You'll need a real token
  
  // Connect to WebSocket
  const ws = new WebSocket(`ws://localhost:7347/shell?token=${token}`);
  
  ws.on('open', () => {
    console.log('✅ WebSocket connected');
    
    // Send Claude command
    const command = {
      type: 'claude-command',
      command: 'Say hello',
      options: {
        projectPath: process.cwd(),
        cwd: process.cwd(),
        sessionId: `test-${Date.now()}`,
        resume: false
      }
    };
    
    console.log('📤 Sending command:', command);
    ws.send(JSON.stringify(command));
  });
  
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    console.log('📥 Received:', msg.type);
    
    if (msg.type === 'claude-response') {
      console.log('✅ Claude responded:', msg.text);
    }
    
    if (msg.type === 'claude-error') {
      console.log('❌ Error:', msg.error);
    }
    
    if (msg.type === 'claude-complete') {
      console.log('✅ Claude completed');
      ws.close();
    }
  });
  
  ws.on('error', (err) => {
    console.error('❌ WebSocket error:', err);
  });
  
  ws.on('close', () => {
    console.log('🔚 WebSocket closed');
  });
}

testClaudeWebSocket();