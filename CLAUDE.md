# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. **IMPORTANT: Read this entire file to understand the project context and avoid common issues.**

## 🚀 **Quick Start Guide**

### For Development (Local Testing)
```bash
npm install          # Install all dependencies (Node.js)
npm run dev         # Start development mode with port protection
```
**Ports used:** Frontend(5892), Backend(7347)

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
```

## 🏗️ **Architecture Overview**

### Complete System Architecture
This is **Claude Code UI** - a web-based interface for Claude Code CLI with two core services:

1. **Frontend (React/Vite)** - Port 5892 (dev only)
   - React 18 with modern hooks and context
   - Tailwind CSS for styling with dark mode
   - CodeMirror 6 for syntax highlighting
   - XTerm.js for terminal emulation
   - Responsive design with PWA support

2. **Backend (Node.js/Express)** - Port 7347 (dev + prod)
   - WebSocket server for real-time terminal/chat
   - SQLite database for projects and session management
   - JWT-based authentication system
   - Claude Code CLI integration and proxy
   - RESTful API for all frontend operations

### Key Navigation Tabs
- **Shell** - Terminal emulation with Claude Code integration
- **Files** - File browser with inline editing capabilities
- **Git** - Git operations and branch management

## 🛡️ **Port Protection System (NEW)**

### Critical Feature: Automatic Port Protection
The application now includes **intelligent port protection** that prevents conflicts between development and production modes:

- **Continuous Monitoring:** Checks ports every 5 seconds
- **Process Whitelisting:** Automatically authorizes legitimate Claude Code UI processes
- **Automatic Termination:** Kills unauthorized processes trying to use protected ports

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
- `FileManagerSimple.jsx` - File browser with editing capabilities
- `GitPanel.jsx` - Git operations interface
- `OverlayChatClaude.jsx` - Claude chat overlay interface
- `FloatingMicMenu.jsx` - Voice input interface with TTS support
- `ResourceMonitor.jsx` - System resource monitoring display
- `PreviewPanel.jsx` - Code preview and documentation panel
- `CodeEditor.jsx` - CodeMirror-based code editor component

### Backend Core (server/)
- `index.js` - Main Express server with WebSocket support
- `claude-cli.js` - Claude Code CLI integration and proxy
- `projects.js` - Project management and session handling
- `routes/` - API endpoints (auth, git, files, tts, claude-hooks, claude-stream, usage, preview, system)
- `database/` - SQLite database management

### Scripts (scripts/)
- `dev.js` - Development orchestrator with port protection
- `port-protection.js` - Port monitoring and protection service
- `port-management.js` - Mode switching and conflict resolution
- `test-port-attack.js` - Port protection testing utility

### Configuration Files
- `package.json` - Dependencies and npm scripts
- `vite.config.js` - Frontend build configuration with Ngrok support and proxy rules
- `tailwind.config.js` - Styling configuration with custom theme variables
- `src/index.css` - Global CSS with custom properties for theming and mobile optimization

## 🔧 **Development Commands**

### Standard Development
```bash
npm install            # Install all dependencies
npm run dev           # Start all services with protection (RECOMMENDED)

# Individual services (if needed for debugging)
npm run server        # Backend only (port 7347)
npm run client        # Frontend only (port 5892)
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

### Issue: File Browser Not Loading
**Cause:** Backend API errors or permission issues
**Solution:**
- Check browser network tab for API failures
- Verify file system permissions
- Restart development server

### Issue: Git Operations Failing
**Cause:** Not in a git repository or missing git credentials
**Solution:**
- Ensure project is in a git repository
- Check git configuration and credentials

## 📊 **Database Schema**

### Main Database (SQLite)
- `projects` - Project information and paths
- `sessions` - Claude Code sessions and chat history
- `auth` - User authentication data

## 🎨 **Frontend Architecture Details**

