# Architecture Diagram - Claude Code UI

## System Overview

This application consists of a three-tier architecture with React frontend, Node.js backend, and Rust-based Vibe Kanban service.

## Architecture Components

### Frontend (Port 9000)
- **React 18** with Vite bundler
- **Tailwind CSS** for styling
- **XTerm.js** for terminal emulation
- **CodeMirror 6** for code editing

### Backend Services

| Service | Port | Technology | Purpose |
|---------|------|------------|---------|
| Node.js API | 8080 | Express.js | Main API, WebSocket, Auth |
| Vibe Kanban | 8081 | Rust/Actix | Task management |
| SQLite DB | - | SQLite3 | Data persistence |

## Data Flow

```
User → Frontend (9000) → Node.js API (8080) → Claude CLI
                      ↘                    ↗
                        Vibe Kanban (8081)
                              ↓
                          SQLite DB
```

## Key Features

1. **Real-time Communication**
   - WebSocket for chat streaming
   - Terminal session management
   - Live file updates

2. **Task Management**
   - Kanban board visualization
   - Git integration
   - Task templates

3. **Security**
   - JWT authentication
   - Session protection
   - Tool permission management

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/verify` - Token verification

### Projects
- `GET /api/projects` - List all projects
- `GET /api/projects/:id/diagram` - Get project diagram
- `PUT /api/projects/:id` - Update project

### Chat & Terminal
- `WS /ws` - WebSocket connection
- `POST /api/chat/send` - Send message
- `GET /api/chat/history` - Get chat history

---

> **Note**: This diagram is automatically displayed at the bottom of the Vibe Kanban page when viewing project tasks.