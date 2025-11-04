# Claude Code UI - Architecture Overview

## Project Status: ✅ STABLE & ACTIVELY MAINTAINED

**Last Updated**: 2025-01-10
**Version**: 1.5.0
**Stability**: Production Ready

---

## System Architecture

Claude Code UI is a modern web-based interface for Claude Code CLI with a clear separation between frontend and backend.

### Frontend Architecture (React + Vite)

**Port**: 5892 (development only)
**Technology Stack**:
- React 18 with hooks and context API
- Vite for fast development and optimized builds
- Tailwind CSS with semantic color system
- CodeMirror 6 for syntax highlighting
- XTerm.js for terminal emulation
- Responsive design with PWA support

**Key Components**:
- `MainContent.jsx` - Tab navigation (Shell, Files, Git)
- `Shell.jsx` - Terminal with WebSocket integration
- `FileManagerSimple.jsx` - File browser with editing
- `GitPanel.jsx` - Git operations interface
- `PreviewPanel.jsx` - Code preview and documentation
- `CodeEditor.jsx` - Full-featured code editor

**State Management**:
- React Context for authentication and theming
- Local component state with useState
- Session persistence with localStorage

### Backend Architecture (Node.js + Express)

**Port**: 7347 (development + production)
**Technology Stack**:
- Express.js for REST API and WebSocket server
- Node-pty for terminal emulation
- SQLite for data persistence
- JWT for secure authentication
- Better-sqlite3 for efficient database access

**Core Services**:
- WebSocket server for real-time communication
- JWT-based authentication system
- SQLite database (projects, sessions, auth)
- Claude Code CLI proxy and integration
- Port protection system (automatic conflict detection)

**API Routes**:
- `/api/auth/*` - Authentication and login
- `/api/projects/*` - Project management
- `/api/files/*` - File operations
- `/api/git/*` - Git commands
- `/api/system/*` - System information
- `/api/claude-hooks/*` - Sound notification configuration
- `/api/tts/*` - Text-to-speech and summarization

### Port Protection System

**Automatic Features**:
- Continuous port monitoring (5-second intervals)
- Process whitelisting for authorized Claude Code UI processes
- Automatic termination of unauthorized processes
- Intelligent mode switching between dev and production

**Safety Guarantees**:
- Prevents EADDRINUSE errors
- No manual port cleanup needed
- Safe concurrent operation handling

---

## Data Flow

```
User Browser
    ↓
Frontend (React)
    ↓ (HTTP/WebSocket)
Backend (Express)
    ↓
Services (PTY, Git, Files, Database)
    ↓
Claude Code CLI & System
```

### Real-time Communication
- WebSocket for terminal I/O
- Event-based message passing
- Automatic reconnection handling
- Session persistence

### Authentication Flow
1. User login via ModernLoginForm
2. Backend validates credentials and creates JWT
3. JWT stored in browser localStorage
4. All subsequent requests include token in Authorization header
5. Automatic token refresh on expiration

---

## File Structure

```
claude-code-ui/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   ├── contexts/                 # Context providers
│   ├── hooks/                    # Custom React hooks
│   ├── utils/                    # Utility functions
│   ├── lib/                      # Library helpers
│   └── App.jsx                   # Root component
├── server/                       # Backend code
│   ├── routes/                   # API endpoints
│   ├── database/                 # SQLite management
│   ├── middleware/               # Express middleware
│   └── index.js                  # Express server
├── scripts/                      # Development scripts
│   ├── dev.js                    # Development orchestrator
│   ├── port-protection.js        # Port monitoring
│   └── port-management.js        # Mode switching
├── ai_changelog/                 # Version history
├── ai_docs/                      # Technical documentation
├── ai_issues/                    # Known issues tracking
├── ai_research/                  # Research notes
├── ai_specs/                     # Technical specifications
├── CLAUDE.md                     # Development guidelines
├── README.md                     # Project overview
└── package.json                  # Dependencies
```

---

## Key Design Decisions

### 1. Semantic CSS Color System
- **Why**: Ensures consistency and simplifies theme switching
- **How**: CSS custom properties (`--primary`, `--success`, etc.)
- **Benefit**: Light/dark mode support without hardcoded colors

