# Development Scripts

## `npm run dev` - Smart Development Server

Intelligent development script that manages all three services with enhanced features:

### Features
- **🔧 Smart Port Management**: Automatically kills processes using required ports
- **🚀 Service Orchestration**: Starts all services in correct order with dependencies
- **🎨 Color-coded Logging**: Each service has distinct colors for easy identification
- **⚡ Auto-restart**: Failed services automatically restart (max 3 attempts)
- **🛡️ Graceful Shutdown**: Proper cleanup on Ctrl+C
- **🌐 Browser Control**: Only opens frontend browser, skips backend browsers

### Port Configuration
- **Frontend (Vite)**: Port 9000
- **Server (Claude Code UI)**: Port 8080  
- **Backend (VibeKanban)**: Port 8081

### Service Colors
- 🟢 **SERVER** - Claude Code UI Backend
- 🔵 **CLIENT** - Vite Frontend  
- 🟣 **VIBE-BACKEND** - Rust VibeKanban Backend

### Usage
```bash
npm run dev        # Smart development script
npm run dev:old    # Original concurrently script (fallback)
```

### Environment Variables
- `VITE_NO_BROWSER=true` - Disable auto browser opening for Vite
- `VIBE_NO_BROWSER=true` - Disable auto browser opening for VibeKanban backend

### Error Handling
- Automatically detects and kills port conflicts
- Smart restart logic for crashed services
- Comprehensive logging with timestamps
- Graceful degradation if VibeKanban backend is missing

### Benefits over Original
- ✅ Resolves EADDRINUSE port conflicts automatically
- ✅ Better error handling and recovery
- ✅ More intelligent process management
- ✅ Enhanced logging and debugging
- ✅ Prevents unwanted browser windows
- ✅ Configurable restart behavior