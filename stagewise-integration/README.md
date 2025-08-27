# Stagewise Integration for Codeui

## Overview

This integration brings the Stagewise AI toolbar into Codeui, allowing you to use local CLI tools (Claude Code, Codex, etc.) with the beautiful Stagewise UI.

## Architecture

```
Codeui PreviewPanel
    ↓
Stagewise Toolbar (Open Source Frontend)
    ↓ WebSocket
Adapter Server (Port 3456)
    ↓ Subprocess
Local CLIs (Claude Code, Codex, etc.)
```

## Features

- ✅ Full Stagewise toolbar UI in Codeui preview
- ✅ Connect to local CLI tools instead of paid backend
- ✅ Real-time communication via WebSocket
- ✅ Support for multiple CLI types
- ✅ Toggle between normal preview and Stagewise mode

## Installation

### 1. Install Dependencies

```bash
# Install adapter dependencies
cd stagewise-integration
npm install

# The Stagewise toolbar is already built
# If you need to rebuild:
cd stagewise/toolbar/core
pnpm build
```

### 2. Start the Adapter Server

```bash
cd stagewise-integration
./start-stagewise.sh
# Or manually:
CLI_TYPE=claude node adapter-server.js
```

### 3. Start Codeui

```bash
cd ..
npm run dev
```

## Usage

1. Open Codeui in your browser
2. Navigate to a project with a local development server
3. Open the Preview Panel
4. Click the "🤖 Stagewise OFF" button to enable Stagewise
5. The Stagewise toolbar will appear over your preview
6. Start chatting with your local CLI!

## Configuration

### Adapter Server

Edit environment variables in `adapter-server.js`:

```javascript
const PORT = process.env.ADAPTER_PORT || 3456;
const CLI_TYPE = process.env.CLI_TYPE || 'claude'; // 'claude', 'codex', etc
```

### Supported CLIs

- `claude` - Claude Code CLI (default)
- `codex` - OpenAI Codex CLI
- Add more by extending the `startCLI()` method

## File Structure

```
stagewise-integration/
├── adapter-server.js       # Bridge between Stagewise and CLIs
├── toolbar-wrapper.html    # HTML wrapper for Stagewise toolbar
├── package.json            # Adapter dependencies
├── start-stagewise.sh      # Startup script
├── README.md              # This file
└── stagewise/             # Complete Stagewise source
    └── toolbar/
        └── core/
            └── dist/      # Built toolbar files
```

## How It Works

1. **PreviewPanel**: Modified to include a toggle for Stagewise mode
2. **toolbar-wrapper.html**: Loads the Stagewise toolbar and user app in iframe
3. **adapter-server.js**: Translates between Stagewise protocol and CLI commands
4. **Local CLI**: Processes commands and returns responses

## API Endpoints

### Adapter Server

- `GET /info` - Agent discovery endpoint
- `WS /ws` - WebSocket for real-time communication

### Message Types

```javascript
// User message
{ type: 'user.message', message: { content: [...] } }

// Agent state
{ type: 'state.set', state: 'processing', description: '...' }

// Message updates
{ type: 'messaging.update', data: { parts: [...] } }
```

## Troubleshooting

### Stagewise toolbar not appearing?

1. Check adapter server is running: `http://localhost:3456/info`
2. Check browser console for errors
3. Ensure the symbolic link exists: `ls -la public/stagewise-integration`

### CLI not responding?

1. Verify CLI is installed: `which claude` or `which codex`
2. Check adapter server logs for errors
3. Try running CLI manually to ensure it works

### WebSocket connection failed?

1. Check CORS settings in adapter server
2. Ensure ports 3456 is not blocked
3. Check firewall settings

## Development

### Modifying the Adapter

Edit `adapter-server.js` to:
- Add new CLI types
- Customize message translation
- Add authentication

### Rebuilding Stagewise Toolbar

```bash
cd stagewise/toolbar/core
pnpm install
pnpm build
```

### Testing

1. Start adapter: `./start-stagewise.sh`
2. Test endpoint: `curl http://localhost:3456/info`
3. Test WebSocket: Use a WebSocket client to connect to `ws://localhost:3456/ws`

## Future Improvements

- [ ] Support for more CLI tools
- [ ] Better error handling
- [ ] Configuration UI for selecting CLIs
- [ ] Persistent chat history
- [ ] Multi-agent support

## Credits

- Stagewise UI by [stagewise.io](https://stagewise.io) (Open Source)
- Integration developed for Codeui