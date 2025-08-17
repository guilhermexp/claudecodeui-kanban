# CLAUDE.md

This file provides complete guidance to Claude Code (claude.ai/code) when working with code in this repository. **IMPORTANT: Read this entire file to understand the project context and avoid common issues.**

## 🚀 **Quick Start Guide**

### For Development (Local Testing)
```bash
npm install          # Install all dependencies (Node.js + Rust)
npm run dev         # Start development mode with port protection
```
**Ports used:** Frontend(9000), Backend(8080), Vibe Kanban(8081)

### For Production (Public Access via Ngrok)
```bash
./start-background-prod.sh  # Builds, starts production + creates public tunnel
./check-tunnel.sh           # Verify tunnel status and global connectivity
```
**Public URL:** https://claudecode.ngrok.app

### Port Management Commands (Critical for Avoiding Conflicts)
```bash
npm run port-status        # Check which mode is currently active
npm run switch-to-prod     # Safely switch from development to production  
npm run switch-to-dev      # Safely switch from production to development
npm run stop-all          # Emergency stop of all Claude Code UI processes
npm run protect-ports      # Run port protection service standalone
npm run cleanup-status     # Check Vibe Kanban cleanup service status
npm run cleanup-force      # Force cleanup of orphan processes
```

## 🏗️ **Architecture Overview**

### Complete System Architecture
This is a **web-based UI for Claude Code CLI** with three integrated services:

1. **Frontend (React/Vite)** - Port 9000 (dev only)
   - React 18 with modern hooks and context
   - Tailwind CSS for styling with dark mode
   - CodeMirror 6 for syntax highlighting
   - XTerm.js for terminal emulation
   - Responsive design with PWA support

2. **Backend (Node.js/Express)** - Port 8080 (dev + prod)
   - WebSocket server for real-time terminal/chat
   - SQLite database for projects and usage analytics  
   - JWT-based authentication system
   - Claude Code CLI integration and proxy
   - RESTful API for all frontend operations

3. **Vibe Kanban (Rust/Actix)** - Port 8081 (dev + prod)
   - Advanced task management system
   - Git workflow integration
   - Shared SQLite database with main backend
   - High-performance Rust backend

### Key Navigation Tabs
- **Shell** - Terminal emulation with Claude Code integration
- **Files** - File browser with inline editing capabilities
- **Source Control** - Git operations and branch management  
- **Tasks** - Integrated Vibe Kanban task management panel
- **Dashboard** - Usage analytics and cost tracking

## 🛡️ **Port Protection System (NEW)**

### Critical Feature: Automatic Port Protection
The application now includes **intelligent port protection** that prevents conflicts between development and production modes:

- **Continuous Monitoring:** Checks ports every 5 seconds
- **Process Whitelisting:** Automatically authorizes legitimate Claude Code UI processes
- **Automatic Termination:** Kills unauthorized processes trying to use protected ports

## 🧹 **Vibe Kanban Cleanup System (NEW)**

### Critical Feature: Orphan Process Management
Automatic cleanup system for Vibe Kanban backend processes that prevents server overload:

- **Process Monitoring:** Continuously monitors Vibe Kanban processes (port 8081)
- **Orphan Detection:** Identifies stuck processes from server crashes
- **Automatic Cleanup:** Terminates orphaned processes to prevent queue buildup
- **Health Checks:** Validates process responsiveness before cleanup
- **Resource Management:** Prevents memory exhaustion and server overload

**Why This Matters:**
- Prevents the cycle: Process crashes → Orphan processes → Server overload → More crashes
- Maintains system stability during development
- Automatic recovery from port conflicts and crashes
- **Mode Detection:** Intelligently detects development vs production mode

### Why This Matters
Previously, running `npm run dev` and then `./start-background-prod.sh` would cause:
- Port conflicts (EADDRINUSE errors)
- Process interference
- Application crashes
- Manual cleanup required

**Now:** The system automatically detects conflicts and safely switches between modes.

### Conflict Resolution Commands
```bash
# If you get port conflicts or strange behavior:
npm run port-status     # See what's running
npm run stop-all       # Stop everything
# Then start the mode you want:
npm run dev            # OR
./start-background-prod.sh
```

## 📁 **Critical File Structure**