### 2. Port Protection System
- **Why**: Prevent conflicts between dev and production modes
- **How**: Continuous monitoring with process whitelisting
- **Benefit**: Users can switch modes without manual intervention

### 3. JWT Authentication
- **Why**: Stateless, scalable authentication
- **How**: Tokens issued on login, validated on each request
- **Benefit**: Works across multiple instances, no session storage needed

### 4. WebSocket for Terminal
- **Why**: Real-time bidirectional communication
- **How**: Dedicated WebSocket server alongside HTTP API
- **Benefit**: Low-latency terminal experience, automatic reconnection

### 5. SQLite for Persistence
- **Why**: Simple, no external dependencies, good performance
- **How**: Better-sqlite3 for synchronous, efficient access
- **Benefit**: Easy deployment, minimal infrastructure

---

## Security Considerations

### Implemented Safeguards
- ✅ JWT token validation on all protected routes
- ✅ Input validation on all API endpoints
- ✅ CORS protection with whitelist
- ✅ Rate limiting on authentication endpoints
- ✅ XSS prevention through content sanitization
- ✅ Process whitelisting in port protection

### Best Practices
- Use HTTPS in production (via Ngrok)
- Store JWT_SECRET in environment variables
- Rotate JWT tokens periodically
- Monitor for unauthorized port access
- Keep dependencies updated

---

## Performance Optimizations

### Frontend
- Route-based code splitting with React.lazy
- API response caching
- Debounced input handlers
- Virtual scrolling for large lists
- Optimized bundle size (41.13 kB gzipped)

### Backend
- Connection pooling with SQLite
- Efficient terminal message handling
- Graceful WebSocket error handling
- Port protection runs in background

### Build Process
- Vite for fast HMR during development
- Production builds optimized and minified
- CSS inlining for critical paths

---

## Deployment Modes

### Development
```bash
npm run dev
# Frontend: http://localhost:5892
# Backend: http://localhost:7347
# Features: Hot reload, port protection, file watching
```

### Production (Background with Tunnel)
```bash
./start-background-prod.sh
# Public: https://claudecode.ngrok.app
# Features: Public tunnel, persistent background service
```

### Production (Local Only)
```bash
npm run build && npm start
# Backend: http://localhost:7347
# Features: Optimized build, no frontend hot reload
```

---

## Dependencies Summary

### Frontend Key Packages
- react@18.3.x - UI framework
- react-dom@18.3.x - DOM rendering
- tailwindcss@3.x - CSS framework
- @uiw/react-codemirror@4.x - Code editor
- xterm@4.x - Terminal emulation
- framer-motion@10.x - Animations
- react-router-dom@6.x - Routing

### Backend Key Packages
- express@4.x - Web framework
- ws@8.x - WebSocket server
- better-sqlite3@12.x - Database
- jsonwebtoken@9.x - JWT handling
- bcrypt@6.x - Password hashing
- node-pty@0.10.x - Terminal emulation

**Total Dependencies**: ~40 packages (carefully curated)

---

## Maintenance & Support

### How to Report Issues
1. Check `ai_issues/` directory for existing reports
2. If new, create issue in `ai_issues/` with template
3. Include reproduction steps and environment info
4. Reference related code files

### How to Contribute
1. Review CLAUDE.md for development guidelines
2. Check open issues in `ai_issues/`
3. Follow semantic CSS color conventions
4. Test on mobile devices before submitting
5. Update documentation accordingly

### Version Management
- Semantic versioning (MAJOR.MINOR.PATCH)
- Changelog in `ai_changelog/CHANGELOG_FORK.md`
- Git tags for releases
- Backup tags before major changes

---

## Next Steps & Roadmap

### Immediate Priorities
- Monitor application stability in production
- Collect user feedback on UI/UX
- Performance optimization if needed

### Future Enhancements
- Consider removing unused dependencies (@anthropic-ai/sdk, react-syntax-highlighter)
- Additional AI features integration
- Enhanced monitoring and metrics
- Mobile app version (native)

---

**Architecture Reviewed**: 2025-01-10
**Status**: Stable and Production Ready ✅
**Last Modified**: Comprehensive cleanup (3e1b7d3)
