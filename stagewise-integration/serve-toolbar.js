/**
 * Simple static server for Stagewise toolbar
 * Serves the toolbar files with proper MIME types and CORS headers
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocket, WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 5555;

// Enable CORS for all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

// Serve toolbar files
app.use('/toolbar', express.static(path.join(__dirname, 'stagewise/toolbar/core/dist/toolbar-main'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    }
  }
}));

// Serve toolbar config
app.get('/toolbar/config.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(`
    // Toolbar configuration
    const config = {
      agentInterface: {
        type: 'custom',
        wsUrl: 'ws://localhost:3456/ws',
        httpUrl: 'http://localhost:3456',
        clientUrl: 'ws://localhost:3456/ws'
      },
      plugins: [],
      devAppPort: 5173,
      appPort: 5173,
      bridgeMode: false,
      wsPath: '/ws'
    };
    export default config;
  `);
});

// Serve the toolbar HTML pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'toolbar-loader.html'));
});

app.get('/simple-toolbar.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'simple-toolbar.html'));
});

app.get('/toolbar-loader.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'toolbar-loader.html'));
});

app.get('/test-toolbar.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-toolbar.html'));
});

app.get('/toolbar-fixed.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'toolbar-fixed.html'));
});

// Create HTTP server to handle WebSocket upgrades
const server = app.listen(PORT, () => {
  console.log(`Toolbar server running at http://localhost:${PORT}`);
});

// Handle WebSocket upgrades - proxy to adapter server
server.on('upgrade', (request, socket, head) => {
  const url = request.url;
  console.log('WebSocket upgrade request:', url);
  
  if (url === '/stagewise-toolbar-app/karton') {
    // Proxy to our adapter server
    const ws = new WebSocket('ws://localhost:3456/ws');
    
    ws.on('open', () => {
      console.log('Proxying WebSocket connection to adapter');
      
      // Create WebSocket from the upgrade
      const wss = new WebSocketServer({ noServer: true });
      wss.handleUpgrade(request, socket, head, (client) => {
        // Proxy messages between client and adapter
        client.on('message', (msg) => {
          console.log('Client -> Adapter:', msg.toString().substring(0, 100));
          ws.send(msg);
        });
        
        ws.on('message', (msg) => {
          console.log('Adapter -> Client:', msg.toString().substring(0, 100));
          client.send(msg);
        });
        
        client.on('close', () => ws.close());
        ws.on('close', () => client.close());
      });
    });
    
    ws.on('error', (err) => {
      console.error('Error connecting to adapter:', err);
      socket.destroy();
    });
  } else {
    socket.destroy();
  }
});