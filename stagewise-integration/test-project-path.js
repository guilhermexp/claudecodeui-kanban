import WebSocket from 'ws';

const ws = new WebSocket('ws://localhost:3456/ws');

// Simula um projeto em /Users/guilhermevarela/Documents/Repositorios/Codeui
const testProjectPath = '/Users/guilhermevarela/Documents/Repositorios/Codeui';

ws.on('open', () => {
  console.log('Connected to adapter server');
  
  // Send a test message with project path
  const testMessage = {
    type: 'user.message',
    message: {
      content: [{
        type: 'text',
        text: 'What directory are you in? List the files in the current directory with ls command'
      }],
      projectPath: testProjectPath
    }
  };
  
  console.log('Sending message with project path:', testProjectPath);
  ws.send(JSON.stringify(testMessage));
});

ws.on('message', (data) => {
  const message = JSON.parse(data.toString());
  
  if (message.type === 'messaging.update' && message.data.parts.length > 0) {
    const part = message.data.parts[0];
    if (part.type === 'text') {
      console.log('\n📍 Codex Response:');
      console.log(part.text);
      
      // Check if response contains expected project files
      if (part.text.includes('src') || part.text.includes('package.json')) {
        console.log('\n✅ SUCCESS: Codex is running in the correct project directory!');
      } else {
        console.log('\n⚠️  WARNING: Response doesn\'t seem to show expected project files');
      }
    }
  }
});

ws.on('error', (err) => {
  console.error('WebSocket error:', err);
});

ws.on('close', () => {
  console.log('Connection closed');
});

// Keep process alive for 20 seconds
setTimeout(() => {
  console.log('Closing connection...');
  ws.close();
  process.exit();
}, 20000);