### Frontend Components (src/components/)
- `MainContent.jsx` - Main tab navigation and content routing
- `Shell.jsx` - Terminal component with WebSocket connection
- `Sidebar.jsx` - Project navigation and session management  
- `FileTree.jsx` - File browser with editing capabilities
- `GitPanel.jsx` - Git operations interface
- `Dashboard.jsx` - Usage analytics and cost tracking
- `VibeTaskPanel.jsx` - Task management quick access

### Backend Core (server/)
- `index.js` - Main Express server with WebSocket support
- `claude-cli.js` - Claude Code CLI integration and proxy
- `projects.js` - Project management and session handling
- `routes/` - API endpoints (auth, git, usage, mcp)
- `database/` - SQLite database management

### Scripts (scripts/)
- `dev.js` - Development orchestrator with port protection
- `port-protection.js` - Port monitoring and protection service
- `port-management.js` - Mode switching and conflict resolution
- `test-port-attack.js` - Port protection testing utility

### Configuration Files
- `package.json` - Dependencies and npm scripts
- `vite.config.js` - Frontend build configuration
- `tailwind.config.js` - Styling configuration

## 🔧 **Development Commands**

### Standard Development
```bash
npm install            # Install all dependencies
npm run dev           # Start all services with protection (RECOMMENDED)

# Individual services (if needed for debugging)
npm run server        # Backend only (port 8080)
npm run client        # Frontend only (port 9000)
npm run vibe-backend  # Vibe Kanban only (port 8081)
```

### Network Development
```bash
./start-network.sh    # Development with network access (0.0.0.0)
npm run dev:network   # Alternative network development command
```

### Production Operations
```bash
npm run build         # Build frontend for production
./start-background-prod.sh  # Full production stack with Ngrok tunnel
./check-tunnel.sh     # Verify tunnel connectivity and performance
```

### Service Management (macOS LaunchAgent)
```bash
./claudecode-service.sh install    # Install as system service
./claudecode-service.sh status     # Check service status
./claudecode-service.sh uninstall  # Remove system service
```

## 🚨 **Common Issues & Solutions**

### Issue: Port Already in Use (EADDRINUSE)
**Cause:** Trying to run development and production simultaneously
**Solution:**
```bash
npm run port-status  # Check current mode
npm run stop-all     # Stop all processes
# Then start desired mode
```

### Issue: Terminal Not Accepting Input
**Cause:** Shell component focus issues or WebSocket disconnection
**Solution:** 
- Check browser console for WebSocket errors
- Refresh the page
- Restart development server

### Issue: Vibe Kanban Not Loading
**Cause:** Rust backend not compiled or port conflicts
**Solution:**
```bash
cd vibe-kanban/backend
cargo build --release
npm run dev  # Restart full stack
```

### Issue: Dashboard Shows No Data
**Cause:** Database not initialized or API errors
**Solution:**
- Check browser network tab for API failures
- Verify database permissions in `server/database/`

### Issue: Git Operations Failing
**Cause:** Not in a git repository or missing git credentials
**Solution:**
- Ensure project is in a git repository
- Check git configuration and credentials

## 📊 **Database Schema**

### Main Database (SQLite)
- `projects` - Project information and paths
- `sessions` - Claude Code sessions and chat history
- `usage_analytics` - Token usage and cost tracking
- `auth` - User authentication data

### Vibe Kanban Database (SQLite)  
- `tasks` - Task information and status
- `projects` - Project-specific task configuration
- `task_attempts` - Execution attempts and results
- `execution_processes` - Process monitoring data

## 🎨 **Frontend Architecture Details**

### State Management
- **React Context:** AuthContext for authentication, ThemeContext for dark/light mode
- **Local State:** Component-level state with useState and useEffect
- **Session Persistence:** Local storage for user preferences and session data

### Responsive Design
- **Mobile First:** Tailwind CSS with responsive breakpoints
- **PWA Support:** Service worker and manifest for offline capability
- **Touch Optimization:** Mobile-specific interactions and gestures

### Performance Optimizations
- **Code Splitting:** Route-based code splitting with React.lazy
- **Caching:** API response caching with time-based invalidation
- **Debouncing:** Terminal resize and search input debouncing
- **Virtual Scrolling:** For large file lists and terminal output

## 🔐 **Security Features**

### Authentication System
- **JWT Tokens:** Secure session management
- **Token Refresh:** Automatic token renewal
- **Route Protection:** Protected routes with authentication checks

### Tool Security
- **Disabled by Default:** All tools require explicit enabling
- **Settings Panel:** Granular control over tool permissions
- **Validation:** Input validation and sanitization

