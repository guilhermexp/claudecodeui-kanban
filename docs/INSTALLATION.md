# Installation Guide

## Prerequisites

Before installing Claude Code UI, ensure you have the following installed:

### Required Software

1. **Node.js** (v18.0.0 or higher)
   ```bash
   # Check version
   node --version
   
   # Install via nvm (recommended)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

2. **Rust** (v1.70.0 or higher)
   ```bash
   # Install Rust
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Check version
   rustc --version
   cargo --version
   ```

3. **Claude Code CLI**
   ```bash
   # Install globally
   npm install -g @anthropic-ai/claude-code
   
   # Or via Homebrew
   brew install claude-code
   
   # Verify installation
   claude --version
   ```

4. **Git** (optional, for Git features)
   ```bash
   # Check if installed
   git --version
   ```

### System Requirements

- **OS**: macOS, Linux, or Windows (WSL2 recommended)
- **RAM**: Minimum 4GB, 8GB recommended
- **Disk**: 2GB free space
- **Network**: Stable internet connection

## Installation Steps

### 1. Clone the Repository

```bash
# Via HTTPS
git clone https://github.com/yourusername/claude-code-ui.git

# Via SSH
git clone git@github.com:yourusername/claude-code-ui.git

cd claude-code-ui
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# If you encounter issues, try:
npm install --legacy-peer-deps
```

### 3. Build Vibe Kanban

```bash
# Navigate to Vibe Kanban backend

# Build in release mode
cargo build --release

# Return to project root
cd ../..
```

### 4. Environment Configuration

Create a `.env` file in the project root:

```bash
# Copy example environment file
cp .env.example .env

# Edit with your configuration
nano .env
```

Required environment variables:

```env
# Server Configuration
PORT=8080
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080

# Security (generate your own secrets)
JWT_SECRET=your-super-secret-jwt-key-here
SESSION_SECRET=your-session-secret-key-here

# Optional Features
WHISPER_API_KEY=your-openai-api-key  # For voice transcription
GITHUB_CLIENT_ID=your-github-oauth-client-id
GITHUB_CLIENT_SECRET=your-github-oauth-client-secret
```

Generate secure secrets:
```bash
# Generate JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate session secret
openssl rand -base64 32
```

### 5. Database Setup

The application will automatically create SQLite databases on first run:

```bash
# Ensure directories exist
mkdir -p data
```

### 6. Start Development Servers

```bash
# Start all services
npm run dev

# Or start individually:
npm run server       # Node.js backend (8080)
npm run client       # React frontend (9000)
npm run vibe-backend # Rust backend (8081)
```

### 7. Access the Application

Open your browser and navigate to:
- Frontend: http://localhost:9000
- API: http://localhost:8080
- Vibe Kanban: http://localhost:8081

## Production Installation

### 1. Build for Production

```bash
# Build frontend
npm run build

# Build Vibe Kanban
cargo build --release
cd ../..
```

### 2. Using Docker

```bash
# Build Docker image
docker build -t claude-code-ui .

# Run container
docker run -p 8080:8080 -p 8081:8081 \
  -v $(pwd)/data:/app/data \
  -e JWT_SECRET=your-secret \
  -e SESSION_SECRET=your-secret \
  claude-code-ui
```

### 3. Using PM2

```bash
# Install PM2 globally
npm install -g pm2

# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save
pm2 startup
```

### 4. Nginx Configuration

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # Frontend
    location / {
        root /path/to/claude-code-ui/dist;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket proxy
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Vibe Kanban proxy
    location /vibe {
        proxy_pass http://localhost:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Platform-Specific Instructions

### macOS

1. Install Xcode Command Line Tools:
   ```bash
   xcode-select --install
   ```

2. Use Homebrew for dependencies:
   ```bash
   brew install node rust git
   ```

### Linux (Ubuntu/Debian)

1. Update package manager:
   ```bash
   sudo apt update
   sudo apt upgrade
   ```

2. Install build tools:
   ```bash
   sudo apt install build-essential curl
   ```

3. Install Node.js via NodeSource:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt install nodejs
   ```

### Windows

1. **Recommended**: Use WSL2 (Windows Subsystem for Linux)
   ```powershell
   wsl --install
   ```

2. Follow Linux instructions inside WSL2

3. **Alternative**: Native Windows
   - Install Node.js from nodejs.org
   - Install Rust from rust-lang.org
   - Use Git Bash or PowerShell

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   # Find process using port
   lsof -i :8080
   
   # Kill process
   kill -9 <PID>
   ```

2. **Permission denied errors**
   ```bash
   # Fix npm permissions
   npm config set prefix ~/.npm-global
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
   source ~/.bashrc
   ```

3. **Rust compilation errors**
   ```bash
   # Update Rust
   rustup update
   
   # Clean and rebuild
   cargo clean
   cargo build --release
   ```

4. **Database locked errors**
   ```bash
   # Remove lock files
   rm data/*.db-wal
   rm data/*.db-shm
   ```

### Getting Help

If you encounter issues:

1. Check the [Troubleshooting Guide](TROUBLESHOOTING.md)
2. Search [existing issues](https://github.com/yourusername/claude-code-ui/issues)
3. Join our [Discord community](https://discord.gg/claude-code-ui)
4. Create a new issue with:
   - Error messages
   - System information
   - Steps to reproduce

## Next Steps

After successful installation:

1. Read the [User Guide](USER_GUIDE.md)
2. Configure [Tool Permissions](USER_GUIDE.md#tool-permissions)
3. Set up [Whisper Integration](../WHISPER_SETUP.md) (optional)
4. Explore the [API Documentation](API.md)

## Updating

To update to the latest version:

```bash
# Pull latest changes
git pull origin main

# Update dependencies
npm install

# Rebuild Vibe Kanban
Note: Vibe Kanban companion backend has been removed from this repository. Instructions related to `vibe-kanban/*` are obsolete.
cargo build --release
cd ../..

# Rebuild frontend
npm run build
```
