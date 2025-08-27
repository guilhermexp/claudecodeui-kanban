# Stagewise Reference

This folder contains minimal reference files from Stagewise integration for:

1. **Codex Adapter Pattern** - How to connect to Codex CLI
2. **Chat UI Pattern** - How they format messages with ReactMarkdown

## Key Learnings:

### Codex CLI Connection
- Uses `codex exec --json` command
- Spawns process with project directory
- Parses JSON responses line by line
- Handles error messages in format: `{"msg":{"type":"error","message":"..."}}`

### Chat Formatting
- Uses `react-markdown` library for message rendering
- Simple CSS classes for styling
- Automatic code block formatting

## Our Implementation
We've implemented a similar chat in `src/components/OverlayChat.jsx` that:
- Uses our internal backend (port 7347)
- Connects via existing WebSocket infrastructure
- Sends commands to Codex CLI through our server
- No external dependencies on Stagewise servers