### Port Security
- **Process Whitelisting:** Only authorized processes can use protected ports
- **Automatic Monitoring:** Continuous port monitoring for unauthorized access
- **Safe Termination:** Graceful shutdown with fallback force termination

## 📚 **API Documentation**

### REST Endpoints
```
POST /api/auth/login     - User authentication
GET  /api/projects       - List projects
POST /api/projects       - Create project
GET  /api/usage/stats    - Usage analytics
POST /api/git/commit     - Git operations
```

### WebSocket Events
```
connect    - Establish WebSocket connection
init       - Initialize terminal session
input      - Send terminal input  
resize     - Terminal resize events
ping/pong  - Connection keepalive
```

## 🧪 **Testing Guidelines**

### Manual Testing Checklist
- [ ] All navigation tabs function correctly
- [ ] Terminal accepts input and displays output
- [ ] File browser allows editing and saving
- [ ] Git operations complete successfully
- [ ] Dashboard displays analytics data
- [ ] Task panel CRUD operations work
- [ ] Mobile layout adapts properly
- [ ] Dark/light mode switching works

### Port Protection Testing
```bash
# Run the attack simulation
node scripts/test-port-attack.js
# Should see protection system terminate unauthorized processes
```

### Production Testing
```bash
./start-background-prod.sh
./check-tunnel.sh
# Test public URL access from external network
```

## 📝 **Documentation Files**

### Primary Documentation
- `README.md` - Main project overview and setup
- `CLAUDE.md` - This file - Complete development context
- `PORT-MANAGEMENT.md` - Port protection system documentation

### Feature Documentation  
- `docs/ARCHITECTURE.md` - Detailed architecture documentation
- `docs/API.md` - Complete API reference
- `docs/TROUBLESHOOTING.md` - Common issues and solutions
- `docs/USER_GUIDE.md` - End user documentation

## 🎯 **Development Best Practices**

### Code Style
- **ESLint/Prettier:** Consistent code formatting
- **Component Structure:** Functional components with hooks
- **File Organization:** Feature-based directory structure

### State Management
- **Minimal State:** Use local state when possible
- **Context Sparingly:** Only for truly global state
- **Immutable Updates:** Always update state immutably

### Performance
- **Bundle Size:** Monitor and optimize bundle size
- **Re-renders:** Minimize unnecessary re-renders
- **Memory Leaks:** Clean up event listeners and intervals

### Security
- **Input Validation:** Validate all user inputs
- **XSS Prevention:** Sanitize dynamic content
- **CSRF Protection:** Use CSRF tokens for state-changing operations

## 🚀 **Deployment Options**

### Local Development
```bash
npm run dev  # Full development stack
```

### Production (Background with Tunnel)
```bash  
./start-background-prod.sh  # Production + Ngrok tunnel
```

### System Service (macOS)
```bash
./claudecode-service.sh install  # Auto-start on boot
```

### Manual Production
```bash
npm run build
npm run server  # Production server only (no tunnel)
```

## 📈 **Usage Analytics**

### Tracked Metrics
- **Token Usage:** Input/output tokens per session
- **Cost Tracking:** Estimated costs based on model pricing
- **Session Data:** Duration, message counts, error rates
- **Performance Metrics:** Response times, success rates

### Analytics Dashboard
- **Real-time Stats:** Current session statistics
- **Historical Data:** Usage trends over time
- **Cost Analysis:** Spending analysis and projections
- **Export Options:** Data export for external analysis

---

## ⚠️ **CRITICAL NOTES FOR CLAUDE CODE**

1. **ALWAYS use `npm run dev` for development** - includes port protection
2. **NEVER run dev and production simultaneously** - use switching commands
3. **Check port status before starting** - `npm run port-status`
4. **Read error messages carefully** - port conflicts are now automatically resolved
5. **Use the documentation** - refer to PORT-MANAGEMENT.md for conflicts
6. **Test on mobile** - responsive design is critical
7. **Verify Vibe Kanban** - Rust backend must be compiled
8. **Monitor WebSocket connections** - critical for terminal functionality

This application is actively used for development work, so **stability and reliability are paramount**. When in doubt, ask the user before making significant changes.[byterover-mcp]

# important 
always use byterover-retrieve-knowledge tool to get the related context before any tasks 
always use byterover-store-knowledge to store all the critical informations after sucessful tasks