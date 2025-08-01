<div align="center">
  <img src="public/logo.svg" alt="Claude Code UI" width="64" height="64">
  <h1>Claude Code UI + Vibe Kanban</h1>
  <p><strong>Web interface for Claude Code CLI with integrated task management</strong></p>
  
  [![Version](https://img.shields.io/badge/version-1.5.0-blue.svg)](https://github.com/yourusername/claude-code-ui)
  [![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
  [![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
  [![Rust](https://img.shields.io/badge/rust-%3E%3D1.70.0-orange.svg)](https://www.rust-lang.org)
</div>

---

## 🚀 Overview

Claude Code UI is a modern, responsive web interface for [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code), enhanced with **Vibe Kanban** - a powerful Rust-based task management system.

### ✨ Key Features

- **🏗️ Dual Backend Architecture** - Node.js (Express) + Rust (Actix-web)
- **📱 Fully Responsive** - Desktop, tablet, and mobile with PWA support
- **🎯 Vibe Kanban Integration** - Complete task management system
- **💬 Enhanced Chat** - Voice transcription, file uploads, and smart suggestions
- **🔧 Advanced Terminal** - Shell integration with bypass permissions
- **📁 File Explorer** - Live editing with syntax highlighting
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
<br><em>Full-featured desktop experience</em>
</td>
<td align="center">
<h3>Mobile Experience</h3>
<img src="docs/images/mobile-chat.png" alt="Mobile Interface" width="200">
<br><em>Touch-optimized mobile UI</em>
</td>
</tr>
<tr>
<td align="center">
<h3>Vibe Kanban Board</h3>
<img src="docs/images/vibe-kanban.png" alt="Vibe Kanban" width="400">
<br><em>Drag-and-drop task management</em>
</td>
<td align="center">
<h3>Integrated Terminal</h3>
<img src="docs/images/terminal.png" alt="Terminal" width="400">
<br><em>Full terminal with Claude integration</em>
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

### Chat Interface
- **Voice Transcription** - Speak commands using Whisper API
- **File Uploads** - Drag & drop files and images
- **Code Highlighting** - Syntax highlighting for code blocks
- **Markdown Support** - Full markdown rendering
- **Session Management** - Save and resume conversations

### Terminal Integration
- **XTerm.js** - Full terminal emulation
- **Claude Integration** - Direct CLI access
- **Bypass Permissions** - Toggle dangerous operations
- **Session Persistence** - Maintain terminal sessions
- **Mobile Optimized** - Touch-friendly controls

### Vibe Kanban
- **Task Boards** - Organize tasks in columns
- **Drag & Drop** - Intuitive task management
- **Git Integration** - Link tasks to commits
- **Real-time Sync** - Updates across all clients
- **Markdown Editor** - Rich text task descriptions

### File Management
- **Tree View** - Navigate project structure
- **Live Editing** - Edit files with syntax highlighting
- **Search** - Find files and content quickly
- **Preview** - View images and documents

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
- Push notifications (coming soon)

### Touch Optimizations
- Bottom navigation bar
- Swipe gestures
- Touch-friendly buttons
- Responsive layouts

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

### Testing

```bash
# Unit tests
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

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