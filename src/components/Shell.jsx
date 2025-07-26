import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import 'xterm/css/xterm.css';
import { MicButton } from './MicButton';

// CSS to remove xterm focus outline and scrollbar
const xtermStyles = `
  .xterm .xterm-screen {
    outline: none !important;
  }
  .xterm:focus .xterm-screen {
    outline: none !important;
  }
  .xterm-screen:focus {
    outline: none !important;
  }
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
  /* Make xterm background transparent */
  .xterm {
    background-color: transparent !important;
  }
  .xterm .xterm-viewport {
    background-color: transparent !important;
  }
  .xterm .xterm-screen {
    background-color: transparent !important;
  }
  .xterm .xterm-screen canvas {
    background-color: transparent !important;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.type = 'text/css';
  styleSheet.innerText = xtermStyles;
  document.head.appendChild(styleSheet);
}

// Global store for shell sessions to persist across tab switches
const shellSessions = new Map();
const sessionTimeouts = new Map();

// Store all active terminals for tab display
const activeTerminals = new Map();

// Helper to clear session after timeout
const clearSessionAfterTimeout = (sessionKey) => {
  // Clear any existing timeout
  if (sessionTimeouts.has(sessionKey)) {
    clearTimeout(sessionTimeouts.get(sessionKey));
  }
  
  // Set new 10-minute timeout
  const timeoutId = setTimeout(() => {
    const session = shellSessions.get(sessionKey);
    if (session) {
      // Disconnect WebSocket
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.close();
      }
      // Dispose terminal
      if (session.terminal) {
        session.terminal.dispose();
      }
      // Clean up
      shellSessions.delete(sessionKey);
      sessionTimeouts.delete(sessionKey);
      console.log(`Shell session ${sessionKey} closed after 10 minutes of inactivity`);
    }
  }, 10 * 60 * 1000); // 10 minutes
  
  sessionTimeouts.set(sessionKey, timeoutId);
};

// Helper to cancel timeout when returning to session
const cancelSessionTimeout = (sessionKey) => {
  if (sessionTimeouts.has(sessionKey)) {
    clearTimeout(sessionTimeouts.get(sessionKey));
    sessionTimeouts.delete(sessionKey);
  }
};

function Shell({ selectedProject, selectedSession, isActive, onSessionCountChange, onTerminalsChange, onActiveTerminalChange }) {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [lastSessionId, setLastSessionId] = useState(null);
  const [lastProjectName, setLastProjectName] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBypassingPermissions, setIsBypassingPermissions] = useState(false);
  const bypassRef = useRef(false);
  const isSwitchingContext = useRef(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const dragCounter = useRef(0);
  const [isMobile, setIsMobile] = useState(false);
  const [allTerminals, setAllTerminals] = useState([]);
  const [activeTerminalKey, setActiveTerminalKey] = useState(null);
  const statusCheckInterval = useRef(null);

  // Keep bypassRef in sync with state
  useEffect(() => {
    bypassRef.current = isBypassingPermissions;
  }, [isBypassingPermissions]);

  // Update all terminals list whenever shellSessions changes
  const updateTerminalsList = () => {
    const terminals = [];
    shellSessions.forEach((session, key) => {
      if (session.terminal && !session.terminal.disposed) {
        // Check real WebSocket state
        const wsConnected = session.ws && session.ws.readyState === WebSocket.OPEN;
        // Only show tabs for connected terminals
        if (wsConnected) {
          terminals.push({
            key,
            projectName: key,
            projectDisplayName: session.projectDisplayName || 'Project',
            sessionId: key.includes(':') && !key.includes('project-') ? key.split(':')[1] : null,
            sessionSummary: session.sessionSummary || 'New Session',
            isConnected: wsConnected
          });
        }
      }
    });
    setAllTerminals(terminals);
  };
  
  // Handle tab switching
  const switchToTerminal = (terminalKey) => {
    const session = shellSessions.get(terminalKey);
    if (session && session.terminal && !session.terminal.disposed) {
      // Store current terminal state if different
      if (terminal.current && activeTerminalKey && activeTerminalKey !== terminalKey) {
        // Save terminal buffer content
        let bufferContent = '';
        if (terminal.current && terminal.current.buffer && terminal.current.buffer.active) {
          const buffer = terminal.current.buffer.active;
          for (let i = 0; i < buffer.length; i++) {
            const line = buffer.getLine(i);
            if (line) {
              bufferContent += line.translateToString(true) + '\n';
            }
          }
        }
        
        shellSessions.set(activeTerminalKey, {
          terminal: terminal.current,
          fitAddon: fitAddon.current,
          ws: ws.current,
          isConnected,
          isBypassingPermissions,
          sessionSummary: selectedSession?.summary || 'New Session',
          projectDisplayName: selectedProject?.displayName || selectedProject?.name || 'Project',
          bufferContent: bufferContent.trim()
        });
      }
      
      // Switch to new terminal
      terminal.current = session.terminal;
      fitAddon.current = session.fitAddon;
      ws.current = session.ws;
      
      // Check if WebSocket is really connected
      const wsConnected = session.ws && session.ws.readyState === WebSocket.OPEN;
      setIsConnected(wsConnected);
      setIsBypassingPermissions(session.isBypassingPermissions || false);
      setActiveTerminalKey(terminalKey);
      
      // Reattach to DOM
      if (terminalRef.current && terminal.current.element) {
        terminalRef.current.innerHTML = '';
        terminal.current.open(terminalRef.current);
        
        // Restore buffer content if available
        if (session.bufferContent) {
          terminal.current.write(session.bufferContent);
        }
        
        setTimeout(() => {
          if (fitAddon.current) {
            fitAddon.current.fit();
          }
        }, 100);
      }
    }
  };

  // Update session count and terminals list whenever they change
  useEffect(() => {
    if (onSessionCountChange) {
      onSessionCountChange(allTerminals.length);
    }
    if (onTerminalsChange) {
      onTerminalsChange(allTerminals);
    }
  }, [allTerminals, onSessionCountChange, onTerminalsChange]);
  
  // Update active terminal whenever it changes
  useEffect(() => {
    if (onActiveTerminalChange) {
      onActiveTerminalChange(activeTerminalKey);
    }
  }, [activeTerminalKey, onActiveTerminalChange]);

  // Detect mobile device
  useEffect(() => {
    const checkMobile = () => {
      // Check for mobile devices based on screen width and touch capability
      const isMobileDevice = window.innerWidth <= 768 && 
                            ('ontouchstart' in window || navigator.maxTouchPoints > 0);
      setIsMobile(isMobileDevice);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Periodically check WebSocket status of all terminals
  useEffect(() => {
    // Check status every 2 seconds
    statusCheckInterval.current = setInterval(() => {
      updateTerminalsList();
    }, 2000);

    return () => {
      if (statusCheckInterval.current) {
        clearInterval(statusCheckInterval.current);
      }
    };
  }, []);

  // Connect to shell function
  const connectToShell = () => {
    if (!isInitialized || isConnected || isConnecting) return;
    
    setIsConnecting(true);
    
    // Start the WebSocket connection
    connectWebSocket();
  };

  // Disconnect from shell function
  const disconnectFromShell = () => {
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    // Clear terminal content completely
    if (terminal.current) {
      terminal.current.clear();
      terminal.current.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to home
    }
    
    setIsConnected(false);
    setIsConnecting(false);
  };

  // Restart shell function
  const restartShell = () => {
    setIsRestarting(true);
    
    // Clear ALL session storage for this project to force fresh start
    const sessionKeys = Array.from(shellSessions.keys()).filter(key => 
      key.includes(selectedProject.name)
    );
    sessionKeys.forEach(key => shellSessions.delete(key));
    
    
    // Close existing WebSocket
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    // Clear and dispose existing terminal
    if (terminal.current) {
      
      // Dispose terminal immediately without writing text
      terminal.current.dispose();
      terminal.current = null;
      fitAddon.current = null;
    }
    
    // Reset states
    setIsConnected(false);
    setIsInitialized(false);
    
    
    // Force re-initialization after cleanup
    setTimeout(() => {
      setIsRestarting(false);
    }, 200);
  };

  // Watch for session/project changes and switch between shells
  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;
    const currentProjectName = selectedProject?.name || null;
    
    // Check if session or project changed
    const sessionChanged = currentSessionId !== lastSessionId;
    const projectChanged = currentProjectName !== lastProjectName;
    
    // Check if user clicked "New Session" (was a session, now null)
    const isNewSession = lastSessionId !== null && currentSessionId === null && currentProjectName === lastProjectName;
    
    if ((sessionChanged || projectChanged) && (lastSessionId !== null || lastProjectName !== null)) {
      // Store current shell state before switching (if connected)
      if (isConnected && terminal.current) {
        const oldKey = activeTerminalKey || lastSessionId || `project-${lastProjectName}`;
        // Cancel any existing timeout for this session
        cancelSessionTimeout(oldKey);
        
        // Check if WebSocket is really connected before storing
        const wsConnected = ws.current && ws.current.readyState === WebSocket.OPEN;
        
        // Save terminal buffer content
        let bufferContent = '';
        if (terminal.current && terminal.current.buffer && terminal.current.buffer.active) {
          const buffer = terminal.current.buffer.active;
          for (let i = 0; i < buffer.length; i++) {
            const line = buffer.getLine(i);
            if (line) {
              bufferContent += line.translateToString(true) + '\n';
            }
          }
        }
        
        shellSessions.set(oldKey, {
          terminal: terminal.current,
          fitAddon: fitAddon.current,
          ws: ws.current,
          isConnected: wsConnected,
          isBypassingPermissions: isBypassingPermissions,
          sessionSummary: lastSessionId ? selectedSession?.summary : 'New Session',
          projectDisplayName: selectedProject?.displayName || selectedProject?.name || 'Project',
          bufferContent: bufferContent.trim()
        });
        
        // Restart the 10-minute timeout
        clearSessionAfterTimeout(oldKey);
        
        console.log('📦 Stored shell session:', oldKey);
        
        // Update terminals list
        updateTerminalsList();
      }
      
      // Create key for new context - add unique ID for new sessions
      const newKey = currentSessionId || `project-${currentProjectName}-${Date.now()}`;
      setActiveTerminalKey(newKey);
      
      // If it's a new session, remove any existing terminal for this project
      if (isNewSession) {
        console.log('🆕 New session requested, clearing existing terminal');
        const projectKey = `project-${currentProjectName}`;
        const existingSession = shellSessions.get(projectKey);
        if (existingSession) {
          // Close and dispose existing terminal
          if (existingSession.ws && existingSession.ws.readyState === WebSocket.OPEN) {
            existingSession.ws.close();
          }
          if (existingSession.terminal && !existingSession.terminal.disposed) {
            existingSession.terminal.dispose();
          }
          shellSessions.delete(projectKey);
          cancelSessionTimeout(projectKey);
          updateTerminalsList();
        }
      }
      
      // Mark that we're switching context
      isSwitchingContext.current = true;
      
      // Reset local refs to prepare for new/existing session
      terminal.current = null;
      fitAddon.current = null;
      ws.current = null;
      
      // Force re-initialization which will check for existing session
      setIsInitialized(false);
      setIsConnected(false); // Reset connection state when switching
      
      console.log('🔄 Switching to context:', newKey);
      
      // Reset switching flag after a moment
      setTimeout(() => {
        isSwitchingContext.current = false;
      }, 100);
    }
    
    setLastSessionId(currentSessionId);
    setLastProjectName(currentProjectName);
  }, [selectedSession?.id, selectedProject?.name, lastSessionId, lastProjectName, isConnected, isBypassingPermissions]);


  // Initialize terminal when component mounts
  useEffect(() => {
    console.log('🎨 Terminal init useEffect called');
    console.log('   terminalRef.current:', !!terminalRef.current);
    console.log('   selectedProject:', !!selectedProject);
    console.log('   isRestarting:', isRestarting);
    
    if (!terminalRef.current || !selectedProject || isRestarting) {
      console.log('❌ Skipping terminal init - preconditions not met');
      return;
    }

    // Create session key for this project/session combination
    const sessionKey = selectedSession?.id || `project-${selectedProject.name}`;
    
    // Check if we have an existing session
    const existingSession = shellSessions.get(sessionKey);
    if (existingSession && !terminal.current) {
      
      try {
        // Cancel timeout since we're back to this session
        cancelSessionTimeout(sessionKey);
        
        // Reuse existing terminal
        terminal.current = existingSession.terminal;
        fitAddon.current = existingSession.fitAddon;
        ws.current = existingSession.ws;
        
        // Check if WebSocket is really connected
        const wsConnected = existingSession.ws && existingSession.ws.readyState === WebSocket.OPEN;
        setIsConnected(wsConnected);
        setIsBypassingPermissions(existingSession.isBypassingPermissions || false);
        
        // Reattach to DOM - dispose existing element first if needed
        if (terminal.current.element && terminal.current.element.parentNode) {
          terminal.current.element.parentNode.removeChild(terminal.current.element);
        }
        
        terminal.current.open(terminalRef.current);
        
        // Restore buffer content if available
        if (existingSession.bufferContent) {
          terminal.current.write(existingSession.bufferContent);
        }
        
        setTimeout(() => {
          if (fitAddon.current) {
            fitAddon.current.fit();
            // Send terminal size to backend after reattaching
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({
                type: 'resize',
                cols: terminal.current.cols,
                rows: terminal.current.rows
              }));
            }
          }
        }, 100);
        
        setIsInitialized(true);
        return;
      } catch (error) {
        // Clear the broken session and continue to create a new one
        shellSessions.delete(sessionKey);
        terminal.current = null;
        fitAddon.current = null;
        ws.current = null;
      }
    }

    if (terminal.current) {
      return;
    }


    // Initialize new terminal
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true, // Required for clipboard addon
      allowTransparency: true,  // Enable transparency
      convertEol: true,
      scrollback: 10000,
      tabStopWidth: 4,
      // Enable full color support
      windowsMode: false,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: false,
      // Enhanced theme with full 16-color ANSI support + true colors
      theme: {
        // Basic colors
        background: 'rgba(30, 30, 30, 0.85)',  // Translucent background
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: 'rgba(30, 30, 30, 0.85)',
        selection: 'rgba(38, 79, 120, 0.7)',
        selectionForeground: '#ffffff',
        
        // Standard ANSI colors (0-7)
        black: '#000000',
        red: '#cd3131',
        green: '#0dbc79',
        yellow: '#e5e510',
        blue: '#2472c8',
        magenta: '#bc3fbc',
        cyan: '#11a8cd',
        white: '#e5e5e5',
        
        // Bright ANSI colors (8-15)
        brightBlack: '#666666',
        brightRed: '#f14c4c',
        brightGreen: '#23d18b',
        brightYellow: '#f5f543',
        brightBlue: '#3b8eea',
        brightMagenta: '#d670d6',
        brightCyan: '#29b8db',
        brightWhite: '#ffffff',
        
        // Extended colors for better Claude output
        extendedAnsi: [
          // 16-color palette extension for 256-color support
          '#000000', '#800000', '#008000', '#808000',
          '#000080', '#800080', '#008080', '#c0c0c0',
          '#808080', '#ff0000', '#00ff00', '#ffff00',
          '#0000ff', '#ff00ff', '#00ffff', '#ffffff'
        ]
      }
    });

    fitAddon.current = new FitAddon();
    const clipboardAddon = new ClipboardAddon();
    
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(clipboardAddon);
    
    // Note: WebGL addon disabled to allow transparency
    
    terminal.current.open(terminalRef.current);

    // Wait for terminal to be fully rendered, then fit
    // Use multiple attempts to ensure proper rendering
    let fitAttempts = 0;
    const tryFit = () => {
      if (fitAddon.current && terminalRef.current && terminalRef.current.offsetHeight > 0) {
        fitAddon.current.fit();
        // Write a prompt if terminal is empty
        if (terminal.current.buffer.active.length === 0) {
          terminal.current.write('\r\n$ ');
        }
      } else if (fitAttempts < 10) {
        fitAttempts++;
        setTimeout(tryFit, 100);
      }
    };
    setTimeout(tryFit, 50);

    // Add keyboard shortcuts for copy/paste
    terminal.current.attachCustomKeyEventHandler((event) => {
      // Ctrl+C or Cmd+C for copy (when text is selected)
      if ((event.ctrlKey || event.metaKey) && event.key === 'c' && terminal.current.hasSelection()) {
        document.execCommand('copy');
        return false;
      }
      
      // Ctrl+V or Cmd+V for paste
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        navigator.clipboard.readText().then(text => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'input',
              data: text,
              bypassPermissions: bypassRef.current
            }));
          }
        }).catch(err => {
          // Failed to read clipboard
        });
        return false;
      }
      
      return true;
    });
    
    // Ensure terminal takes full space and notify backend of size
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
        // Send terminal size to backend after fitting
        if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'resize',
            cols: terminal.current.cols,
            rows: terminal.current.rows
          }));
        }
      }
    }, 100);
    
    setIsInitialized(true);
    
    // For new terminals, ensure we start disconnected
    setIsConnected(false);
    
    // Update active terminal key
    const currentKey = selectedSession?.id || `project-${selectedProject?.name}`;
    setActiveTerminalKey(currentKey);
    
    // Don't update terminals list here - only when connected
    // This prevents creating tabs before user authorizes connection

    // Handle terminal input
    terminal.current.onData((data) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'input',
          data: data,
          bypassPermissions: bypassRef.current
        }));
      }
    });

    // Add resize observer to handle container size changes
    const resizeObserver = new ResizeObserver(() => {
      if (fitAddon.current && terminal.current) {
        setTimeout(() => {
          fitAddon.current.fit();
          // Send updated terminal size to backend after resize
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'resize',
              cols: terminal.current.cols,
              rows: terminal.current.rows
            }));
          }
        }, 50);
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      
      // Store session for reuse instead of disposing - but only if connected
      if (terminal.current && selectedProject) {
        const sessionKey = selectedSession?.id || `project-${selectedProject.name}`;
        
        try {
          // Check if WebSocket is really connected before storing
          const wsConnected = ws.current && ws.current.readyState === WebSocket.OPEN;
          
          // Only store if actually connected
          if (wsConnected) {
            // Save terminal buffer content
            let bufferContent = '';
            if (terminal.current && terminal.current.buffer && terminal.current.buffer.active) {
              const buffer = terminal.current.buffer.active;
              for (let i = 0; i < buffer.length; i++) {
                const line = buffer.getLine(i);
                if (line) {
                  bufferContent += line.translateToString(true) + '\n';
                }
              }
            }
            
            shellSessions.set(sessionKey, {
              terminal: terminal.current,
              fitAddon: fitAddon.current,
              ws: ws.current,
              isConnected: wsConnected,
              isBypassingPermissions: isBypassingPermissions,
              sessionSummary: selectedSession?.summary || 'New Session',
              projectDisplayName: selectedProject?.displayName || selectedProject?.name || 'Project',
              bufferContent: bufferContent.trim()
            });
            
            // Start timeout to clean up after 10 minutes
            clearSessionAfterTimeout(sessionKey);
          }
          
        } catch (error) {
          console.error('Error storing shell session:', error);
        }
      }
    };
  }, [terminalRef.current, selectedProject, selectedSession, isRestarting]);

  // Fit terminal when tab becomes active
  useEffect(() => {
    if (!isActive || !isInitialized) return;

    // Fit terminal when tab becomes active and notify backend
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
        // Send terminal size to backend after tab activation
        if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'resize',
            cols: terminal.current.cols,
            rows: terminal.current.rows
          }));
        }
      }
    }, 100);
  }, [isActive, isInitialized]);

  // Handle drag and drop
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDraggingOver(true);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    
    if (dragCounter.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounter.current = 0;

    // Only process drop if terminal is connected
    if (!isConnected || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('Terminal not connected. Cannot process dropped files.');
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      
      // Build the full command with file paths
      const filePaths = files.map(file => {
        // In Electron, file.path contains the full path
        // In browser, we only have file.name
        const fullPath = file.path || file.name;
        
        // Escape spaces and special characters in path
        if (fullPath.includes(' ') || fullPath.includes('(') || fullPath.includes(')')) {
          return `"${fullPath}"`;
        }
        return fullPath;
      });
      
      // Send all paths at once, separated by spaces
      const pathsToInsert = filePaths.join(' ');
      
      ws.current.send(JSON.stringify({
        type: 'input',
        data: pathsToInsert,
        bypassPermissions: bypassRef.current
      }));
    }
  };

  // Handle voice transcription
  const handleVoiceTranscript = (text) => {
    if (!isConnected || !ws.current || ws.current.readyState !== WebSocket.OPEN) {
      console.warn('Terminal not connected. Cannot send voice input.');
      return;
    }

    // Send the transcribed text to the terminal
    ws.current.send(JSON.stringify({
      type: 'input',
      data: text,
      bypassPermissions: bypassRef.current
    }));
  };

  // WebSocket connection function (called manually)
  const connectWebSocket = async () => {
    if (isConnecting || isConnected) return;
    
    try {
      // Get authentication token
      const token = localStorage.getItem('auth-token');
      if (!token) {
        console.error('No authentication token found for Shell WebSocket connection');
        return;
      }
      
      // Fetch server configuration to get the correct WebSocket URL
      let wsBaseUrl;
      try {
        const configResponse = await fetch('/api/config', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const config = await configResponse.json();
        wsBaseUrl = config.wsUrl;
        
        // If the config returns localhost but we're not on localhost, use current host but with API server port
        if (wsBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          // For development, API server is typically on port 3002 when Vite is on 3001
          const apiPort = window.location.port === '3001' ? '3002' : window.location.port;
          wsBaseUrl = `${protocol}//${window.location.hostname}:${apiPort}`;
        }
      } catch (error) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // For development, API server is typically on port 3002 when Vite is on 3001
        const apiPort = window.location.port === '3001' ? '3002' : window.location.port;
        wsBaseUrl = `${protocol}//${window.location.hostname}:${apiPort}`;
      }
      
      // Include token in WebSocket URL as query parameter
      const wsUrl = `${wsBaseUrl}/shell?token=${encodeURIComponent(token)}`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        
        // Add current session to shellSessions when connected
        const sessionKey = selectedSession?.id || activeTerminalKey || `project-${selectedProject.name}`;
        shellSessions.set(sessionKey, {
          terminal: terminal.current,
          fitAddon: fitAddon.current,
          ws: ws.current,
          isConnected: true,
          isBypassingPermissions: bypassRef.current,
          sessionSummary: selectedSession?.summary || 'New Session',
          projectDisplayName: selectedProject?.displayName || selectedProject?.name || 'Project',
          bufferContent: '' // New session, no buffer yet
        });
        
        // Update terminals list to reflect connected state
        updateTerminalsList();
        
        // Wait for terminal to be ready, then fit and send dimensions
        setTimeout(() => {
          if (fitAddon.current && terminal.current) {
            // Force a fit to ensure proper dimensions
            fitAddon.current.fit();
            
            // Wait a bit more for fit to complete, then send dimensions
            setTimeout(() => {
              const initPayload = {
                type: 'init',
                projectPath: selectedProject.fullPath || selectedProject.path,
                sessionId: selectedSession?.id || activeTerminalKey,
                hasSession: !!selectedSession,
                cols: terminal.current.cols,
                rows: terminal.current.rows,
                bypassPermissions: bypassRef.current
              };
              
              ws.current.send(JSON.stringify(initPayload));
              
              // Send bypass state immediately after init if enabled
              if (isBypassingPermissions) {
                setTimeout(() => {
                  if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                    ws.current.send(JSON.stringify({
                      type: 'bypassPermissions',
                      enabled: true
                    }));
                  }
                }, 50);
              }
              
              // Also send resize message immediately after init
              setTimeout(() => {
                if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
                  ws.current.send(JSON.stringify({
                    type: 'resize',
                    cols: terminal.current.cols,
                    rows: terminal.current.rows
                  }));
                }
              }, 100);
            }, 50);
          }
        }, 200);
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'output') {
            // Check for URLs in the output and make them clickable
            const urlRegex = /(https?:\/\/[^\s\x1b\x07]+)/g;
            let output = data.data;
            
            // Find URLs in the text (excluding ANSI escape sequences)
            const urls = [];
            let match;
            while ((match = urlRegex.exec(output.replace(/\x1b\[[0-9;]*m/g, ''))) !== null) {
              urls.push(match[1]);
            }
            
            // If URLs found, log them for potential opening
            
            if (terminal.current && !terminal.current.disposed) {
              terminal.current.write(output);
            } else {
              console.error('Terminal not available for writing');
            }
          } else if (data.type === 'url_open') {
            // Handle explicit URL opening requests from server
            window.open(data.url, '_blank');
          }
        } catch (error) {
          console.error('Error processing shell message:', error);
        }
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        
        // Clear terminal content when connection closes
        if (terminal.current) {
          terminal.current.clear();
          terminal.current.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to home
        }
        
        // Update terminals list to reflect disconnected state
        updateTerminalsList();
        
        // Don't auto-reconnect anymore - user must manually connect
      };

      ws.current.onerror = (error) => {
        setIsConnected(false);
        setIsConnecting(false);
      };
    } catch (error) {
      setIsConnected(false);
      setIsConnecting(false);
    }
  };


  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Select a Project</h3>
          <p>Choose a project to open an interactive shell in that directory</p>
        </div>
      </div>
    );
  }

  // Set up global functions for terminal control
  useEffect(() => {
    window.switchToShellTerminal = switchToTerminal;
    window.closeShellTerminal = (terminalKey) => {
      const session = shellSessions.get(terminalKey);
      if (session) {
        // Close WebSocket
        if (session.ws && session.ws.readyState === WebSocket.OPEN) {
          session.ws.close();
        }
        // Dispose terminal
        if (session.terminal && !session.terminal.disposed) {
          session.terminal.dispose();
        }
        // Remove from maps
        shellSessions.delete(terminalKey);
        cancelSessionTimeout(terminalKey);
        
        // If this was the active terminal, switch to another
        if (terminalKey === activeTerminalKey) {
          const remainingTerminals = allTerminals.filter(t => t.key !== terminalKey);
          if (remainingTerminals.length > 0) {
            switchToTerminal(remainingTerminals[0].key);
          } else {
            setActiveTerminalKey(null);
            terminal.current = null;
            fitAddon.current = null;
            ws.current = null;
            setIsConnected(false);
          }
        }
        
        updateTerminalsList();
      }
    };
    
    return () => {
      delete window.switchToShellTerminal;
      delete window.closeShellTerminal;
    };
  }, [activeTerminalKey, allTerminals]);

  return (
    <div className="h-full flex flex-col bg-gray-900 w-full">
      
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {selectedSession && (
              <span className="text-xs text-blue-300">
                ({selectedSession.summary.slice(0, 25)}...)
              </span>
            )}
            {!selectedSession && (
              <span className="text-xs text-gray-400">(New Session)</span>
            )}
            {!isInitialized && (
              <span className="text-xs text-yellow-400">(Initializing...)</span>
            )}
            {isRestarting && (
              <span className="text-xs text-blue-400">(Restarting...)</span>
            )}
          </div>
          <div className="flex items-center space-x-3">
            {isConnected && (
              <>
                <button
                  onClick={() => {
                    const newBypassState = !isBypassingPermissions;
                    setIsBypassingPermissions(newBypassState);
                    
                    // Send bypass state change to backend
                    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                      ws.current.send(JSON.stringify({
                        type: 'bypassPermissions',
                        enabled: newBypassState
                      }));
                    }
                  }}
                  className={`px-3 py-1 text-xs rounded flex items-center space-x-1 transition-all duration-200 ${
                    isBypassingPermissions 
                      ? 'bg-orange-600 text-white hover:bg-orange-700' 
                      : 'bg-gray-600 text-white hover:bg-gray-700'
                  }`}
                  title={isBypassingPermissions ? "Disable permission bypass" : "Enable permission bypass"}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isBypassingPermissions ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    )}
                  </svg>
                  <span>{isBypassingPermissions ? 'Bypass ON' : 'Bypass OFF'}</span>
                </button>
                <button
                  onClick={disconnectFromShell}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-1"
                  title="Disconnect from shell"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Disconnect</span>
                </button>
              </>
            )}
            
            <button
              onClick={restartShell}
              disabled={isRestarting}
              className="text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              title="Restart Shell"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Restart</span>
            </button>
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div 
        className="flex-1 p-2 overflow-hidden relative bg-gray-900/95"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />
        
        {/* Drag and drop overlay */}
        {isDraggingOver && (
          <div className="absolute inset-0 z-50 pointer-events-none">
            <div className={`h-full w-full border-4 border-dashed rounded-lg flex items-center justify-center backdrop-blur-sm ${
              isConnected 
                ? 'border-green-500 bg-green-500/20' 
                : 'border-red-500 bg-red-500/20'
            }`}>
              <div className="bg-gray-800/95 rounded-xl p-6 text-center shadow-2xl">
                <div className={`w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center ${
                  isConnected ? 'bg-green-500/20' : 'bg-red-500/20'
                }`}>
                  <svg className={`w-12 h-12 ${isConnected ? 'text-green-500' : 'text-red-500'}`} fill="currentColor" viewBox="0 0 24 24">
                    {isConnected ? (
                      <path d="M3 7h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM6 10v2h2v-2H6zm0 4v2h2v-2H6zm4-4v2h2v-2h-2zm0 4v2h2v-2h-2zm4-4v2h2v-2h-2zm0 4v2h2v-2h-2z"/>
                    ) : (
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    )}
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  {isConnected ? 'Drop files here' : 'Terminal not connected'}
                </h3>
                <p className="text-sm text-gray-400">
                  {isConnected 
                    ? 'Files will be uploaded and the path sent to terminal' 
                    : 'Connect to terminal first to drop files'}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Or press <kbd className="px-2 py-1 bg-gray-700 rounded text-gray-300">⌘V</kbd> to paste from clipboard
                </p>
              </div>
            </div>
          </div>
        )}
        
        {/* Loading state */}
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90">
            <div className="text-white">Loading terminal...</div>
          </div>
        )}
        
        {/* Connect button when not connected */}
        {isInitialized && !isConnected && !isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4">
            <div className="text-center max-w-md w-full">
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    // Ensure bypass is OFF for normal connection
                    setIsBypassingPermissions(false);
                    bypassRef.current = false;
                    connectToShell();
                  }}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-sm"
                  title="Connect to shell"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span>Continue in Shell</span>
                </button>
                <button
                  onClick={() => {
                    setIsBypassingPermissions(true);
                    // Force bypassRef to be updated immediately
                    bypassRef.current = true;
                    // Wait a tick for state to update
                    setTimeout(() => {
                      connectToShell();
                    }, 0);
                  }}
                  className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors flex items-center justify-center space-x-2 text-sm"
                  title="Connect to shell with bypass permissions"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span>Continue with Bypass</span>
                </button>
              </div>
              <p className="text-gray-400 text-sm mt-3 px-2">
                {selectedSession ? 
                  `Resume session: ${selectedSession.summary.slice(0, 30)}...` : 
                  'Start a new Claude session'
                }
              </p>
            </div>
          </div>
        )}
        
        {/* Connecting state */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-4">
            <div className="text-center max-w-sm w-full">
              <div className="flex items-center justify-center space-x-3 text-yellow-400">
                <div className="w-6 h-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent"></div>
                <span className="text-base font-medium">Connecting to shell...</span>
              </div>
              <p className="text-gray-400 text-sm mt-3 px-2">
                Starting Claude CLI in {selectedProject.displayName}
              </p>
            </div>
          </div>
        )}
        
        {/* Mobile voice button - only show when connected and on mobile */}
        {isMobile && isConnected && (
          <div className="fixed bottom-20 right-4 z-50" style={{ position: 'fixed' }}>
            <div className="relative">
              <MicButton 
                onTranscript={handleVoiceTranscript}
                className="shadow-2xl scale-110"
              />
              <div className="absolute -top-14 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-2 rounded-lg whitespace-nowrap opacity-0 pointer-events-none animate-pulse">
                Tap to speak
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Shell;