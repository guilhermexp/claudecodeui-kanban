# Architecture Overview

## System Architecture

Claude Code UI follows a modern client-server architecture with two main components:

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                              │
│                     React + Vite + PWA                        │
│                        Port: 5892                             │
└─────────────┬───────────────────────────────────────────────┘
              │
              │ HTTP/WebSocket
              │
┌─────────────▼──────────────┐
│     Node.js Backend         │
│    Express + WebSocket      │
│       Port: 7347           │
└─────────────┬──────────────┘
              │
              │ Process
              │
┌─────────────▼──────────────┐
│      Claude Code CLI        │
│    External Process         │
└────────────────────────────┘
```

## Component Details

### Frontend (React Application)

**Technology Stack:**
- React 18 with Hooks
- Vite for bundling
- Tailwind CSS for styling
- XTerm.js for terminal
- CodeMirror for code editing

**Key Features:**
- Single Page Application (SPA)
- Progressive Web App (PWA)
- Responsive design
- Real-time updates via WebSocket

**Directory Structure:**
```
src/
├── components/       # React components
│   ├── Chat.jsx     # Chat interface
│   ├── Shell.jsx    # Terminal interface
│   ├── FileTree.jsx # File explorer
│   └── ...
├── hooks/           # Custom React hooks
├── contexts/        # React contexts
├── utils/           # Utility functions
└── App.jsx          # Main application
```

### Node.js Backend

**Technology Stack:**
- Express.js
- SQLite database
- JWT authentication
- WebSocket for real-time communication

**Responsibilities:**
- API gateway
- Authentication & authorization
- Session management
- Claude CLI process management
- File system operations
- WebSocket connections

**Directory Structure:**
```
server/
├── index.js         # Main server file
├── routes/          # API routes
│   ├── auth.js     # Authentication
│   ├── chat.js     # Chat operations
│   ├── git.js      # Git operations
│   └── ...
├── database/        # Database operations
├── lib/            # Utilities
└── claude-cli.js   # Claude CLI wrapper
```


## Data Flow

### 1. Chat Message Flow
```
User Input → Frontend → WebSocket → Node.js → Claude CLI → Response → Frontend
```

### 2. Terminal Session Flow
```
Terminal Input → XTerm.js → WebSocket → Node.js → PTY Process → Output → Terminal
```

### 3. File Operations Flow
```
File Request → Frontend → HTTP API → Node.js → File System → Response → Frontend
```


## Security Architecture

### Authentication Flow
```
Login → Node.js → Validate → Generate JWT → Store in LocalStorage → Include in Headers
```

### Tool Permissions
- All tools disabled by default
- Per-tool granular permissions
- Stored in user session
- Validated on each operation

### Security Measures
1. JWT for stateless authentication
2. CORS configuration
3. Input validation
4. SQL injection prevention
5. XSS protection
6. Rate limiting

## Database Schema

### SQLite Tables (Node.js)

**users**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMP
);
```

**sessions**
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  project_name TEXT,
  summary TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**messages**
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  session_id TEXT,
  role TEXT,
  content TEXT,
  created_at TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```


## State Management

### Frontend State

**React Context Providers:**
- `AuthContext` - User authentication state
- `ThemeContext` - Theme preferences
- `WebSocketContext` - WebSocket connections

**Local State:**
- Component-specific state using hooks
- Session storage for temporary data
- LocalStorage for persistence

### Backend State

**In-Memory:**
- Active Claude CLI processes
- WebSocket connections
- Terminal sessions

**Persistent:**
- SQLite databases
- File system
- User preferences

## Performance Optimizations

### Frontend
1. Code splitting with dynamic imports
2. Lazy loading of components
3. Memoization with React.memo
4. Virtual scrolling for large lists
5. Service Worker for caching

### Backend
1. Connection pooling
2. Query optimization
3. Response compression
4. Static file caching
5. Process pooling for Claude CLI

### Mobile Optimizations
1. Responsive design
2. Touch-optimized UI
3. Reduced network requests
4. Smaller bundle sizes
5. Offline capability

## Deployment Architecture

### Development
```
npm run dev → Concurrent processes:
  - Vite dev server (5892)
  - Node.js server (7347)
  - Port protection service
```

### Production
```
Build → Static files → Nginx → 
  - Node.js PM2 cluster
  - SQLite databases
  - Claude CLI processes
```

### Scaling Considerations
1. Horizontal scaling with load balancer
2. Redis for session storage
3. PostgreSQL for larger deployments
4. CDN for static assets
5. Container orchestration with K8s

## Error Handling

### Frontend
- Error boundaries for React
- Global error handler
- User-friendly error messages
- Automatic retry logic

### Backend
- Centralized error middleware
- Structured logging
- Graceful degradation
- Circuit breakers

## Monitoring & Observability

### Metrics
- Response times
- Error rates
- Active sessions
- Resource usage

### Logging
- Structured JSON logs
- Log aggregation
- Error tracking
- Performance monitoring

### Health Checks
- `/api/health` endpoint
- Database connectivity
- Claude CLI availability
- Disk space monitoring
