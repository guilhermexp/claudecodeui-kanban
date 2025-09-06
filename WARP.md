# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Claude Code UI is a modern web-based interface for the Claude Code CLI from Anthropic. It transforms the command-line Claude Code experience into a rich visual interface with three main sections:

- **Shell**: Terminal emulation with integrated Claude chat and command execution
- **Files**: File browser with syntax-highlighted code editor (CodeMirror 6)
- **Git**: Visual git operations and branch management interface

The application uses a dual-architecture approach:
- **Frontend**: React 18 + Vite + Tailwind CSS (Port 5892 in development)
- **Backend**: Node.js + Express + WebSocket (Port 7347 for both dev and prod)

## Development Commands

### Quick Start
```bash
npm install          # Install all dependencies
npm run dev         # Start full development environment (recommended)
```

### Development Environment
```bash
npm run dev           # Full stack with port protection (Frontend + Backend)
npm run server        # Backend only (port 7347)
npm run client        # Frontend only (port 5892)
npm run dev:network   # Development with network access (0.0.0.0)
npm run dev:https     # HTTPS development with SSL certificates
```

### Production Builds
```bash
npm run build         # Build frontend for production
npm start            # Build + start production server
./start-background-prod.sh  # Production with public ngrok tunnel
./check-tunnel.sh     # Verify tunnel connectivity
```

### Port Management (Critical System)
The application includes intelligent port protection to prevent dev/prod conflicts:
```bash
npm run port-status      # Check current mode (DEVELOPMENT/PRODUCTION/MIXED)
npm run switch-to-dev    # Safely switch from production to development
npm run switch-to-prod   # Safely switch from development to production
npm run stop-all         # Emergency stop all processes
npm run protect-ports    # Run port protection service standalone
```

### Claude Code Integration
```bash
npm run hooks:enable     # Enable sound notifications when Claude completes
npm run hooks:disable    # Disable sound notifications
npm run hooks:status     # Show current hook configuration
npm run hooks:list       # List available system sounds
npm run hooks:test <sound>  # Test specific sound notification
```

### Service Management (macOS)
```bash
./claudecode-service.sh install    # Install as system service
./claudecode-service.sh status     # Check service status
./claudecode-service.sh uninstall  # Remove system service
```

## Architecture Deep Dive

### Frontend Architecture (React + Vite)
- **Entry Point**: `src/App.jsx` - Main application component
- **State Management**: React Context for auth/theme + local component state
- **Routing**: React Router DOM with protected routes
- **Real-time**: WebSocket connections for terminal and chat
- **Styling**: Tailwind CSS with custom CSS properties for theming

Key frontend components:
- `MainContent.jsx` - Tab navigation and content routing
- `Shell.jsx` - Terminal component with XTerm.js integration
- `FileManagerSimple.jsx` - File browser with CodeMirror editor
- `GitPanel.jsx` - Git operations interface
- `OverlayChatClaude.jsx` - Claude chat overlay

### Backend Architecture (Node.js + Express)
- **Entry Point**: `server/index.js` - Express server with WebSocket support
- **Database**: SQLite with tables for users, sessions, messages
- **Authentication**: JWT tokens with middleware protection
- **Claude Integration**: `server/claude-cli.js` - Proxy to Claude Code CLI

Key backend modules:
- `server/routes/` - API endpoints (auth, files, git, claude-stream, etc.)
- `server/database/db.js` - SQLite database management
- `server/middleware/` - Auth, rate limiting, WebSocket security
- `server/lib/ProcessManager.js` - Process lifecycle management

### Critical Port Protection System
The application includes a sophisticated port protection system that:
- Monitors ports every 5 seconds for conflicts
- Automatically whitelists legitimate Claude Code UI processes
- Terminates unauthorized processes on protected ports
- Enables safe switching between development and production modes

This prevents the common `EADDRINUSE` errors when switching between modes.

## Environment Configuration

### Required Environment Variables (.env)
```bash
# JWT Authentication
JWT_SECRET=your_jwt_secret_here_change_this

# Ports (auto-configured)
BACKEND_PORT=7347
FRONTEND_PORT=5892

# Optional: OpenAI for voice transcription
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional: AI Providers
GROQ_API_KEY=              # For prompt enhancement
GEMINI_API_KEY=            # For text analysis/summarization
```

### Development Environment Setup
1. Copy `.env.example` to `.env`
2. Generate a secure JWT_SECRET
3. Add API keys for optional features
4. Ensure Claude Code CLI is installed: `npm install -g @anthropic-ai/claude-code`

## Project Structure

### Frontend (`src/`)
```
src/
├── components/           # React components
│   ├── MainContent.jsx   # Main tab navigation
│   ├── Shell.jsx         # Terminal emulation
│   ├── FileManagerSimple.jsx  # File browser
│   ├── GitPanel.jsx      # Git interface
│   ├── OverlayChatClaude.jsx  # Chat overlay
│   └── ...              # Other UI components
├── contexts/             # React contexts (Auth, Theme)
├── hooks/               # Custom React hooks
├── utils/               # Utility functions
└── App.jsx              # Application root
```

