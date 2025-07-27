# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm install        # Install all dependencies (Node.js + Rust)
npm run dev        # Start all services (Frontend + Backend + Vibe Kanban)

# Individual services
npm run server     # Backend Node.js (port 8080)
npm run client     # Frontend Vite (port 9000) 
npm run vibe-backend # Vibe Kanban Rust (port 8081)
```

### Build & Production
```bash
npm run build      # Build frontend
npm run start      # Build & start production server
```

### Networking
```bash
npm run dev:network   # Development with network access
npm run tunnel        # Cloudflare tunnel
npm run ngrok         # Ngrok tunnel
```

### Rust/Vibe Kanban
```bash
cd vibe-kanban/backend
cargo build --release
cargo run --release
```

## Architecture

This is a web UI for Claude Code CLI with integrated Vibe Kanban task management.

### Three-Service Architecture
1. **Frontend (React/Vite)** - Port 9000
   - React 18 with hooks
   - Tailwind CSS + CSS Modules
   - CodeMirror 6 for code editing
   - XTerm.js for terminal
   
2. **Backend (Node.js/Express)** - Port 8080
   - WebSocket for real-time chat/terminal
   - SQLite database
   - JWT authentication
   - Claude Code CLI integration
   
3. **Vibe Kanban (Rust/Actix)** - Port 8081
   - Task management system
   - Git integration
   - Shared SQLite database

### Key Frontend Components
- `src/App.jsx` - Main routing and session management with protection system
- `src/components/MainContent.jsx` - Tab management (chat, terminal, files, git, vibe)
- `src/components/Sidebar.jsx` - Project/session navigation
- `src/components/Chat.jsx` - Claude chat interface with streaming
- `src/components/Terminal.jsx` - XTerm terminal integration
- `src/components/VibeKanbanApp.jsx` - Task management integration

### Backend API Routes
- `/api/chat/*` - Claude CLI communication
- `/api/auth/*` - Authentication endpoints
- `/api/git/*` - Git operations
- `/api/projects` - Project management
- `/api/vibe-kanban/*` - Proxied to Rust backend
- `/ws` - WebSocket for chat/terminal

### Session Protection System
The app tracks "active sessions" to prevent project updates from interrupting ongoing conversations. When a user sends a message, the session is marked as active and project updates are paused until the conversation completes.

### Mobile Support
Fully responsive with:
- Bottom navigation for mobile
- Touch-optimized UI
- PWA capabilities
- Adaptive layouts

### Security
All tools are disabled by default and must be explicitly enabled in Settings > Tools.