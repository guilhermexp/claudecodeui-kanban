import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { WebglAddon } from '@xterm/addon-webgl';
import { WebLinksAddon } from '@xterm/addon-web-links';
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
    
    /* Fix for input helper textarea position on mobile */
    @media (max-width: 768px) {
      .xterm .xterm-helper-textarea {
        bottom: 80px !important; /* Move above mobile navigation */
        position: fixed !important;
        z-index: 10;
      }
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

// Global store for shell sessions to persist across tab switches AND project switches
const shellSessions = new Map();

function Shell({ selectedProject, selectedSession, isActive, onConnectionChange, isMobile, resizeTrigger }) {
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
  const [isManualDisconnect, setIsManualDisconnect] = useState(false);
  
  // Image drag & drop states
  const [isDraggedImageOver, setIsDraggedImageOver] = useState(false);
  
  // Heartbeat interval reference
  const heartbeatInterval = useRef(null);
  
  // Reconnection state
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  
  // Track if init command was already sent to prevent duplicates
  const hasInitialized = useRef(false);
  
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
    
    // Reset manual disconnect flag when connecting manually
    setIsManualDisconnect(false);
    
    setIsConnecting(true);
    
    // Start the WebSocket connection
    connectWebSocket();
  };

  // Disconnect from shell function
  const disconnectFromShell = (clearTerminal = true, closeWebSocket = true) => {
    // Mark as manual disconnect to prevent auto-reconnection
    setIsManualDisconnect(true);
    
    if (closeWebSocket && ws.current) {
      ws.current.close(1000, 'User requested disconnect');
      ws.current = null;
    }
    
    // Clear heartbeat interval
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
    
    // Clear reconnection timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    
    // Reset reconnection attempts
    reconnectAttempts.current = 0;
    
    // Clear terminal content only if requested
    if (clearTerminal && terminal.current) {
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

  // Setup dropzone to handle image drops
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
    },
    maxSize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5,
    onDrop: async (files) => {
      if (files.length > 0) {
        try {
          // Process each image file
          for (const file of files) {
            const fileName = file.name;
            
            // Convert to base64 for sending
            const reader = new FileReader();
            reader.onload = () => {
              const imageData = reader.result; // This is already a data URL
              
              if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                // Extract base64 data from data URL
                const base64Data = imageData.split(',')[1];
                
                // First upload the image to server
                ws.current.send(JSON.stringify({
                  type: 'image',
                  data: {
                    filename: fileName,
                    type: file.type,
                    size: file.size,
                    base64: base64Data
                  }
                }));
                
                // Don't show processing message - keep terminal clean
              }
            };
            reader.readAsDataURL(file);
          }
        } catch (error) {
          if (terminal.current) {
            terminal.current.write(`\r\n\x1b[31m✗ Error processing images\x1b[0m\r\n`);
          }
        }
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
      // Helper to print a framed message (liquid-box style) for assistant-bound inputs
      const printFramedMessage = (message) => {
        if (!terminal.current) return;
        const text = String(message || '').replace(/\r?\n/g, ' ').trim();
        if (!text) return;
        const maxCols = Math.max(20, Math.min(terminal.current.cols || 80, 120));
        const content = text.length > maxCols - 4 ? text.slice(0, maxCols - 7) + '…' : text;
        const width = Math.min(maxCols, content.length + 4);
        const horiz = '─'.repeat(Math.max(2, width - 2));
        const pad = ' '.repeat(Math.max(0, width - 4 - content.length));
        const start = `\r\n`;
        const top = `\x1b[38;5;244m┌${horiz}┐\x1b[0m\r\n`;
        const mid = `\x1b[38;5;244m│\x1b[0m \x1b[37m${content}\x1b[0m${pad} \x1b[38;5;244m│\x1b[0m\r\n`;
        const bot = `\x1b[38;5;244m└${horiz}┘\x1b[0m\r\n`;
        terminal.current.write(start + top + mid + bot);
      };

      window.sendToActiveTerminal = (data) => {
        // Don't frame control characters like backspace and escape
        const isControlChar = data.length === 1 && (data.charCodeAt(0) < 32 || data.charCodeAt(0) === 127);
        
        if (!isControlChar) {
          // Visual echo: frame the message the user is sending to the assistant
          printFramedMessage(data);
        }
        
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
    // Reset manual disconnect flag to allow connection
    setIsManualDisconnect(false);
    
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

  // Watch for session changes within the same project
  useEffect(() => {
    const currentSessionId = selectedSession?.id || null;
    
    // Only disconnect when changing sessions WITHIN the same project
    if (lastSessionId !== null && 
        lastSessionId !== currentSessionId && 
        isInitialized && 
        selectedProject) {
      
      // Clear scroll monitoring interval
      if (scrollCheckRef.current) {
        clearInterval(scrollCheckRef.current);
        scrollCheckRef.current = null;
      }
      
      // Disconnect from current shell
      disconnectFromShell();
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
        
        // If WebSocket is still connected, re-attach our event handlers
        if (wsConnected) {
          // Re-establish heartbeat interval
          if (heartbeatInterval.current) {
            clearInterval(heartbeatInterval.current);
          }
          
          heartbeatInterval.current = setInterval(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({ type: 'ping' }));
            }
          }, 30000);
        }
        
        // Reattach to DOM - dispose existing element first if needed
        if (terminal.current.element && terminal.current.element.parentNode) {
          terminal.current.element.parentNode.removeChild(terminal.current.element);
        }
        
        terminal.current.open(terminalRef.current);
        
        // Fit immediately for better responsiveness
        if (fitAddon.current) {
          fitAddon.current.fit();
          // Send terminal size to backend after reattaching
          setTimeout(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN && terminal.current) {
              ws.current.send(JSON.stringify({
                type: 'resize',
                cols: terminal.current.cols,
                rows: terminal.current.rows
              }));
            }
          }, 50);
        }
        
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
      fontSize: isMobile ? 14 : 14,  // Increased mobile font size for better readability
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true, // Required for clipboard addon
      allowTransparency: false,
      convertEol: true,
      scrollback: isMobile ? 3000 : 10000,
      tabStopWidth: 4,
      ...(isMobile && { cols: 80, rows: 20 }), // Reduced rows for mobile to account for navigation bar
      // Enable full color support
      windowsMode: false,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: false,
      // Enhanced theme with full 16-color ANSI support + true colors
      theme: {
        // Basic colors
        background: '#0d0d0d',  // Dark gray background matching bg-card
        foreground: '#f2f2f2',  // White text matching foreground color
        cursor: '#ffffff',
        cursorAccent: '#0d0d0d',
        selection: '#333333',   // Neutral gray selection
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
    const webLinksAddon = new WebLinksAddon();
    
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(clipboardAddon);
    terminal.current.loadAddon(webLinksAddon);
    
    try {
      terminal.current.loadAddon(webglAddon);
    } catch (error) {
    }
    
    terminal.current.open(terminalRef.current);

    // Fit terminal immediately after opening
    requestAnimationFrame(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    });

    // Add keyboard shortcuts for copy/paste
    terminal.current.attachCustomKeyEventHandler((event) => {
      // Allow Tab and Shift+Tab to bubble up for navigation
      if (event.key === 'Tab') {
        return true; // Let the browser handle tab navigation
      }
      
      // Ctrl+C or Cmd+C for copy (when text is selected)
      if ((event.ctrlKey || event.metaKey) && event.key === 'c' && terminal.current.hasSelection()) {
        document.execCommand('copy');
        return false;
      }
      
      // Ctrl+V or Cmd+V for paste
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        event.preventDefault();
        event.stopPropagation();
        
        // First try to read images from clipboard
        navigator.clipboard.read().then(async (items) => {
          let hasImage = false;
          
          for (const item of items) {
            // Check if item contains an image
            const imageTypes = item.types.filter(type => type.startsWith('image/'));
            
            if (imageTypes.length > 0) {
              hasImage = true;
              const blob = await item.getType(imageTypes[0]);
              const fileName = `clipboard_${Date.now()}.${imageTypes[0].split('/')[1]}`;
              
              // Convert blob to base64
              const reader = new FileReader();
              reader.onload = () => {
                if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                  // Send notification about pasted image
                  const command = `echo "Imagem colada: ${fileName}"\n`;
                  
                  ws.current.send(JSON.stringify({
                    type: 'input',
                    data: command
                  }));
                  
                  if (terminal.current) {
                    terminal.current.write(`\r\n\x1b[32m✓ Imagem colada do clipboard: ${fileName}\x1b[0m\r\n`);
                  }
                }
              };
              reader.readAsDataURL(blob);
            }
          }
          
          // If no image found, try to paste text
          if (!hasImage) {
            navigator.clipboard.readText().then(text => {
              if (text && ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                  type: 'input',
                  data: text
                }));
              }
            }).catch(() => {
              // If clipboard API fails, let XTerm handle paste
              if (terminal.current) {
                // Trigger native paste behavior
                const pasteEvent = new Event('paste', { bubbles: true });
                terminal.current.element.dispatchEvent(pasteEvent);
              }
            });
          }
        }).catch(() => {
          // Fallback: try text-only paste, or let XTerm handle it
          navigator.clipboard.readText().then(text => {
            if (text && ws.current && ws.current.readyState === WebSocket.OPEN) {
              ws.current.send(JSON.stringify({
                type: 'input',
                data: text
              }));
            }
          }).catch(() => {
            // Let XTerm's clipboard addon handle the paste
            return true;
          });
        });
        
        return false;
      }
      
      return true;
    });
    
    // Add native paste event listener for better mobile support
    const handlePaste = (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const pastedText = e.clipboardData?.getData('text/plain') || e.clipboardData?.getData('Text');
      if (pastedText && ws.current && ws.current.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'input',
          data: pastedText
        }));
      }
    };
    
    // Store reference to paste handler for cleanup
    const pasteHandler = handlePaste;
    
    // Attach paste listener to terminal element for mobile support
    if (terminal.current.element) {
      terminal.current.element.addEventListener('paste', pasteHandler, { passive: false });
    }
    
    // Ensure terminal takes full space immediately
    requestAnimationFrame(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
        // Send terminal size to backend after fitting
        setTimeout(() => {
          if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'resize',
              cols: terminal.current.cols,
              rows: terminal.current.rows
            }));
          }
        }, 50);
      }
    });
    
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

    // Add resize observer to handle container size changes with debouncing
    let resizeTimeout = null;
    let lastWidth = 0;
    let lastHeight = 0;
    
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      
      const { width, height } = entry.contentRect;
      
      // Only resize if dimensions actually changed (avoid unnecessary resizes)
      if (Math.abs(width - lastWidth) > 1 || Math.abs(height - lastHeight) > 1) {
        lastWidth = width;
        lastHeight = height;
        
        if (fitAddon.current && terminal.current) {
          // Clear any pending resize
          if (resizeTimeout) {
            clearTimeout(resizeTimeout);
          }
          
          // Debounce the resize to avoid too frequent updates
          resizeTimeout = setTimeout(() => {
            if (fitAddon.current && terminal.current) {
              fitAddon.current.fit();
              
              // Send updated terminal size to backend after resize
              if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(JSON.stringify({
                  type: 'resize',
                  cols: terminal.current.cols,
                  rows: terminal.current.rows
                }));
              }
            }
          }, 150); // Slightly increased debounce time
        }
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      // Remove paste event listener
      if (terminal.current && terminal.current.element) {
        terminal.current.element.removeEventListener('paste', pasteHandler);
      }
      
      // Clear intervals on unmount
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      
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

    // Fit terminal immediately when tab becomes active
    if (fitAddon.current) {
      fitAddon.current.fit();
      
      // Notify backend after a short delay
      setTimeout(() => {
        if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'resize',
            cols: terminal.current.cols,
            rows: terminal.current.rows
          }));
        }
      }, 50);
    }
  }, [isActive, isInitialized]);

  // Handle window resize events and container resize for immediate responsiveness
  useEffect(() => {
    if (!isInitialized || !fitAddon.current || !terminalRef.current) return;

    let resizeDebounceTimer = null;
    
    const handleResize = () => {
      // Immediate visual update
      if (fitAddon.current && terminal.current) {
        // Force terminal to recalculate size
        requestAnimationFrame(() => {
          fitAddon.current.fit();
          
          // Debounce backend notification
          if (resizeDebounceTimer) {
            clearTimeout(resizeDebounceTimer);
          }
          
          resizeDebounceTimer = setTimeout(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN && terminal.current) {
              ws.current.send(JSON.stringify({
                type: 'resize',
                cols: terminal.current.cols,
                rows: terminal.current.rows
              }));
            }
          }, 100);
        });
      }
    };

    // Use ResizeObserver to detect container size changes (e.g., when Tasks panel opens/closes)
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    
    // Observe the terminal container
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Also listen for window resize
    window.addEventListener('resize', handleResize);
    
    // Also listen for orientation change on mobile
    window.addEventListener('orientationchange', handleResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (resizeDebounceTimer) {
        clearTimeout(resizeDebounceTimer);
      }
    };
  }, [isInitialized]);

  // Trigger resize when Tasks panel opens/closes
  useEffect(() => {
    if (!isInitialized || !fitAddon.current || !terminal.current) return;
    
    // Add a longer delay to allow smooth animation and avoid message accumulation
    const resizeTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        if (fitAddon.current && terminal.current) {
          // Store current scroll position
          const scrollback = terminal.current.buffer.active.viewportY;
          
          fitAddon.current.fit();
          
          // Restore scroll position after fit
          if (scrollback > 0) {
            terminal.current.scrollToLine(scrollback);
          }
          
          // Notify backend of new size
          setTimeout(() => {
            if (ws.current && ws.current.readyState === WebSocket.OPEN && terminal.current) {
              ws.current.send(JSON.stringify({
                type: 'resize',
                cols: terminal.current.cols,
                rows: terminal.current.rows
              }));
            }
          }, 100);
        }
      });
    }, 400); // Increased delay to match animation duration
    
    return () => clearTimeout(resizeTimer);
  }, [resizeTrigger, isInitialized]);

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
      
      // Reset initialization flag before creating new connection
      hasInitialized.current = false;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        
        // Reset reconnection attempts on successful connection
        reconnectAttempts.current = 0;
        
        // Start heartbeat to keep connection alive
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        
        heartbeatInterval.current = setInterval(() => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Send ping every 30 seconds
        
        // Wait for terminal to be ready, then fit and send dimensions
        setTimeout(() => {
          if (fitAddon.current && terminal.current) {
            // Force a fit to ensure proper dimensions
            fitAddon.current.fit();
            
            // Wait a bit more for fit to complete, then send dimensions
            setTimeout(() => {
              // Only send init if not already initialized for this connection
              if (!hasInitialized.current) {
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
                hasInitialized.current = true;
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
            
            // Sanitize output to prevent xterm parsing errors
            try {
              // Filter out malformed ANSI sequences and non-printable characters
              const sanitizedOutput = output
                .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control chars except \n, \r, \t
                .replace(/\x1b\[[0-9;]*[^m]/g, '') // Remove incomplete ANSI sequences
                .replace(/\x1b\[[\?0-9;]*[hlJ]/g, ''); // Remove problematic sequences
              
              terminal.current.write(sanitizedOutput);
            } catch (error) {
              console.warn('Terminal write error:', error);
              // Fallback: write safe version
              terminal.current.write(output.replace(/[\x00-\x1F\x7F]/g, ''));
            }
          } else if (data.type === 'image-uploaded') {
            // Handle successful image upload
            const { path, fileName } = data;
            
            // Insert the image path into the current terminal input line
            if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
              // Write the path and add a space for user convenience
              const pathToInsert = `${path} `;
              
              // Write to terminal and send to backend as a single input
              terminal.current.write(pathToInsert);
              ws.current.send(JSON.stringify({
                type: 'input',
                data: pathToInsert
              }));
            }
          } else if (data.type === 'image-upload-error') {
            // Suppress error echo in terminal to keep UX clean
          } else if (data.type === 'url_open') {
            // Handle explicit URL opening requests from server
            window.open(data.url, '_blank');
          } else if (data.type === 'pong') {
            // Server responded to our ping - connection is alive
          }
        } catch (error) {
        }
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        
        // Reset initialization flag for next connection
        hasInitialized.current = false;
        
        // Clear heartbeat interval
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
        
        // Hide scroll to bottom button when disconnected
        setShowScrollToBottom(false);
        
        // Check if it was an unexpected disconnect (not user-initiated)
        const wasUnexpected = event.code !== 1000 && event.code !== 1001;
        
        // Don't reconnect if it was a manual disconnect
        if (!isManualDisconnect && wasUnexpected && reconnectAttempts.current < maxReconnectAttempts) {
          // Show reconnection message in terminal
          if (terminal.current) {
            terminal.current.write('\r\n\x1b[33mConnection lost. Attempting to reconnect...\x1b[0m\r\n');
          }
          
          // Attempt to reconnect after a delay
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current - 1), 10000); // Exponential backoff, max 10s
          
          reconnectTimeout.current = setTimeout(() => {
            if (!isConnected && !isConnecting) {
              connectWebSocket();
            }
          }, delay);
        } else if (!wasUnexpected) {
          // User-initiated disconnect - clear terminal
          if (terminal.current) {
            terminal.current.clear();
            terminal.current.write('\x1b[2J\x1b[H'); // Clear screen and move cursor to home
          }
        } else {
          // Max reconnection attempts reached
          if (terminal.current) {
            terminal.current.write('\r\n\x1b[31mConnection lost. Please reconnect manually.\x1b[0m\r\n');
          }
        }
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
        <div className="text-center text-muted-foreground">
          <div className="w-16 h-16 mx-auto mb-4 bg-muted rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div className="h-full min-h-0 flex flex-col bg-card rounded-xl border border-border w-full" {...getRootProps({onClick: e => e.stopPropagation()})}>
      <input {...getInputProps()} />
      {/* Status Bar (aligned with Files header) */}
      <div className="flex-shrink-0 border-b border-border px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 flex-1 min-w-0">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            {selectedSession && (
              <span className="text-xs text-blue-300 truncate">
                ({selectedSession.summary.slice(0, isMobile ? 20 : 30)}...)
              </span>
            )}
            {!selectedSession && (
              <span className="text-xs text-muted-foreground hidden xs:inline">(New Session)</span>
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
                  : 'bg-muted text-muted-foreground hover:bg-accent'
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
              className="p-1 sm:px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
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
      <div className="flex-1 min-h-0 p-2 md:p-3 pb-2 md:pb-3 overflow-hidden relative">
        <div ref={terminalRef} className="h-full w-full focus:outline-none" style={{ outline: 'none' }} />
        
        {/* Drag overlay for images */}
        {(isDragActive || isDraggedImageOver) && (
          <div className="absolute inset-0 bg-blue-500/20 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center z-50 pointer-events-none">
            <div className="bg-white dark:bg-card rounded-lg p-4 shadow-lg pointer-events-none">
              <svg className="w-8 h-8 text-blue-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-1">Solte as imagens aqui</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Imagens serão enviadas para o chat do Claude
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
                Ou pressione ⌘V para colar da área de transferência
              </p>
            </div>
          </div>
        )}
        
        {/* Loading state */}
        {!isInitialized && (
          <div className="absolute inset-0 flex items-center justify-center bg-card bg-opacity-90">
            <div className="text-white text-sm sm:text-base">Loading terminal...</div>
          </div>
        )}
        
        {/* Connect button when not connected */}
        {isInitialized && !isConnected && !isConnecting && (
          <div className="absolute inset-0 flex items-center justify-center bg-card bg-opacity-90 p-3 sm:p-4">
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
              <p className="text-muted-foreground text-xs sm:text-sm mt-2 sm:mt-3 px-2 break-words">
                {selectedSession ? (
                  <>Resume session: {selectedSession.summary.slice(0, isMobile ? 30 : 50)}...</>
                ) : (
                  'Start a new Claude session'
                )}
              </p>
              <p className="text-muted-foreground text-xs mt-1 px-2 text-center">
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
          <div className="absolute inset-0 flex items-center justify-center bg-card bg-opacity-90 p-3 sm:p-4">
            <div className="text-center max-w-sm w-full">
              <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-yellow-400">
                <div className="w-5 h-5 sm:w-6 sm:h-6 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent"></div>
                <span className="text-sm sm:text-base font-medium">Connecting...</span>
              </div>
              <p className="text-muted-foreground text-xs sm:text-sm mt-2 sm:mt-3 px-2 break-words">
                Starting Claude CLI in {selectedProject.displayName || selectedProject.name}
              </p>
            </div>
          </div>
        )}

        {/* Scroll to Bottom Button */}
        {showScrollToBottom && isConnected && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-4 left-4 z-10 bg-muted hover:bg-accent text-white rounded-full p-3 shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 border border-border"
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