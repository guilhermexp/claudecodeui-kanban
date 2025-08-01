# User Guide

## Getting Started

Welcome to Claude Code UI! This guide will help you get the most out of the application.

## First Time Setup

### 1. Login or Register

When you first open Claude Code UI, you'll need to create an account:

1. Click **"Register"** on the login screen
2. Choose a username and password
3. Click **"Create Account"**

### 2. Add Your First Project

After logging in:

1. Click **"Add Project"** in the sidebar
2. Enter a project name
3. Select or enter the project path
4. Click **"Create"**

### 3. Configure Tool Permissions

For security, all tools are disabled by default:

1. Click the **Settings** icon (⚙️) in the sidebar
2. Go to **"Tool Permissions"**
3. Enable the tools you need:
   - **Write**: Create new files
   - **Edit**: Modify existing files
   - **Bash**: Run shell commands
   - **Web Fetch**: Access web content

## Features Overview

### Chat Interface

The chat interface is where you interact with Claude:

#### Basic Usage
1. Type your message in the input box
2. Press **Enter** or click **Send**
3. Claude will respond with code, explanations, or actions

#### Advanced Features

**Voice Input** 🎤
- Click the microphone button
- Speak your command
- The text will be transcribed automatically

**File Uploads** 📎
- Drag and drop files into the chat
- Or click the attachment button
- Supports images, code files, and documents

**Code Blocks**
- Code is automatically syntax highlighted
- Click the copy button to copy code
- Line numbers are included for reference

**Session Management**
- Sessions are automatically saved
- Click on a session in the sidebar to resume
- Search sessions using the search bar

### Terminal (Shell)

The integrated terminal provides direct CLI access:

#### Connecting
1. Go to the **Terminal** tab
2. Click **"Continue in Shell"**
3. The terminal will connect to your project directory

#### Features

**Bypass Permissions** 🔓
- Click the **Bypass** button to enable dangerous operations
- Use with caution - this allows destructive commands
- The button turns yellow when active

**Voice Commands** 🎤
- Click the microphone button
- Speak your command
- It will be typed into the terminal

**Session Persistence**
- Terminal sessions persist across tab switches
- Reconnect to continue where you left off

#### Keyboard Shortcuts
- **Ctrl/Cmd + C**: Copy selected text
- **Ctrl/Cmd + V**: Paste
- **Ctrl/Cmd + F**: Search in terminal

### File Explorer

Navigate and edit your project files:

#### Navigation
- Click folders to expand/collapse
- Click files to open in editor
- Use the search box to find files

#### Editing Files
1. Click on any file to open it
2. Edit in the built-in code editor
3. Changes are saved automatically
4. Syntax highlighting for all major languages

#### File Operations
- **Right-click** for context menu
- Create new files/folders
- Rename or delete items
- Copy file paths

### Git Integration

Manage your Git repository visually:

#### Git Status
- See modified, staged, and untracked files
- Stage/unstage files with checkboxes
- View diffs before committing

#### Committing Changes
1. Stage your files
2. Enter a commit message
3. Click **"Commit"**
4. Optional: Push to remote

#### Branch Management
- Switch branches from the dropdown
- Create new branches
- Merge branches
- View branch history

### Vibe Kanban

Organize your tasks with the integrated Kanban board:

#### Creating Tasks
1. Click **"+ New Task"** in any column
2. Enter task title and description
3. Assign labels and priorities
4. Click **"Create"**

#### Managing Tasks
- **Drag and drop** tasks between columns
- Click tasks to view/edit details
- Add comments and attachments
- Link tasks to Git commits

#### Board Views
- **All Tasks**: See everything
- **My Tasks**: Your assigned tasks
- **Today**: Due today
- **This Week**: Due this week

## Mobile Usage

Claude Code UI is fully responsive and touch-optimized:

### Mobile Features
- **Bottom Navigation**: Easy thumb access
- **Swipe Gestures**: Navigate between tabs
- **Touch Terminal**: Tap to focus, pinch to zoom
- **Voice First**: Enhanced voice input on mobile

### PWA Installation
1. Open Claude Code UI in your mobile browser
2. Tap the **Share** button
3. Select **"Add to Home Screen"**
4. The app will install as a PWA

## Tips & Tricks

### Productivity Tips

1. **Use Sessions Effectively**
   - Keep related work in the same session
   - Use descriptive first messages for easy searching
   - Archive old sessions to reduce clutter

2. **Keyboard Shortcuts**
   - **Ctrl/Cmd + K**: Quick command palette
   - **Ctrl/Cmd + P**: Quick file search
   - **Ctrl/Cmd + Shift + P**: Project switcher

3. **Voice Commands**
   - Say "create a function that..."
   - Say "explain this code"
   - Say "refactor this to use..."

### Best Practices

1. **Security**
   - Only enable tools you need
   - Be cautious with Bash commands
   - Review code before executing
   - Use bypass mode sparingly

2. **Performance**
   - Close unused tabs
   - Clear old sessions periodically
   - Limit file uploads to <10MB

3. **Organization**
   - Use meaningful project names
   - Keep tasks updated in Kanban
   - Commit frequently with clear messages

## Troubleshooting

### Common Issues

**"Connection Lost" in Terminal**
- Check your internet connection
- Click "Restart" to reconnect
- Ensure Claude CLI is running

**Chat Not Responding**
- Check the status indicator (top right)
- Refresh the page if needed
- Check browser console for errors

**Files Not Saving**
- Ensure Write permission is enabled
- Check file permissions on disk
- Try saving with Ctrl/Cmd + S

**Voice Input Not Working**
- Allow microphone permissions
- Ensure HTTPS connection
- Check browser compatibility

### Getting Help

1. Check the [FAQ](FAQ.md)
2. Search [GitHub Issues](https://github.com/yourusername/claude-code-ui/issues)
3. Join our [Discord](https://discord.gg/claude-code-ui)
4. Contact support

## Advanced Usage

### Custom Commands

Create shortcuts for common tasks:

1. Go to Settings → Custom Commands
2. Click "Add Command"
3. Define trigger and action
4. Save and use with /command

### API Integration

Use the REST API for automation:

```bash
# Get auth token
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your-username","password":"your-password"}'

# Send a message
curl -X POST http://localhost:8080/api/chat/message \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello Claude","projectPath":"/path/to/project"}'
```

### Webhooks

Configure webhooks for events:

1. Go to Settings → Webhooks
2. Add webhook URL
3. Select events to monitor
4. Test and save

## Privacy & Security

### Data Storage
- All data is stored locally
- Sessions are encrypted at rest
- No telemetry or tracking

### Security Features
- JWT authentication
- Session timeouts
- Tool permission system
- Audit logging

### Best Practices
- Use strong passwords
- Enable 2FA (coming soon)
- Review permissions regularly
- Keep software updated

## Feedback

We'd love to hear from you!

- **Feature Requests**: Open a GitHub issue
- **Bug Reports**: Use the bug report template
- **General Feedback**: Join our Discord
- **Contributing**: See [CONTRIBUTING.md](../CONTRIBUTING.md)