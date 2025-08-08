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

This is a web UI for Claude Code CLI with integrated Vibe Kanban task management and usage analytics dashboard.

### Three-Service Architecture
1. **Frontend (React/Vite)** - Port 9000
   - React 18 with hooks
   - Tailwind CSS + CSS Modules
   - CodeMirror 6 for code editing
   - XTerm.js for terminal
   - Integrated navigation tabs
   
2. **Backend (Node.js/Express)** - Port 8080
   - WebSocket for real-time chat/terminal
   - SQLite database
   - JWT authentication
   - Claude Code CLI integration
   - Usage analytics API
   
3. **Vibe Kanban (Rust/Actix)** - Port 8081
   - Task management system
   - Git integration
   - Shared SQLite database
   - Quick access panel

### Main Navigation Tabs
- **Shell** - Terminal emulation with Claude integration
- **Files** - File browser with split-view editing
- **Source Control** - Git operations and management
- **Tasks** - Quick access Vibe Kanban panel
- **Dashboard** - Usage analytics and cost tracking

### Key Frontend Components
- `src/App.jsx` - Main routing and session management with protection system
- `src/components/MainContent.jsx` - Tab management with integrated panels
- `src/components/Sidebar.jsx` - Project/session navigation
- `src/components/Chat.jsx` - Claude chat interface with streaming
- `src/components/Shell.jsx` - XTerm terminal integration with responsive resizing
- `src/components/Dashboard.jsx` - Usage analytics dashboard
- `src/components/VibeTaskPanel.jsx` - Quick task management panel
- `src/components/FileTree.jsx` - File browser with inline editing
- `src/components/CodeEditor.jsx` - Code editor with syntax highlighting

### Backend API Routes
- `/api/chat/*` - Claude CLI communication
- `/api/auth/*` - Authentication endpoints
- `/api/git/*` - Git operations
- `/api/projects` - Project management
- `/api/usage/*` - Usage analytics and statistics
- `/api/vibe-kanban/*` - Proxied to Rust backend
- `/ws` - WebSocket for chat/terminal

### Recent Improvements
- **Dashboard Integration** - Dashboard available as main navigation tab
- **Vibe Kanban Panel** - Sliding panel with responsive design
- **File Browser Split View** - Browse and edit files side-by-side
- **Session Protection** - Prevents interruption during active conversations
- **Improved Responsiveness** - Better adaptation to panel state changes
- **UI Polish** - Cleaner transitions and animations
- **Code Cleanup** - Removed dead code and consolidated utilities

### Session Protection System
The app tracks "active sessions" to prevent project updates from interrupting ongoing conversations. When a user sends a message, the session is marked as active and project updates are paused until the conversation completes.

### Mobile Support
Fully responsive with:
- Bottom navigation for mobile
- Touch-optimized UI
- PWA capabilities
- Adaptive layouts
- Responsive panels

### Security
All tools are disabled by default and must be explicitly enabled in Settings > Tools.

## Important Notes for Development

### State Management
- Session state is carefully managed to prevent disruption
- Panel states trigger content area resizing
- Tab navigation preserves component state

### Performance Considerations
- Dashboard data is cached for 1 hour
- Tab content lazy loads on demand
- Shell resizes are debounced

### UI/UX Guidelines
- Panels should not overlap navigation tabs
- Transitions should be smooth (300-350ms)
- Loading states must be clear and informative
- Error messages should offer recovery options

### Testing Checklist
- [ ] Test all tabs navigation
- [ ] Verify panel responsiveness
- [ ] Check shell resizing with panels
- [ ] Confirm Dashboard data loading
- [ ] Test Task panel CRUD operations
- [ ] Verify file editing in split view
- [ ] Check mobile layout adaptations