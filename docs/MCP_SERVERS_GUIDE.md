# MCP Servers Guide for Claude Code UI

## Overview
MCP (Model Context Protocol) servers extend Claude's capabilities by providing access to external tools and services. This guide shows how to manage MCP servers in your Claude Code UI.

## Accessing MCP Server Management

### 1. Via Settings Panel
- Click the Settings icon (gear) in the sidebar
- Navigate to the "MCP Servers" tab
- You'll see options to view, add, and manage MCP servers

### 2. Via API Endpoints
The UI exposes several endpoints for MCP server management:

#### List MCP Servers
```
GET /api/mcp/servers
```

#### Add MCP Server
```
POST /api/mcp/servers
Body: {
  "name": "server-name",
  "type": "stdio|http|sse",
  "command": "command-to-run",
  "args": ["arg1", "arg2"],
  "env": { "KEY": "value" }
}
```

#### Remove MCP Server
```
DELETE /api/mcp/servers/:id
```

#### Test MCP Server
```
POST /api/mcp/servers/:id/test
```

## Available MCP Server Types

### 1. STDIO Servers
- Run as local processes
- Communicate via standard input/output
- Example: `@modelcontextprotocol/server-filesystem`

### 2. HTTP Servers
- Connect to remote HTTP endpoints
- Support custom headers for authentication
- Example: Custom REST API servers

### 3. SSE (Server-Sent Events) Servers
- Real-time streaming connections
- Useful for live data feeds
- Example: Streaming data servers

## Adding MCP Servers

### Example 1: Filesystem Server
```json
{
  "name": "filesystem",
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-filesystem"],
  "env": {
    "FILESYSTEM_ROOT": "/Users/username/projects"
  }
}
```

### Example 2: GitHub Server
```json
{
  "name": "github",
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-github"],
  "env": {
    "GITHUB_TOKEN": "your-github-token"
  }
}
```

### Example 3: Memory Server
```json
{
  "name": "memory",
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-memory"]
}
```

## UI Features

### Server List View
- Shows all configured MCP servers
- Displays server status (active/inactive)
- Quick actions: Test, Edit, Delete

### Add Server Dialog
- Select server type (stdio/http/sse)
- Configure command and arguments
- Set environment variables
- Test connection before saving

### Server Testing
- Click "Test" button next to any server
- Shows connection status
- Displays available tools from the server

## Common MCP Servers

1. **Filesystem** - File system access and manipulation
2. **GitHub** - GitHub repository interaction
3. **Memory** - Persistent memory storage
4. **Slack** - Slack workspace integration
5. **Google Drive** - Google Drive file access
6. **Postgres** - PostgreSQL database access

## Troubleshooting

### Server Not Connecting
- Check command path is correct
- Verify environment variables
- Ensure required dependencies are installed
- Check server logs in the console

### Tools Not Available
- Confirm server is running (green status)
- Test the server connection
- Check if tools are enabled in Settings > Tools

### Permission Issues
- Verify file system permissions
- Check API tokens are valid
- Ensure network access for HTTP/SSE servers

## Security Considerations

1. **Environment Variables**: Store sensitive tokens securely
2. **File System Access**: Limit filesystem server root paths
3. **Network Security**: Use HTTPS for remote servers
4. **Tool Permissions**: Enable only trusted tools

## Next Steps

1. Open the UI at http://localhost:9000
2. Navigate to Settings > MCP Servers
3. Add your first MCP server
4. Test the connection
5. Enable tools in Settings > Tools
6. Start using the enhanced capabilities!

For more information about MCP, visit: https://github.com/modelcontextprotocol