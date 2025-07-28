# Claude Code UI - Project Documentation Index

## 📚 Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Directory Structure](#directory-structure)
4. [API Documentation](#api-documentation)
5. [Component Documentation](#component-documentation)
6. [Configuration Guide](#configuration-guide)
7. [Development Guide](#development-guide)
8. [Deployment Guide](#deployment-guide)

## 🎯 Project Overview

Claude Code UI is a comprehensive web interface for the Claude Code CLI, providing a modern, responsive UI with integrated task management through Vibe Kanban.

### Key Features
- **Responsive Web Interface** - Works seamlessly on desktop, tablet, and mobile devices
- **Real-time Chat Integration** - Stream responses from Claude with WebSocket support
- **Integrated Terminal** - Direct shell access through the web interface
- **File Management** - Browse, edit, and manage project files with syntax highlighting
- **Git Integration** - Visual git operations including staging, committing, and branch management
- **Vibe Kanban** - Full-featured task management system built with Rust
- **Session Management** - Persist and resume conversations across sessions

### Technology Stack

#### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS + CSS Modules
- **Code Editor**: CodeMirror 6
- **Terminal**: XTerm.js
- **Icons**: Lucide React
- **Routing**: React Router v6

#### Backend
- **Node.js Server**: Express.js with WebSocket support
- **Rust Server**: Vibe Kanban (Actix-web)
- **Database**: SQLite (shared between services)
- **Authentication**: JWT tokens
- **Process Management**: node-pty for terminal sessions

## 🏗️ Architecture

### System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │  Claude CLI     │
│   React/Vite    │◄──►│ Express/Node.js │◄──►│  Integration    │
│   Port: 9000    │    │   Port: 8080    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                      │
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌─────────────────┐
│  Vibe Kanban    │    │   Shared        │
│  Rust Backend   │◄──►│   Database      │
│   Port: 8081    │    │   SQLite        │
└─────────────────┘    └─────────────────┘
```

### Data Flow

1. **Client → Server Communication**
   - REST API for CRUD operations
   - WebSocket for real-time updates
   - Server-Sent Events for streaming responses

2. **Server → Claude CLI**
   - Process spawning with node-pty
   - JSONL parsing for conversation history
   - Stream processing for real-time responses

3. **Server → Vibe Kanban**
   - HTTP proxy with retry logic
   - Circuit breaker pattern for resilience
   - Health checks for availability monitoring

## 📁 Directory Structure

```
claude-code-ui/
├── public/                 # Static assets
│   ├── icons/             # Application icons
│   └── screenshots/       # Documentation screenshots
├── scripts/               # Build and utility scripts
├── server/                # Node.js backend
│   ├── database/          # Database initialization
│   ├── lib/              # Shared libraries
│   │   ├── cache.js      # Caching system
│   │   ├── config.js     # Configuration management
│   │   ├── errors.js     # Custom error classes
│   │   ├── logger.js     # Logging system
│   │   └── vibe-proxy.js # Vibe Kanban proxy
│   ├── middleware/        # Express middleware
│   │   ├── auth.js       # Authentication
│   │   └── validation.js # Request validation
│   ├── routes/           # API routes
│   │   ├── auth.js       # Authentication endpoints
│   │   ├── git.js        # Git operations
│   │   └── mcp.js        # MCP server management
│   ├── claude-cli.js     # Claude CLI integration
│   ├── index.js          # Main server file
│   ├── projects.js       # Project management
│   └── shellSessions.js  # Terminal session management
├── src/                  # React frontend
│   ├── components/       # React components
│   │   ├── ui/          # Reusable UI components
│   │   └── vibe-kanban/ # Vibe Kanban components
│   ├── contexts/        # React contexts
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Frontend libraries
│   ├── pages/           # Page components
│   ├── utils/           # Utility functions
│   └── App.jsx          # Main app component
└── vibe-kanban/         # Rust backend
    └── backend/         # Actix-web server

```

## 🔌 API Documentation

### Authentication Endpoints

#### POST /api/auth/login
Login with username and password.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "token": "jwt-token",
  "user": {
    "id": "number",
    "username": "string"
  }
}
```

#### POST /api/auth/register
Register a new user account.

**Request:**
```json
{
  "username": "string",
  "password": "string"
}
```

### Project Management

#### GET /api/projects
Get all available projects.

**Response:**
```json
[
  {
    "name": "project-name",
    "displayName": "Project Name",
    "fullPath": "/path/to/project",
    "sessions": [],
    "sessionMeta": {
      "total": 0
    }
  }
]
```

#### POST /api/projects
Create a new project.

**Request:**
```json
{
  "path": "/path/to/project"
}
```

### File Operations

#### GET /api/projects/:projectName/files
Get file tree for a project.

#### GET /api/projects/:projectName/file
Read file contents.

**Query Parameters:**
- `path`: File path relative to project root

#### POST /api/projects/:projectName/file
Save file contents.

**Request:**
```json
{
  "path": "relative/file/path",
  "content": "file contents"
}
```

### Git Operations

#### GET /api/git/:projectName/status
Get git status for project.

#### POST /api/git/:projectName/commit
Create a git commit.

**Request:**
```json
{
  "message": "commit message",
  "files": ["file1.js", "file2.js"]
}
```

### Chat Interface

#### WebSocket /ws
Real-time chat communication.

**Message Types:**
- `chat`: Send/receive chat messages
- `abort`: Cancel ongoing operations
- `projects_updated`: Project list updates

### Terminal Sessions

#### WebSocket /shell
Terminal session management.

**Commands:**
- `create`: Create new terminal session
- `resize`: Resize terminal
- `data`: Send terminal input

## 🧩 Component Documentation

### Core Components

#### App.jsx
Main application component with routing and state management.

**Key Features:**
- Session protection system
- WebSocket connection management
- Responsive layout handling

#### MainContent.jsx
Central content area with tab navigation.

**Tabs:**
- Chat: Claude conversation interface
- Terminal: Integrated shell
- Files: File explorer and editor
- Git: Version control interface
- Vibe: Task management

#### Sidebar.jsx
Project and session navigation.

**Features:**
- Project switching
- Session history
- Quick actions

### Vibe Kanban Components

#### TaskCard.tsx
Individual task representation.

**Props:**
- `task`: Task object
- `onUpdate`: Update callback
- `onDelete`: Delete callback

#### TaskDetailsDialog.tsx
Detailed task view and editing.

**Features:**
- Rich text description
- File attachments
- Git integration
- Process monitoring

## ⚙️ Configuration Guide

### Environment Variables

Create a `.env` file in the root directory:

```bash
# Server Configuration
PORT=8080                    # Node.js server port
VITE_PORT=9000              # Frontend dev server port
VIBE_PORT=8081              # Vibe Kanban port

# URLs
VITE_SERVER_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080
VITE_VIBE_URL=http://localhost:8081

# Security
SESSION_SECRET=your-secret-key
JWT_SECRET=your-jwt-secret

# Features
ENABLE_AUTH=true
ENABLE_MCP=true
ENABLE_VOICE=true

# Logging
LOG_LEVEL=INFO              # DEBUG, INFO, WARN, ERROR
```

### Tool Permissions

Tools are disabled by default for security. Enable through Settings:

1. Open Settings (gear icon)
2. Navigate to Tools tab
3. Enable required tools:
   - File Operations
   - Terminal Access
   - Git Operations
   - MCP Servers

## 🚀 Development Guide

### Prerequisites

- Node.js v20+
- Rust and Cargo (for Vibe Kanban)
- Claude Code CLI installed

### Setup

1. **Clone Repository**
   ```bash
   git clone https://github.com/siteboon/claudecodeui.git
   cd claudecodeui
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd vibe-kanban/backend && cargo build --release
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start Development**
   ```bash
   npm run dev
   ```

### Development Scripts

- `npm run dev` - Start all services in development mode
- `npm run server` - Start backend only
- `npm run client` - Start frontend only
- `npm run vibe-backend` - Start Vibe Kanban only
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Fix linting issues

### Code Style

The project uses ESLint for code quality:
- React 18 best practices
- Consistent formatting
- No console.log in production code
- Proper error handling

## 📦 Deployment Guide

### Production Build

1. **Build Frontend**
   ```bash
   npm run build
   ```

2. **Build Vibe Kanban**
   ```bash
   cd vibe-kanban/backend
   cargo build --release
   ```

3. **Start Production**
   ```bash
   NODE_ENV=production npm start
   ```

### Docker Deployment

```dockerfile
# Dockerfile example
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 8080
CMD ["npm", "start"]
```

### Security Considerations

1. **Environment Variables**
   - Use strong secrets for JWT and sessions
   - Never commit `.env` files
   - Rotate secrets regularly

2. **Tool Permissions**
   - Keep tools disabled by default
   - Audit tool usage regularly
   - Implement rate limiting

3. **Network Security**
   - Use HTTPS in production
   - Implement CORS properly
   - Validate all inputs

## 🔧 Troubleshooting

### Common Issues

#### "No Claude projects found"
- Ensure Claude CLI is installed
- Run `claude` in a project directory first
- Check `~/.claude/projects/` permissions

#### WebSocket Connection Failed
- Check if all services are running
- Verify port availability
- Check firewall settings

#### Vibe Kanban Not Responding
- Ensure Rust backend is running
- Check port 8081 availability
- Review health check endpoint

### Logging

Enable debug logging:
```bash
LOG_LEVEL=DEBUG npm run dev
```

Check logs in:
- Browser console (frontend)
- Terminal output (backend)
- `vibe-kanban/backend/logs/` (Rust)

## 📚 Additional Resources

- [Claude Code Documentation](https://docs.anthropic.com/en/docs/claude-code)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Actix Web Documentation](https://actix.rs/)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.