### CSS Architecture & Theming System
- **CSS Custom Properties:** Comprehensive theming system in `src/index.css` with semantic color variables
- **Theme Variables:** Complete support for `--primary`, `--success`, `--destructive`, `--warning`, `--accent` colors
- **Mobile Classes:** Specialized classes for mobile optimization:
  - `.mobile-modal` - Full-height mobile modals with dynamic viewport support
  - `.mobile-content` - Mobile content containers with safe area support  
  - `.ios-sides-safe` / `.ios-bottom-safe` - iOS safe area handling
  - `.scrollable-content` - Touch-optimized scrolling containers
- **Responsive Strategy:** Mobile-first design with desktop side panels that convert to full-screen modals on mobile
- **Color Consistency:** Use semantic color classes (`text-primary`, `bg-success`) instead of hardcoded colors (`text-blue-500`)

### State Management
- **React Context:** AuthContext for authentication, ThemeContext for dark/light mode
- **Local State:** Component-level state with useState and useEffect
- **Session Persistence:** Local storage for user preferences and session data

### Responsive Design & Mobile Optimization
- **Mobile First:** Tailwind CSS with responsive breakpoints
- **PWA Support:** Service worker and manifest for offline capability  
- **Touch Optimization:** Mobile-specific interactions with 44px minimum touch targets
- **iOS Safe Areas:** Complete support with `env(safe-area-inset-*)` for notched devices
- **Mobile Navigation:** Bottom nav with `MobileNav.jsx` component for mobile UI
- **CSS Custom Properties:** Consistent theming system with CSS variables for light/dark modes
- **Mobile Modal System:** Custom `.mobile-modal` and `.mobile-content` classes for full-screen mobile experiences

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
POST /api/git/commit     - Git operations
GET  /api/files/*        - File system operations
POST /api/tts/gemini-summarize - Generate audio from text with AI summarization
GET  /api/audios/:id     - Retrieve generated audio files
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

### AI Documentation Structure (NEW - 2025-01-10)

**Organized AI documentation directories for long-term project maintenance:**

- **ai_changelog/** - Version history and change tracking
  - `CHANGELOG_FORK.md` - Main changelog with semantic versioning
  - View `ai_changelog/README.md` for guidelines

- **ai_docs/** - Technical documentation and architecture
  - `ARCHITECTURE_OVERVIEW.md` - Complete system design and decisions
  - `README.md` - Index and navigation guide
  - Additional docs to be added as needed

- **ai_issues/** - Bug tracking and known limitations
  - Current status: ✅ No critical issues
  - Resolved issues documented for reference
  - View `ai_issues/README.md` for templates and guidelines

- **ai_research/** - Research notes and experiments
  - Dependency analysis results
  - Bundle size optimization ideas
  - Performance verification results
  - View `ai_research/README.md` for methodology

- **ai_specs/** - Technical specifications
  - Component specifications
  - API specifications
  - Database schemas
  - View `ai_specs/README.md` for templates

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

### Mobile & CSS Development Guidelines
- **ALWAYS use semantic color classes:** Use `text-primary`, `bg-success`, `text-destructive` instead of `text-blue-500`, `bg-green-500`, `text-red-500`
- **Mobile modal structure:** Use `mobile-modal` and `mobile-content` classes for full-screen mobile experiences
- **Touch targets:** Ensure minimum 44px touch targets with `min-h-[44px] min-w-[44px]` classes
- **Safe areas:** Apply `ios-sides-safe` and `ios-bottom-safe` classes to mobile layouts
- **Component patterns:** Desktop uses side panels, mobile uses full-screen modals with same content

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

## 📊 **Session Management**

### Tracked Data
- **Session Data:** Duration, message counts, error rates
- **Performance Metrics:** Response times, success rates
- **Project Information:** Project paths and configurations
- **Authentication:** User sessions and security tokens

---

## 🧹 **Recent Updates (2025-01-10)**

### Comprehensive Codebase Cleanup ✅
- **Status**: Completed and Validated
- **Changes**: Removed 56 obsolete files, eliminated 7,357 lines of dead code
- **Affected**: Debug artifacts, deprecated components, old utilities
- **Commit**: `3e1b7d3` - chore: Remove obsolete files and deprecated components
- **Build Status**: ✅ Passes with no regressions
- **Backup Tag**: `cleanup-backup-20250110` - For rollback if needed

### New AI Documentation Infrastructure ✅
- Created 5 organized documentation directories (ai_changelog, ai_docs, ai_issues, ai_research, ai_specs)
- Added comprehensive architecture documentation in `ai_docs/ARCHITECTURE_OVERVIEW.md`
- Established changelog tracking in `ai_changelog/CHANGELOG_FORK.md`
- See "AI Documentation Structure" section above for full details

### What This Means
- Codebase is now cleaner and more maintainable
- Documentation is organized for long-term project sustainability
- Any new agent can quickly understand project state via ai_docs/
- Future changes are tracked systematically in ai_changelog/

---

## ⚠️ **CRITICAL NOTES FOR CLAUDE CODE**

1. **ALWAYS use `npm run dev` for development** - includes port protection
2. **NEVER run dev and production simultaneously** - use switching commands
3. **Check port status before starting** - `npm run port-status`
4. **Read error messages carefully** - port conflicts are now automatically resolved
5. **Use the documentation** - refer to PORT-MANAGEMENT.md for conflicts
6. **Test on mobile** - responsive design is critical
7. **Focus on core functionality** - Terminal, files, and git operations
8. **Monitor WebSocket connections** - critical for terminal functionality
9. **Use semantic CSS classes** - Never use hardcoded colors like `text-blue-500`, always use theme variables
10. **Mobile-first development** - Test mobile layout and touch interactions
11. **Reference AI Documentation** - Check `ai_docs/` for architecture and implementation details
12. **Track Changes** - Document work in appropriate `ai_*` directories

This application is actively used for development work, so **stability and reliability are paramount**. When in doubt, ask the user before making significant changes.

## 🔊 **Claude Code Hooks - Sound Notifications**

### Overview
The application now supports **native Claude Code CLI hooks** for sound notifications when Claude completes tasks. This uses the official Claude Code hooks system to play sounds universally across all interfaces.

### Quick Commands
```bash
npm run hooks:enable    # Enable sound notifications with default Glass sound
npm run hooks:disable   # Disable all sound notifications
npm run hooks:status    # Show current configuration  
npm run hooks:list      # List all available system sounds
npm run hooks:test <sound> [type]  # Test a specific sound
```

### How It Works
- **Native Integration**: Uses official Claude Code CLI hooks system (`~/.claude/config.json`)
- **Universal**: Works with any Claude Code interface (terminal, VS Code, this UI)
- **Stop Hook**: Plays sound when Claude finishes responding
- **Notification Hook**: Plays sound for general notifications
- **macOS System Sounds**: Uses built-in macOS sounds (Glass, Ping, Sosumi, etc.)

### Available Sounds
The system automatically detects available sounds:
- **System Sounds**: Basso, Blow, Bottle, Frog, Funk, Glass, Hero, Morse, Ping, Pop, Purr, Sosumi, Submarine, Tink
- **Custom Sounds**: Any `.wav` files in `/public/sounds/` directory

### UI Configuration
1. Open **Settings** in the application interface
2. Go to **Claude Hooks** tab  
3. Toggle sound notifications on/off
4. Test different sounds
5. View current configuration status

### Configuration Files
- **Claude Config**: `~/.claude/config.json` (automatically managed)
- **Hook Script**: `scripts/setup-claude-hooks.js` 
- **API Routes**: `/api/claude-hooks/*` endpoints
- **CLI Tool**: `scripts/claude-hooks-cli.js`

### Example Hook Configuration
```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "afplay \"/System/Library/Sounds/Glass.aiff\""
          }
        ]
      }
    ]
  }
}
```

### Benefits
- **Work Efficiency**: No need to constantly monitor Claude Code progress
- **Context Switching**: Start a task, switch windows, get notified when complete
- **Universal**: Same notification system works across all Claude Code interfaces
- **Customizable**: Choose from various system sounds or add custom ones

