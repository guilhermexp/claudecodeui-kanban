<div align="center">
  <img src="public/logo.svg" alt="Claude Code UI" width="64" height="64">
  <h1>Claude Code UI + Vibe Kanban</h1>
  <p><strong>Web interface for Claude Code CLI with integrated task management</strong></p>
  
  [![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/yourusername/claude-code-ui)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
  [![Rust](https://img.shields.io/badge/rust-%3E%3D1.70.0-orange.svg)](https://www.rust-lang.org)
</div>

---

## 🚀 Overview

Claude Code UI is a modern, responsive web interface for [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code), enhanced with **Vibe Kanban** - a powerful Rust-based task management system.

### ✨ Key Features

- **🏗️ Triple Backend Architecture** - Node.js (Express) + Rust (Actix-web) for optimal performance
- **📱 Fully Responsive** - Desktop, tablet, and mobile with PWA support
- **🎯 Vibe Kanban Integration** - Complete task management with quick access panel
- **📊 Usage Dashboard** - Integrated analytics for Claude Code usage and costs
- **💬 Enhanced Chat** - Voice transcription, file uploads, and smart suggestions
- **🔧 Advanced Terminal** - Shell integration with responsive resizing
- **📁 File Explorer** - Split-view file browsing with inline editing
- **🔀 Git Integration** - Visual branch management, commits, and PRs
- **🎨 Theme Support** - Light/dark modes with system preference detection
- **🔒 Security** - JWT authentication and tool permission management

## 📸 Screenshots

<div align="center">
<table>
<tr>
<td align="center">
<h3>Desktop Interface</h3>
<img src="docs/images/desktop-main.png" alt="Desktop Interface" width="400">
<br><em>Full-featured desktop experience with integrated tabs</em>
</td>
<td align="center">
<h3>Mobile Experience</h3>
<img src="docs/images/mobile-chat.png" alt="Mobile Interface" width="200">
<br><em>Touch-optimized mobile UI</em>
</td>
</tr>
<tr>
<td align="center">
<h3>Usage Dashboard</h3>
<img src="docs/images/dashboard.png" alt="Usage Dashboard" width="400">
<br><em>Track usage, costs, and analytics</em>
</td>
<td align="center">
<h3>Vibe Kanban Panel</h3>
<img src="docs/images/vibe-panel.png" alt="Vibe Kanban Panel" width="400">
<br><em>Quick task creation and management</em>
</td>
</tr>
</table>
</div>

## 🛠️ Installation

### Prerequisites

- **Node.js** ≥ 18.0.0
- **Rust** ≥ 1.70.0
- **Claude Code CLI** installed and configured
- **Git** (optional, for Git features)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/claude-code-ui.git
cd claude-code-ui

# Install dependencies
npm install

# Build Vibe Kanban (Rust backend)
cd vibe-kanban/backend
cargo build --release
cd ../..

# Start development servers
npm run dev
```

The application will be available at:
- Frontend: http://localhost:9000
- API Server: http://localhost:8080
- Vibe Kanban: http://localhost:8081

### Production Deployment

```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🎯 Features

### Main Navigation Tabs
- **Shell** - Full terminal emulation with Claude integration
- **Files** - Project file browser with split-view editing
- **Source Control** - Git operations and visual management
- **Tasks** - Quick access Vibe Kanban panel
- **Dashboard** - Usage analytics and cost tracking

### Chat Interface
- **Voice Transcription** - Speak commands using Whisper API
- **File Uploads** - Drag & drop files and images
- **Code Highlighting** - Syntax highlighting for code blocks
- **Markdown Support** - Full markdown rendering
- **Session Management** - Save and resume conversations
- **Session Protection** - Prevents interruption during active conversations

### Terminal Integration
- **XTerm.js** - Full terminal emulation
- **Claude Integration** - Direct CLI access
- **Responsive Resizing** - Adapts to panel changes
- **Session Persistence** - Maintain terminal sessions
- **Mobile Optimized** - Touch-friendly controls

### Vibe Kanban Panel
- **Quick Task Creation** - Create tasks without leaving main interface
- **Inline Task Details** - View and edit tasks in the same panel
- **Project Integration** - Tasks linked to current project
- **Real-time Updates** - Syncs with full Vibe Kanban board
- **Status Tracking** - Visual status indicators

### File Management
- **Split View** - Browse files while editing
- **Inline Editing** - Edit files without modal dialogs
- **Syntax Highlighting** - CodeMirror 6 integration
- **Image Preview** - Built-in image viewer
- **View Modes** - Simple, Compact, and Detailed views

### Usage Dashboard
- **Cost Tracking** - Monitor Claude Code API costs
- **Token Usage** - Track token consumption by model
- **Session Analytics** - View session statistics
- **Time Tracking** - Monitor usage over time
- **Project Breakdown** - Costs per project
- **Timeline View** - Historical usage patterns

### Git Features
- **Visual Branches** - See branch structure
- **Commit History** - Browse commits with diffs
- **Pull Requests** - Create and manage PRs
- **Status Tracking** - Real-time Git status

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=8080
VITE_API_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080

# Optional Features
WHISPER_API_KEY=your_openai_api_key
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Security
JWT_SECRET=your_jwt_secret_key
SESSION_SECRET=your_session_secret
```

### Tool Permissions

Tools are disabled by default for security. Enable them in Settings:

```javascript
{
  "tools": {
    "write": false,
    "edit": false,
    "bash": false,
    "web_fetch": false
  }
}
```

## 📱 Mobile Support

### Progressive Web App
- Install as native app on mobile devices
- Offline support with service workers
- Responsive layouts for all screen sizes

### Touch Optimizations
- Bottom navigation bar
- Swipe gestures
- Touch-friendly buttons
- Adaptive UI elements

## 🔒 Security

### Authentication
- JWT-based authentication
- Session management
- Secure password hashing

### Tool Safety
- All tools disabled by default
- Per-tool permission control
- Bypass mode for advanced users
- Audit logging

## 🧪 Development

### Project Structure

```
claude-code-ui/
├── src/                    # React frontend
│   ├── components/        # UI components
│   │   ├── Dashboard/    # Dashboard components
│   │   ├── vibe-kanban/  # Vibe Kanban integration
│   │   └── ui/           # Shared UI components
│   ├── hooks/            # Custom React hooks
│   ├── utils/            # Utility functions
│   └── contexts/         # React contexts
├── server/                # Node.js backend
│   ├── routes/           # API routes
│   ├── database/         # SQLite integration
│   └── lib/              # Server utilities
├── vibe-kanban/          # Rust backend
│   ├── backend/          # Actix-web server
│   └── frontend/         # Vibe UI components
├── public/               # Static assets
└── scripts/              # Build and dev scripts
```

### Available Scripts

```bash
npm run dev              # Start all development servers
npm run dev:network      # Start with network access
npm run build            # Build for production
npm run test             # Run tests
npm run test:e2e         # Run E2E tests
npm run tunnel           # Create Cloudflare tunnel
npm run ngrok            # Create ngrok tunnel
```

### Recent Improvements

- **Dashboard Integration** - Dashboard now available as main navigation tab
- **Vibe Kanban Panel** - Quick access panel with responsive design
- **File Browser Split View** - Browse and edit files side-by-side
- **Session Protection** - Prevents project updates during active conversations
- **Improved Responsiveness** - Better adaptation to panel state changes
- **UI Polish** - Cleaner transitions and animations
- **Code Cleanup** - Removed dead code and consolidated utilities

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Guidelines
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- JavaScript: ESLint with Prettier
- Rust: rustfmt and clippy
- Commits: Conventional Commits

## 📚 Documentation

- [Installation Guide](docs/INSTALLATION.md)
- [User Guide](docs/USER_GUIDE.md)
- [API Documentation](docs/API.md)
- [Architecture Overview](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

## 🐛 Known Issues

- Terminal may disconnect on network changes
- File uploads limited to 10MB
- Some Git operations require CLI fallback

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Anthropic](https://anthropic.com) for Claude and Claude Code CLI
- [XTerm.js](https://xtermjs.org) for terminal emulation
- [CodeMirror](https://codemirror.net) for code editing
- [Vite](https://vitejs.dev) for build tooling
- [Tailwind CSS](https://tailwindcss.com) for styling

---

<div align="center">
  <p>Made with ❤️ by the Claude Code UI Team</p>
  <p>
    <a href="https://github.com/yourusername/claude-code-ui">GitHub</a> •
    <a href="https://docs.claude-code-ui.com">Documentation</a> •
    <a href="https://discord.gg/claude-code-ui">Discord</a>
  </p>
</div>