### Backend (`server/`)
```
server/
├── index.js             # Express server + WebSocket
├── claude-cli.js        # Claude Code CLI integration
├── routes/              # API endpoints
│   ├── auth.js         # Authentication
│   ├── files.js        # File operations
│   ├── git.js          # Git operations
│   └── claude-stream.js # Claude chat streaming
├── database/            # SQLite management
├── middleware/          # Auth, security, rate limiting
└── lib/                # Utilities and managers
```

### Scripts (`scripts/`)
```
scripts/
├── dev.js              # Development orchestrator
├── port-management.js   # Port conflict resolution
├── port-protection.js   # Port monitoring service
├── claude-hooks-cli.js  # Sound notification management
└── setup-*.sh          # Setup scripts
```

## Development Workflow

### Starting Development
1. **Always use `npm run dev`** - This starts both frontend and backend with port protection
2. Access the application at `http://localhost:5892`
3. Backend API available at `http://localhost:7347`

### Port Conflict Resolution
If you encounter port conflicts:
1. Check current status: `npm run port-status`
2. Stop all processes: `npm run stop-all`
3. Start desired mode: `npm run dev` or `./start-background-prod.sh`

### Production Deployment
1. **Local Production**: `npm run build && npm run server`
2. **Public Access**: `./start-background-prod.sh` (creates ngrok tunnel)
3. **System Service**: `./claudecode-service.sh install` (auto-start on boot)

### Mobile Development
The application is fully responsive with mobile-first design:
- Use semantic color classes (`text-primary`, `bg-success`) instead of hardcoded colors
- Mobile modals use `.mobile-modal` and `.mobile-content` classes
- Touch targets minimum 44px with appropriate Tailwind classes
- iOS safe areas handled with `.ios-sides-safe` and `.ios-bottom-safe`

## Testing and Debugging

### Port Protection Testing
```bash
node scripts/test-port-attack.js  # Simulate port conflicts
npm run port-status               # Verify protection system
```

### Manual Testing Checklist
- [ ] All navigation tabs function correctly
- [ ] Terminal accepts input and displays output
- [ ] File browser allows editing and saving
- [ ] Git operations complete successfully
- [ ] Mobile layout adapts properly
- [ ] Dark/light mode switching works
- [ ] Claude chat integration responds

### Common Issues
1. **Port conflicts**: Use port management commands
2. **Terminal not accepting input**: Check WebSocket connections, refresh page
3. **File browser not loading**: Verify backend API, check file permissions
4. **Git operations failing**: Ensure git repository and credentials

## API Architecture

### REST Endpoints
- `POST /api/auth/login` - User authentication
- `GET /api/projects` - List projects
- `GET /api/files/*` - File system operations
- `POST /api/git/commit` - Git operations
- `POST /api/tts/gemini-summarize` - AI-powered audio generation

### WebSocket Events
- `connect` - Establish connection
- `init` - Initialize terminal session
- `input` - Terminal input
- `resize` - Terminal resize
- `ping/pong` - Connection keepalive

## Security Features

### Authentication
- JWT tokens for stateless authentication
- Automatic token refresh
- Protected routes with middleware validation

### Tool Security
- All Claude tools disabled by default
- Granular permission control via settings
- Input validation and sanitization

### Port Security
- Process whitelisting for authorized applications
- Continuous monitoring for unauthorized access
- Graceful shutdown with fallback termination

## Key Dependencies

### Frontend
- **React 18**: Modern hooks and context
- **Vite**: Fast build tool and dev server
- **Tailwind CSS**: Utility-first styling
- **XTerm.js**: Terminal emulation
- **CodeMirror 6**: Code editing with syntax highlighting
- **Framer Motion**: Smooth animations

### Backend
- **Express**: Web framework
- **better-sqlite3**: SQLite database
- **ws**: WebSocket server
- **jsonwebtoken**: JWT authentication
- **node-pty**: Terminal process management
- **chokidar**: File system watching

## Performance Considerations

- **Code Splitting**: Route-based lazy loading
- **WebSocket Optimization**: Connection pooling and keepalive
- **Database**: Indexed queries and connection management
- **Caching**: API response caching with time-based invalidation
- **Bundle Size**: Optimized Vite build with tree shaking

## Development Best Practices

1. **Always use `npm run dev`** for development (includes port protection)
2. **Never run dev and production simultaneously** - use switching commands
3. **Check port status before starting** - `npm run port-status`
4. **Use semantic CSS classes** - `text-primary` instead of `text-blue-500`
5. **Test mobile layout** - Responsive design is critical
6. **Monitor WebSocket connections** - Critical for terminal functionality
7. **Focus on core functionality** - Terminal, files, and git operations

This application is actively used for development work, so **stability and reliability are paramount**.
