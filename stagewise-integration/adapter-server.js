/**
 * Stagewise Adapter Server
 * 
 * Este servidor atua como ponte entre o Stagewise toolbar e CLIs locais
 * (Claude Code, Codex, etc). Ele expõe o protocolo agent-interface do Stagewise
 * e traduz comandos para os CLIs locais.
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuração
const PORT = process.env.ADAPTER_PORT || 3456;
const CLI_TYPE = process.env.CLI_TYPE || 'codex'; // 'claude', 'codex', etc

class CLIAdapter {
  constructor(cliType) {
    this.cliType = cliType;
    this.cliProcess = null;
    this.messageQueue = [];
    this.state = 'idle';
    this.availability = true;
    this.currentMessage = { id: null, parts: [] };
    this.userMessageListeners = [];
    this.isProcessing = false;
  }

  // Inicia o processo do CLI
  startCLI() {
    switch (this.cliType) {
      case 'claude':
        // Claude Code CLI
        this.cliProcess = spawn('claude', ['chat'], {
          shell: true,
          stdio: ['pipe', 'pipe', 'pipe']
        });
        break;
      case 'codex':
        // OpenAI Codex CLI - usando o mesmo comando do Vibe Kanban
        this.cliProcess = spawn('npx', [
          '@openai/codex',
          'exec',
          '--json',
          '--dangerously-bypass-approvals-and-sandbox',
          '--skip-git-repo-check'
        ], {
          shell: false,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            NODE_NO_WARNINGS: '1',
            RUST_LOG: 'info'
          }
        });
        break;
      default:
        console.error('CLI type not supported:', this.cliType);
        this.availability = false;
        return;
    }

    // Captura saída do CLI
    if (this.cliProcess) {
      this.cliProcess.stdout.on('data', (data) => {
        this.handleCLIOutput(data.toString());
      });

      this.cliProcess.stderr.on('data', (data) => {
        console.error('CLI Error:', data.toString());
      });

      this.cliProcess.on('close', (code) => {
        console.log('CLI process exited with code', code);
        this.availability = false;
        this.state = 'error';
      });
    }
  }

  // Processa saída do CLI e converte para formato Stagewise
  handleCLIOutput(output) {
    if (this.cliType === 'codex') {
      // Parse JSON output from Codex
      const lines = output.split('\n').filter(line => line.trim());
      let hasNewContent = false;
      
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          
          // Skip configuration and metadata messages
          if (json.prompt || json.reasoning_summaries || json.id === undefined) {
            continue;
          }
          
          // Process different message types from Codex
          if (json.msg?.type === 'agent_message') {
            // Only add the final assistant message
            this.currentMessage.parts = [{
              type: 'text',
              text: json.msg.message
            }];
            hasNewContent = true;
            // Send final update and mark as complete
            this.notifyMessageUpdate();
            this.setState('idle', 'Ready');
            return; // Stop processing after agent message
          } else if (json.msg?.type === 'agent_reasoning') {
            // Skip reasoning for now to avoid clutter
            continue;
          } else if (json.msg?.type === 'exec_command_begin') {
            const command = json.msg.command.join(' ');
            this.currentMessage.parts.push({
              type: 'tool_use',
              tool: 'bash',
              text: `Running: ${command}`
            });
            hasNewContent = true;
          } else if (json.msg?.type === 'exec_command_end' && json.msg.stdout) {
            this.currentMessage.parts.push({
              type: 'tool_result',
              text: json.msg.stdout
            });
            hasNewContent = true;
          } else if (json.msg?.type === 'error') {
            this.currentMessage.parts = [{
              type: 'error',
              text: json.msg.message || 'Unknown error occurred'
            }];
            hasNewContent = true;
            this.notifyMessageUpdate();
            this.setState('idle', 'Ready');
            return;
          }
        } catch (e) {
          // Skip non-JSON lines
        }
      }
      
      // Only notify if we have new content
      if (hasNewContent) {
        this.notifyMessageUpdate();
      }
    } else {
      // For other CLIs, just add as text
      this.currentMessage.parts.push({
        type: 'text',
        text: output
      });
      this.notifyMessageUpdate();
    }
  }

  // Envia comando para o CLI
  sendToCLI(message) {
    if (this.cliProcess && this.cliProcess.stdin) {
      this.cliProcess.stdin.write(message + '\n');
    }
  }

  // Notifica sobre atualização de mensagem
  notifyMessageUpdate() {
    // Aqui seria enviado via WebSocket para o toolbar
    if (this.ws && this.currentMessage.parts.length > 0) {
      // Only send if we have actual content
      const lastPart = this.currentMessage.parts[this.currentMessage.parts.length - 1];
      if (lastPart && lastPart.text && lastPart.text.trim()) {
        this.ws.send(JSON.stringify({
          type: 'messaging.update',
          data: this.currentMessage
        }));
      }
    }
  }

  // Interface methods do Stagewise
  getAvailability() {
    return {
      available: this.availability,
      error: this.availability ? null : 'cli_not_available'
    };
  }

  setAvailability(available, error) {
    this.availability = available;
  }

  getState() {
    return {
      state: this.state,
      description: `${this.cliType} CLI adapter`
    };
  }

  setState(state, description) {
    this.state = state;
  }

  getMessage() {
    return this.currentMessage.parts;
  }

  setMessage(content) {
    this.currentMessage.parts = content;
    this.notifyMessageUpdate();
  }

  addMessagePart(content) {
    if (Array.isArray(content)) {
      this.currentMessage.parts.push(...content);
    } else {
      this.currentMessage.parts.push(content);
    }
    this.notifyMessageUpdate();
  }

  clearMessage() {
    this.currentMessage = {
      id: Date.now().toString(),
      parts: []
    };
    // Don't send empty message update
  }

  handleUserMessage(message) {
    console.log('User message received:', message);
    
    if (this.isProcessing) {
      console.log('Already processing a message, ignoring');
      return;
    }
    
    // Muda estado para processando
    this.setState('processing', 'Processing user message');
    this.isProcessing = true;
    
    // Limpa mensagem anterior
    this.clearMessage();
    
    // Envia para o CLI
    if (message.content && message.content[0]?.type === 'text') {
      const userText = message.content[0].text;
      const projectPath = message.projectPath || null;
      
      if (this.cliType === 'codex') {
        // Para Codex, criar novo processo para cada mensagem com o diretório do projeto
        this.startCodexSession(userText, projectPath);
      } else {
        this.sendToCLI(userText);
      }
    }
    
    // Notifica listeners
    this.userMessageListeners.forEach(listener => listener(message));
  }
  
  startCodexSession(prompt, projectPath) {
    console.log('Starting Codex session with prompt:', prompt);
    console.log('Project path:', projectPath || 'Not specified');
    
    // Kill existing process if any
    if (this.cliProcess) {
      this.cliProcess.kill();
      this.cliProcess = null;
    }
    
    // Send processing state
    this.setState('processing', 'Processando...');
    
    // Build Codex command with project directory
    const codexArgs = [
      '@openai/codex',
      'exec',
      '--json',
      '--dangerously-bypass-approvals-and-sandbox',
      '--skip-git-repo-check'
    ];
    
    // Add directory flag if project path is provided
    if (projectPath) {
      codexArgs.push('-C', projectPath);
    }
    
    // Add the prompt as the last argument
    codexArgs.push(prompt);
    
    // Start new Codex process with the prompt
    this.cliProcess = spawn('npx', codexArgs, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        NODE_NO_WARNINGS: '1'
      },
      cwd: projectPath || process.cwd() // Also set working directory
    });
    
    // Handle output
    this.cliProcess.stdout.on('data', (data) => {
      console.log('Codex stdout:', data.toString());
      this.handleCLIOutput(data.toString());
    });

    this.cliProcess.stderr.on('data', (data) => {
      console.error('Codex stderr:', data.toString());
    });

    this.cliProcess.on('close', (code) => {
      console.log('Codex process exited with code', code);
      this.isProcessing = false;
      this.setState('idle', 'Ready');
    });
    
    this.cliProcess.on('error', (err) => {
      console.error('Failed to start Codex:', err);
      this.isProcessing = false;
      this.availability = false;
      this.setState('error', err.message);
    });
  }
}

// Cria instância do adapter
const adapter = new CLIAdapter(CLI_TYPE);

// Cria servidor Express
const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', '*');
  next();
});

// Endpoint de informação (descoberta do agente)
app.get('/info', (req, res) => {
  res.json({
    name: `${CLI_TYPE} Adapter`,
    version: '1.0.0',
    description: `Stagewise adapter for ${CLI_TYPE} CLI`,
    protocol: 'stagewise-agent/v1',
    capabilities: {
      availability: true,
      state: true,
      messaging: true
    }
  });
});

// WebSocket server para comunicação em tempo real
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
  adapter.ws = ws;

  // Envia estado inicial
  ws.send(JSON.stringify({
    type: 'connected',
    data: {
      availability: adapter.getAvailability(),
      state: adapter.getState()
    }
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('WebSocket message:', data);

      switch (data.type) {
        case 'availability.get':
          ws.send(JSON.stringify({
            type: 'availability.response',
            data: adapter.getAvailability()
          }));
          break;

        case 'availability.set':
          adapter.setAvailability(data.available, data.error);
          break;

        case 'state.get':
          ws.send(JSON.stringify({
            type: 'state.response',
            data: adapter.getState()
          }));
          break;

        case 'state.set':
          adapter.setState(data.state, data.description);
          break;

        case 'messaging.get':
          ws.send(JSON.stringify({
            type: 'messaging.response',
            data: adapter.getMessage()
          }));
          break;

        case 'messaging.set':
          adapter.setMessage(data.content);
          break;

        case 'messaging.addPart':
          adapter.addMessagePart(data.content);
          break;

        case 'messaging.clear':
          adapter.clearMessage();
          break;

        case 'user.message':
          adapter.handleUserMessage(data.message);
          break;

        default:
          console.log('Unknown message type:', data.type);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    adapter.ws = null;
  });
});

// Para Codex, não iniciamos CLI automaticamente - será iniciado por mensagem
if (CLI_TYPE !== 'codex') {
  adapter.startCLI();
}

// Inicia servidor
server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  Stagewise Adapter Server                 ║
║  Port: ${PORT}                            ║
║  CLI Type: ${CLI_TYPE}                    ║
║  Info: http://localhost:${PORT}/info      ║
║  WebSocket: ws://localhost:${PORT}/ws     ║
╚════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down adapter server...');
  if (adapter.cliProcess) {
    adapter.cliProcess.kill();
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default adapter;