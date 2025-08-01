import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { WebglAddon } from '@xterm/addon-webgl';
import { useDropzone } from 'react-dropzone';
import 'xterm/css/xterm.css';

// CSS to make xterm responsive and remove focus outline
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
  
  /* Make terminal responsive */
  .xterm {
    width: 100% !important;
    height: 100% !important;
  }
  
  .xterm .xterm-viewport {
    width: 100% !important;
    overflow-x: auto !important;
  }
  
  .xterm .xterm-screen {
    width: 100% !important;
  }
  
  /* Mobile optimizations */
  @media (max-width: 640px) {
    .xterm {
      font-size: 11px !important;
    }
    
    .xterm .xterm-viewport {
      -webkit-overflow-scrolling: touch;
    }
    
    .xterm .xterm-screen {
      min-width: 100% !important;
    }
  }
  
  /* Prevent text from overflowing */
  .xterm .xterm-rows {
    word-wrap: break-word;
    word-break: break-all;
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

function Shell({ selectedProject, selectedSession, isActive, onConnectionChange, isMobile }) {
  const terminalRef = useRef(null);
  const terminal = useRef(null);
  const fitAddon = useRef(null);
  const ws = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  const [lastSessionId, setLastSessionId] = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isBypassingPermissions, setIsBypassingPermissions] = useState(false);
  
  // Image drag & drop states
  const [isDraggedImageOver, setIsDraggedImageOver] = useState(false);
  
  // Scroll to bottom functionality
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const scrollCheckRef = useRef(null);
  
  // Notify parent about connection status changes
  useEffect(() => {
    if (onConnectionChange) {
      onConnectionChange(isConnected);
    }
  }, [isConnected, onConnectionChange]);

  // Scroll to bottom function
  const scrollToBottom = useCallback(() => {
    if (terminal.current) {
      terminal.current.scrollToBottom();
      setShowScrollToBottom(false);
    }
  }, []);

  // Check if user is at bottom of terminal
  const checkScrollPosition = useCallback(() => {
    if (!terminal.current) return;
    
    try {
      const viewport = terminal.current.element?.querySelector('.xterm-viewport');
      if (!viewport) return;
      
      const scrollTop = viewport.scrollTop;
      const scrollHeight = viewport.scrollHeight;
      const clientHeight = viewport.clientHeight;
      
      // Show button if user is not near the bottom (within 100px)
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
      setShowScrollToBottom(!isNearBottom && scrollHeight > clientHeight);
    } catch (error) {
      // Ignore errors, terminal might not be ready
    }
  }, []);

  // Set up scroll position monitoring
  useEffect(() => {
    if (!isConnected || !terminal.current) return;
    
    const viewport = terminal.current.element?.querySelector('.xterm-viewport');
    if (!viewport) return;
    
    // Check scroll position periodically and on scroll events
    const checkPosition = () => {
      checkScrollPosition();
    };
    
    viewport.addEventListener('scroll', checkPosition);
    
    // Also check periodically in case content changes
    scrollCheckRef.current = setInterval(checkPosition, 1000);
    
    return () => {
      viewport.removeEventListener('scroll', checkPosition);
      if (scrollCheckRef.current) {
        clearInterval(scrollCheckRef.current);
        scrollCheckRef.current = null;
      }
    };
  }, [isConnected, checkScrollPosition]);

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
    setShowScrollToBottom(false);
  };

  // Toggle bypass permissions
  const toggleBypassPermissions = () => {
    setIsBypassingPermissions(!isBypassingPermissions);
    
    // Send message to server if connected
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify({
        type: 'bypassPermissions',
        enabled: !isBypassingPermissions
      }));
    }
  };

  // Setup dropzone to redirect images to chat
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5,
    onDrop: (files) => {
      // Call ChatInterface's handleImageFiles directly
      if (window.addImagesToChatInterface) {
        window.addImagesToChatInterface(files);
      } else {
        console.warn('Chat interface not ready for image handling');
      }
    },
    noClick: true,
    noKeyboard: true,
    noDragEventsBubbling: true,
    onDragEnter: () => setIsDraggedImageOver(true),
    onDragLeave: () => setIsDraggedImageOver(false),
    onDropAccepted: () => setIsDraggedImageOver(false),
    onDropRejected: () => setIsDraggedImageOver(false)
  });

  // Set up global function for MicButton to send to terminal
  useEffect(() => {
    if (isActive && isConnected) {
      window.sendToActiveTerminal = (data) => {
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'input',
            data: data
          }));
        }
      };
    }
    
    return () => {
      // Clean up when component unmounts or becomes inactive
      if (window.sendToActiveTerminal && isActive) {
        delete window.sendToActiveTerminal;
      }
    };
  }, [isActive, isConnected]);

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
    setShowScrollToBottom(false);
    
    
    // Force re-initialization after cleanup
    setTimeout(() => {
      setIsRestarting(false);
    }, 200);
  };

  // Watch for session changes and restart shell
  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;
    
    
    // Disconnect when session changes (user will need to manually reconnect)
    if (lastSessionId !== null && lastSessionId !== currentSessionId && isInitialized) {
      
      // Clear scroll monitoring interval
      if (scrollCheckRef.current) {
        clearInterval(scrollCheckRef.current);
        scrollCheckRef.current = null;
      }
      
      // Disconnect from current shell
      disconnectFromShell();
      
      // Clear stored sessions for this project
      const allKeys = Array.from(shellSessions.keys());
      allKeys.forEach(key => {
        if (key.includes(selectedProject.name)) {
          shellSessions.delete(key);
        }
      });
    }
    
    setLastSessionId(currentSessionId);
  }, [selectedSession?.id, isInitialized]);

  // Initialize terminal when component mounts
  useEffect(() => {
    
    if (!terminalRef.current || !selectedProject || isRestarting) {
      return;
    }

    // Create session key for this project/session combination
    const sessionKey = selectedSession?.id || `project-${selectedProject.name}`;
    
    // Check if we have an existing session
    const existingSession = shellSessions.get(sessionKey);
    if (existingSession && !terminal.current) {
      
      try {
        // Reuse existing terminal
        terminal.current = existingSession.terminal;
        fitAddon.current = existingSession.fitAddon;
        ws.current = existingSession.ws;
        
        // Check if websocket is still connected
        const wsConnected = existingSession.ws && existingSession.ws.readyState === WebSocket.OPEN;
        setIsConnected(wsConnected);
        
        // Reattach to DOM - dispose existing element first if needed
        if (terminal.current.element && terminal.current.element.parentNode) {
          terminal.current.element.parentNode.removeChild(terminal.current.element);
        }
        
        terminal.current.open(terminalRef.current);
        
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


    // Initialize new terminal with responsive settings
    terminal.current = new Terminal({
      cursorBlink: true,
      fontSize: isMobile ? 11 : 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true, // Required for clipboard addon
      allowTransparency: false,
      convertEol: true,
      scrollback: isMobile ? 3000 : 10000,
      tabStopWidth: 4,
      ...(isMobile && { cols: 80, rows: 24 }), // Only set cols/rows for mobile to prevent horizontal scroll
      // Enable full color support
      windowsMode: false,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: false,
      // Enhanced theme with full 16-color ANSI support + true colors
      theme: {
        // Basic colors
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        cursor: '#ffffff',
        cursorAccent: '#1e1e1e',
        selection: '#264f78',
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
    const webglAddon = new WebglAddon();
    
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(clipboardAddon);
    
    try {
      terminal.current.loadAddon(webglAddon);
    } catch (error) {
    }
    
    terminal.current.open(terminalRef.current);

    // Wait for terminal to be fully rendered, then fit
    setTimeout(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    }, 50);

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
              data: text
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

    // Handle terminal input
    terminal.current.onData((data) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'input',
          data: data
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
      
      // Store session for reuse instead of disposing
      if (terminal.current && selectedProject) {
        const sessionKey = selectedSession?.id || `project-${selectedProject.name}`;
        
        try {
          shellSessions.set(sessionKey, {
            terminal: terminal.current,
            fitAddon: fitAddon.current,
            ws: ws.current,
            isConnected: ws.current && ws.current.readyState === WebSocket.OPEN
          });
          
        } catch (error) {
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
                sessionId: selectedSession?.id,
                hasSession: !!selectedSession,
                cols: terminal.current.cols,
                rows: terminal.current.rows,
                bypassPermissions: isBypassingPermissions
              };
              
              ws.current.send(JSON.stringify(initPayload));
              
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
            
            terminal.current.write(output);
          } else if (data.type === 'url_open') {
            // Handle explicit URL opening requests from server
            window.open(data.url, '_blank');
          }
        } catch (error) {
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
        
        // Hide scroll to bottom button when disconnected
        setShowScrollToBottom(false);
        
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

  return (
    <div className="h-full flex flex-col bg-gray-900 w-full" {...getRootProps({onClick: e => e.stopPropagation()})}>
      <input {...getInputProps()} />
      {/* Header */}
      <div className="flex-shrink-0 bg-gray-800 border-b border-gray-700 px-2 sm:px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {selectedSession && (
              <span className="text-xs text-blue-300 truncate">
                ({selectedSession.summary.slice(0, isMobile ? 20 : 30)}...)
              </span>
            )}
            {!selectedSession && (
              <span className="text-xs text-gray-400 hidden xs:inline">(New Session)</span>
            )}
            {!isInitialized && (
              <span className="text-xs text-yellow-400">
                {isMobile ? 'Init...' : '(Initializing...)'}
              </span>
            )}
            {isRestarting && (
              <span className="text-xs text-blue-400">
                {isMobile ? 'Restart...' : '(Restarting...)'}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2">
            
            {/* Bypass Permissions Toggle */}
            <button
              onClick={toggleBypassPermissions}
              className={`px-1.5 sm:px-3 py-1 text-xs rounded flex items-center space-x-1 transition-colors ${
                isBypassingPermissions 
                  ? 'bg-yellow-600 text-white hover:bg-yellow-700' 
                  : 'bg-gray-600 text-gray-300 hover:bg-gray-700'
              }`}
              title={isBypassingPermissions ? "Disable bypass permissions" : "Enable bypass permissions"}
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d={isBypassingPermissions 
                    ? "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" 
                    : "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  } 
                />
              </svg>
              <span className="hidden sm:inline whitespace-nowrap">
                {isBypassingPermissions ? 'Bypass ON' : 'Bypass OFF'}
              </span>
            </button>
            
            {isConnected && (
              <button
                onClick={disconnectFromShell}
                className="px-1.5 sm:px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 flex items-center space-x-1"
                title="Disconnect from shell"
              >
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="hidden sm:inline">Disconnect</span>
              </button>
            )}
            
            <button
              onClick={restartShell}
              disabled={isRestarting || isConnected}
              className="p-1 sm:px-2 text-xs text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              title="Restart Shell (disconnect first)"
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden sm:inline">Restart</span>
            </button>
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div className="flex-1 p-1 sm:p-2 overflow-hidden relative">
        <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />
        
        {/* Drag overlay for images */}
        {(isDragActive || isDraggedImageOver) && (
          <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-lg pointer-events-none">
              <svg className="w-8 h-8 text-blue-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Solte as imagens aqui</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Imagens serão adicionadas ao chat do Claude
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
                Ou pressione ⌘V para colar da área de transferência
              </p>
            </div>
          </div>
        )}
        
        {/* Loading state */}
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90">
            <div className="text-white text-sm sm:text-base">Loading terminal...</div>
          </div>
        )}
        
        {/* Connect button when not connected */}
        {isInitialized && !isConnected && !isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-3 sm:p-4">
            <div className="text-center max-w-sm w-full">
              <button
                onClick={connectToShell}
                className="px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-2 text-sm sm:text-base font-medium w-full"
                title="Connect to shell"
              >
                <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Continue in Shell</span>
              </button>
              <p className="text-gray-400 text-xs sm:text-sm mt-2 sm:mt-3 px-2 break-words">
                {selectedSession ? (
                  <>Resume session: {selectedSession.summary.slice(0, isMobile ? 30 : 50)}...</>
                ) : (
                  'Start a new Claude session'
                )}
              </p>
              <p className="text-gray-500 text-xs mt-1 px-2 text-center">
                Arraste imagens ou pressione ⌘V para adicionar ao chat
              </p>
              {isBypassingPermissions && (
                <p className="text-yellow-400 text-xs mt-2 px-2 flex items-center justify-center space-x-1 flex-wrap">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                  </svg>
                  <span className="text-center">Bypass permissions enabled</span>
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Connecting state */}
        {isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-90 p-3 sm:p-4">
            <div className="text-center max-w-sm w-full">
              <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-yellow-400">
                <div className="w-5 h-5 sm:w-6 sm:h-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent"></div>
                <span className="text-sm sm:text-base font-medium">Connecting...</span>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm mt-2 sm:mt-3 px-2 break-words">
                Starting Claude CLI in {selectedProject.displayName || selectedProject.name}
              </p>
            </div>
          </div>
        )}

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && isConnected && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 right-4 z-10 bg-gray-700 hover:bg-gray-600 text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 border border-gray-600"
            title="Scroll to bottom"
            aria-label="Scroll to bottom"
          >
            <svg 
              className="w-5 h-5" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M19 14l-7 7m0 0l-7-7m7 7V3" 
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default Shell;