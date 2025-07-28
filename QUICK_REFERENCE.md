# Claude Code UI - Quick Reference Guide

## 🚀 Quick Start

```bash
# Clone and setup
git clone https://github.com/siteboon/claudecodeui.git
cd claudecodeui
npm install

# Configure
cp .env.example .env

# Start development
npm run dev
```

## 📋 Common Commands

### Development
```bash
npm run dev              # Start all services
npm run server           # Backend only (port 8080)
npm run client           # Frontend only (port 9000)
npm run vibe-backend     # Vibe Kanban only (port 8081)
```

### Production
```bash
npm run build            # Build frontend
npm start                # Start production server
```

### Utilities
```bash
npm run lint             # Check code style
npm run lint:fix         # Fix code style issues
npm run ngrok:start      # Start with ngrok tunnel
```

## 🔧 Configuration

### Essential Environment Variables
```bash
PORT=8080                # Backend port
VITE_PORT=9000          # Frontend port
VIBE_PORT=8081          # Vibe Kanban port
JWT_SECRET=secret       # Change in production!
SESSION_SECRET=secret   # Change in production!
```

## 🏗️ Architecture Overview

```
Frontend (9000) → Backend (8080) → Claude CLI
                     ↓
              Vibe Kanban (8081)
```

## 📁 Key Files & Directories

### Frontend
- `src/App.jsx` - Main application
- `src/components/` - React components
- `src/utils/websocket.js` - WebSocket client

### Backend
- `server/index.js` - Express server
- `server/claude-cli.js` - Claude integration
- `server/lib/` - Shared libraries
  - `logger.js` - Logging system
  - `cache.js` - Caching
  - `vibe-proxy.js` - Proxy with retry

### Configuration
- `.env` - Environment variables
- `vite.config.js` - Frontend build
- `eslint.config.js` - Code style

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `DELETE /api/projects/:name` - Delete project

### Files
- `GET /api/projects/:name/files` - File tree
- `GET /api/projects/:name/file?path=` - Read file
- `POST /api/projects/:name/file` - Save file

### Git
- `GET /api/git/:name/status` - Git status
- `POST /api/git/:name/stage` - Stage files
- `POST /api/git/:name/commit` - Create commit

### WebSockets
- `ws://localhost:8080/ws` - Chat interface
- `ws://localhost:8080/shell` - Terminal

## 🛠️ Troubleshooting

### Port Already in Use
```bash
# Kill processes on ports
lsof -ti:9000 | xargs kill -9
lsof -ti:8080 | xargs kill -9  
lsof -ti:8081 | xargs kill -9
```

### Vibe Kanban Not Running
```bash
# Build and run manually
cd vibe-kanban/backend
cargo build --release
cargo run --release
```

### WebSocket Connection Failed
1. Check all services are running
2. Verify `.env` configuration
3. Check browser console for errors

## 🔒 Security Notes

1. **Tools are disabled by default**
   - Enable in Settings → Tools
   - Only enable what you need

2. **Change default secrets**
   ```bash
   JWT_SECRET=use-a-strong-random-string
   SESSION_SECRET=use-another-strong-string
   ```

3. **Production checklist**
   - [ ] Use HTTPS
   - [ ] Set strong secrets
   - [ ] Enable authentication
   - [ ] Limit tool permissions

## 📱 Mobile Access

### Local Network
```bash
npm run dev:network
# Access via: http://YOUR_IP:9000
```

### Remote Access (Ngrok)
```bash
npm run ngrok:start
# Follow the URL provided
```

## 🎯 Common Tasks

### Add a New Component
1. Create in `src/components/`
2. Import in parent component
3. Add to router if needed

### Add API Endpoint
1. Create route in `server/routes/`
2. Add to `server/index.js`
3. Implement authentication if needed

### Modify Vibe Kanban
1. Edit Rust code in `vibe-kanban/backend/src/`
2. Rebuild: `cargo build --release`
3. Restart services

## 🐛 Debug Mode

### Enable Debug Logging
```bash
LOG_LEVEL=DEBUG npm run dev
```

### Check Logs
- Frontend: Browser console
- Backend: Terminal output
- Vibe: `vibe-kanban/backend/logs/`

## 📚 Resources

- [Main Documentation](PROJECT_INDEX.md)
- [Claude Code Docs](https://docs.anthropic.com/en/docs/claude-code)
- [React Docs](https://react.dev)
- [Vite Docs](https://vitejs.dev)