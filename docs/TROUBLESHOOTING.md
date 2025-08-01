# Troubleshooting Guide

## Common Issues and Solutions

### Installation Issues

#### Node.js Version Error
**Problem**: `Error: Node.js version 16.x.x is not supported`

**Solution**:
```bash
# Update Node.js using nvm
nvm install 18
nvm use 18
nvm alias default 18
```

#### Rust Compilation Fails
**Problem**: `error: could not compile vibe-kanban`

**Solution**:
```bash
# Update Rust
rustup update

# Clean and rebuild
cd vibe-kanban/backend
cargo clean
cargo build --release
```

#### Permission Denied During Install
**Problem**: `EACCES: permission denied`

**Solution**:
```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

### Runtime Issues

#### Port Already in Use
**Problem**: `Error: listen EADDRINUSE: address already in use :::8080`

**Solution**:
```bash
# Find process using port
lsof -i :8080

# Kill the process
kill -9 <PID>

# Or use different ports
PORT=8090 npm run server
```

#### Database Locked
**Problem**: `SQLITE_BUSY: database is locked`

**Solution**:
```bash
# Remove lock files
rm data/*.db-wal
rm data/*.db-shm

# Restart the application
npm run dev
```

#### WebSocket Connection Failed
**Problem**: `WebSocket connection to 'ws://localhost:8080' failed`

**Solution**:
1. Check if backend is running: `curl http://localhost:8080/api/health`
2. Check firewall settings
3. Ensure `.env` has correct URLs:
   ```env
   VITE_API_URL=http://localhost:8080
   VITE_WS_URL=ws://localhost:8080
   ```

### Terminal Issues

#### Terminal Not Connecting
**Problem**: Terminal shows "Connecting..." indefinitely

**Solution**:
1. Check Claude CLI is installed: `claude --version`
2. Restart shell: Click "Restart" button
3. Check console for errors: F12 → Console
4. Verify project path exists

#### Terminal Disconnects Frequently
**Problem**: Terminal connection drops after a few minutes

**Solution**:
1. Check network stability
2. Increase timeout in server settings
3. Disable power saving mode
4. Use `screen` or `tmux` for persistent sessions

#### Commands Not Working
**Problem**: Commands typed in terminal have no effect

**Solution**:
1. Check if shell is connected (green indicator)
2. Try pressing Enter twice
3. Check if bypass mode is needed
4. Restart the shell session

### Chat Issues

#### Claude Not Responding
**Problem**: Messages sent but no response

**Solution**:
1. Check status indicator (top right)
2. Verify Claude CLI is working: `claude --version`
3. Check API limits haven't been exceeded
4. Look for errors in browser console

#### Streaming Not Working
**Problem**: Responses appear all at once instead of streaming

**Solution**:
1. Check WebSocket connection
2. Disable browser extensions
3. Try incognito mode
4. Check proxy settings

#### File Uploads Failing
**Problem**: "Failed to upload file" error

**Solution**:
1. Check file size (<10MB limit)
2. Verify file permissions
3. Check available disk space
4. Try different file format

### Authentication Issues

#### Cannot Login
**Problem**: "Invalid credentials" error

**Solution**:
1. Check caps lock
2. Reset password if forgotten
3. Clear browser cache
4. Try incognito mode

#### Session Expires Too Quickly
**Problem**: Logged out frequently

**Solution**:
1. Check "Remember me" on login
2. Adjust session timeout in `.env`:
   ```env
   SESSION_TIMEOUT=86400000  # 24 hours
   ```
3. Check system time is correct

### Git Integration Issues

#### Git Operations Failing
**Problem**: "Git command failed" errors

**Solution**:
1. Verify Git is installed: `git --version`
2. Check Git credentials are configured
3. Ensure repository is initialized
4. Check file permissions

#### Can't See Git Status
**Problem**: Git panel shows no information

**Solution**:
1. Verify project is a Git repository
2. Check `.git` folder exists
3. Run `git status` in terminal
4. Refresh the page

### Performance Issues

#### Application Running Slowly
**Problem**: UI is laggy or unresponsive

**Solution**:
1. Close unused browser tabs
2. Clear browser cache
3. Disable browser extensions
4. Reduce terminal scrollback:
   ```javascript
   // In Shell.jsx
   scrollback: 1000  // Reduce from 10000
   ```

#### High Memory Usage
**Problem**: Browser using excessive RAM

**Solution**:
1. Limit open files in editor
2. Clear old terminal output
3. Archive old chat sessions
4. Restart the application

#### Build Takes Too Long
**Problem**: `npm run build` is very slow

**Solution**:
1. Exclude large directories in `vite.config.js`
2. Use production builds of dependencies
3. Enable build caching
4. Consider using SSD

### Mobile Issues

#### Can't Click Small Buttons
**Problem**: Buttons too small on mobile

**Solution**:
1. Use landscape orientation
2. Zoom in with pinch gesture
3. Use voice input instead
4. Report specific issues

#### Keyboard Covers Input
**Problem**: Mobile keyboard hides text input

**Solution**:
1. Scroll page when keyboard appears
2. Use external keyboard
3. Rotate to landscape
4. Report the issue

### Vibe Kanban Issues

#### Tasks Not Syncing
**Problem**: Tasks don't appear or update

**Solution**:
1. Check Vibe backend is running (port 8081)
2. Refresh the page
3. Check browser console for errors
4. Verify database permissions

#### Drag and Drop Not Working
**Problem**: Can't drag tasks between columns

**Solution**:
1. Use click-to-move on mobile
2. Check JavaScript errors
3. Try different browser
4. Disable browser extensions

## Debugging Steps

### 1. Check System Status
```bash
# Check all services
npm run health

# Check individual services
curl http://localhost:8080/api/health
curl http://localhost:8081/health
```

### 2. View Logs
```bash
# Server logs
tail -f logs/server.log

# View browser console
# Press F12 → Console tab
```

### 3. Enable Debug Mode
```env
# In .env file
DEBUG=true
LOG_LEVEL=debug
```

### 4. Test Individual Components
```bash
# Test Claude CLI
claude --version
echo "test" | claude

# Test database
sqlite3 data/claude-code.db "SELECT COUNT(*) FROM users;"

# Test Rust backend
cd vibe-kanban/backend
cargo test
```

## Getting Help

If these solutions don't resolve your issue:

1. **Search existing issues**: [GitHub Issues](https://github.com/yourusername/claude-code-ui/issues)
2. **Create detailed bug report** with:
   - Error messages
   - Browser console logs
   - System information
   - Steps to reproduce
3. **Join Discord**: Get real-time help from the community
4. **Check documentation**: Review relevant guides

### Information to Include

When reporting issues, include:

```markdown
**Environment:**
- OS: [e.g., macOS 13.0]
- Node.js: [run `node --version`]
- Rust: [run `rustc --version`]
- Browser: [e.g., Chrome 120]
- Claude CLI: [run `claude --version`]

**Steps to Reproduce:**
1. [First step]
2. [Second step]
3. [etc...]

**Expected Behavior:**
[What should happen]

**Actual Behavior:**
[What actually happens]

**Error Messages:**
[Copy any error messages]

**Screenshots:**
[If applicable]
```

## Prevention Tips

1. **Keep software updated**
   - Run `npm update` regularly
   - Update Claude CLI
   - Update browsers

2. **Monitor resources**
   - Check disk space
   - Monitor RAM usage
   - Watch CPU usage

3. **Regular maintenance**
   - Clear old sessions
   - Archive completed tasks
   - Clean browser cache
   - Backup database

4. **Follow best practices**
   - Use stable versions
   - Test in development first
   - Keep backups
   - Document issues