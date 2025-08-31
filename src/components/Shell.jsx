import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { useDropzone } from 'react-dropzone';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import PreviewPanel from './PreviewPanel';
import CtaButton from './ui/CtaButton';
import { useConfig } from './vibe-kanban/config-provider';
import { detectBestPreviewUrl } from '../utils/detectPreviewUrl';
import 'xterm/css/xterm.css';

// CSS to make xterm responsive and remove focus outline
  const xtermStyles = `
  .xterm .xterm-screen {
    outline: none !important;
  }
  .xterm:focus .xterm-screen {
    outline: none !important;
  }
  /* Control cursor blink rate and remove any transitions */
  .xterm .xterm-cursor-layer {
    transition: none !important;
    animation: none !important;
  }
  .xterm-cursor-block {
    transition: none !important;
  }
  /* Remove any animations from terminal content */
  .xterm * {
    transition: none !important;
    animation: none !important;
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
      -webkit-overflow-scrolling: touch !important;
      overflow-y: auto !important;
      touch-action: pan-y !important;
    }
    
    .xterm .xterm-screen {
      min-width: 100% !important;
      touch-action: pan-y !important;
    }
    
    /* Enable smooth scrolling on mobile */
    .xterm .xterm-viewport .xterm-scroll-area {
      touch-action: pan-y !important;
    }
    
    /* Optimized mobile input - remove layout interference */
    @media (max-width: 768px) {
      .xterm .xterm-helper-textarea {
        position: absolute !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    }
  }
  
  /* Mobile scroll optimization */
  @media (max-width: 768px) {
    .xterm {
      overscroll-behavior: contain;
    }
    
    .xterm .xterm-viewport {
      scroll-behavior: smooth;
      overscroll-behavior-y: contain;
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

function Shell({ selectedProject, selectedSession, isActive, onConnectionChange, onSessionStateChange, isMobile, resizeTrigger, onSidebarClose, activeSidePanel, onPreviewStateChange }) {
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
  
  // Command history state
  const commandHistory = useRef([]);
  const commandHistoryIndex = useRef(-1);
  const currentCommand = useRef('');
  
  // Search state
  const searchAddon = useRef(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef(null);
  
  // Preview panel states
  const [showPreview, setShowPreview] = useState(false);
  const [initialPreviewPaused, setInitialPreviewPaused] = useState(true); // Start paused by default
  // Resizable Panels handles (imperative) to control sizes when toggling preview
  const terminalPanelHandleRef = useRef(null);
  const previewPanelHandleRef = useRef(null);
  // Terminal width lock when opening side panels
  const terminalPanelRef = useRef(null);
  const [lockedTerminalWidth, setLockedTerminalWidth] = useState(null);
  const [wasPreviewOpen, setWasPreviewOpen] = useState(false);
  
  // Notify parent when preview state changes
  useEffect(() => {
    if (onPreviewStateChange) {
      onPreviewStateChange(showPreview);
    }
    // Track preview having been opened to preserve terminal width lock
    setWasPreviewOpen(prev => prev || showPreview);
  }, [showPreview, onPreviewStateChange]);

  // Lock current terminal width when a side panel opens (so shell doesn't shift)
  useEffect(() => {
    if (activeSidePanel && (showPreview || wasPreviewOpen)) {
      const el = terminalPanelRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect && rect.width) setLockedTerminalWidth(Math.round(rect.width));
      }
    } else if (!activeSidePanel) {
      setLockedTerminalWidth(null);
    }
  }, [activeSidePanel, showPreview, wasPreviewOpen]);

  // Ensure preview opens at 70% and terminal at 30% when toggled
  useEffect(() => {
    if (isMobile) return;
    try {
      if (showPreview) {
        if (previewPanelHandleRef.current && previewPanelHandleRef.current.resize) {
          previewPanelHandleRef.current.resize(70);
        }
        if (terminalPanelHandleRef.current && terminalPanelHandleRef.current.resize) {
          terminalPanelHandleRef.current.resize(30);
        }
      } else {
        if (terminalPanelHandleRef.current && terminalPanelHandleRef.current.resize) {
          terminalPanelHandleRef.current.resize(100);
        }
        if (previewPanelHandleRef.current && previewPanelHandleRef.current.resize) {
          previewPanelHandleRef.current.resize(0);
        }
      }
    } catch (e) {
      // Non-fatal: fall back to library defaults if imperative resize fails
    }
  }, [showPreview, isMobile]);
  const [previewUrl, setPreviewUrl] = useState('');
  // (Removed global publish of preview URL; assistant now lives inside preview again)
  const [detectedUrls, setDetectedUrls] = useState(new Set());
  
  // Image drag & drop states
  const [isDraggedImageOver, setIsDraggedImageOver] = useState(false);
  
  // Terminal theme state
  const [terminalTheme, setTerminalTheme] = useState('dark');
  
  // Config for sound notifications (same as Vibe Kanban)
  const configContext = useConfig();
  const config = configContext?.config;
  
  // Sound notification function (same as SettingsModal)
  const playCompletionSound = async () => {
    if (config?.sound_alerts && config?.sound_file) {
      const audio = new Audio(`/api/sounds/${config.sound_file}.wav`);
      try {
        await audio.play();
      } catch (err) {
        console.error('Failed to play completion sound:', err);
      }
    }
  };
  
  // Heartbeat interval reference
  const heartbeatInterval = useRef(null);
  
  // Reconnection state
  const reconnectTimeout = useRef(null);
  const reconnectAttempts = useRef(0);
  const lastProjectPath = useRef(null); // Store the last project path to maintain during reconnection
  
  // Session activity tracking for protection system
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const activityTimeout = useRef(null);
  const lastActivityTime = useRef(null);
  const maxReconnectAttempts = 5;
  
  // Scroll position persistence
  const [savedScrollPosition, setSavedScrollPosition] = useState(null);
  
  // Track if init command was already sent to prevent duplicates
  const hasInitialized = useRef(false);
  
  // Session activity tracking functions
  const markSessionActive = () => {
    lastActivityTime.current = Date.now();
    if (!hasActiveSession) {
      setHasActiveSession(true);
      if (onSessionStateChange) {
        onSessionStateChange(true);
      }
    }
    
    // Clear existing timeout and set new one (30 seconds of inactivity)
    if (activityTimeout.current) {
      clearTimeout(activityTimeout.current);
    }
    
    activityTimeout.current = setTimeout(() => {
      setHasActiveSession(false);
      if (onSessionStateChange) {
        onSessionStateChange(false);
      }
    }, 30000); // 30 seconds of inactivity
  };
  
  const markSessionInactive = () => {
    if (activityTimeout.current) {
      clearTimeout(activityTimeout.current);
      activityTimeout.current = null;
    }
    setHasActiveSession(false);
    if (onSessionStateChange) {
      onSessionStateChange(false);
    }
  };
  
  // URL detection and preview helpers
  const isLocalhostUrl = (url) => {
    try {
      const urlObj = new URL(url);
      const validHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
      return validHosts.includes(urlObj.hostname);
    } catch {
      return false;
    }
  };
  
  // Preview navigation functions (exposed to global for MainContent)
  useEffect(() => {
    window.previewGoBack = () => {
      // Implement go back functionality
    };
    
    window.previewGoForward = () => {
      // Implement go forward functionality
    };
    
    window.previewRefresh = () => {
      // Trigger refresh on PreviewPanel if it exists
      if (window.refreshPreview) {
        window.refreshPreview();
      }
    };
    // Allow other components to close the preview explicitly
    window.closePreview = () => {
      setShowPreview(false);
      setPreviewUrl('');
    };
    
    return () => {
      delete window.previewGoBack;
      delete window.previewGoForward;
      delete window.previewRefresh;
      delete window.closePreview;
    };
  }, []);

  const handlePreviewUrl = (url) => {
    // Prevent preview from opening on mobile devices
    if (isMobile) {
      return;
    }
    
    setPreviewUrl(url);
    setShowPreview(true);
    detectUrlsInTerminal();
    // Close sidebar when preview opens to maximize space
    if (onSidebarClose) {
      onSidebarClose();
    }
  };

  const detectUrlsInTerminal = () => {
    if (!terminal.current) return new Set();
    
    const urls = new Set();
    const patterns = [
      /https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d+)/gi,
      /Server.*?running.*?on.*?(https?:\/\/[^\s]+)/gi,
      /Listening.*?on.*?(https?:\/\/[^\s]+)/gi,
      /Available.*?at.*?(https?:\/\/[^\s]+)/gi
    ];
    
    // Get terminal buffer content
    const buffer = terminal.current.buffer.active;
    for (let i = 0; i < buffer.length; i++) {
      const line = buffer.getLine(i);
      if (line) {
        const text = line.translateToString();
        patterns.forEach(pattern => {
          let match;
          while ((match = pattern.exec(text)) !== null) {
            const url = match[1] || match[0];
            if (isLocalhostUrl(url)) {
              urls.add(url);
            }
          }
        });
      }
    }
    
    setDetectedUrls(urls);
    return urls;
  };
  
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
    
    // Also check periodically in case content changes - increased interval for better performance
    scrollCheckRef.current = setInterval(checkPosition, 2000);
    
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
    
    // Clear stored session info on manual disconnect
    setLastSessionId(null);
    lastProjectPath.current = null;
    
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
  
  // Change terminal theme
  const cycleTerminalTheme = () => {
    // Cycle through themes: dark -> light -> gray -> dark
    const themeOrder = ['dark', 'light', 'gray'];
    const currentIndex = themeOrder.indexOf(terminalTheme);
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    const nextTheme = themeOrder[nextIndex];
    
    setTerminalTheme(nextTheme);
    
    // Update terminal theme if it exists
    if (terminal.current) {
      const themes = {
        dark: {
          background: '#000000',
          foreground: '#f2f2f2',
          cursor: '#ffffff',
          cursorAccent: '#000000',
          selection: '#333333',
          selectionForeground: '#ffffff',
        },
        light: {
          background: '#ffffff',
          foreground: '#333333',
          cursor: '#333333',
          cursorAccent: '#ffffff',
          selection: '#b4d5fe',
          selectionForeground: '#000000',
        },
        gray: {
          background: '#2d2d2d',
          foreground: '#cccccc',
          cursor: '#ffffff',
          cursorAccent: '#2d2d2d',
          selection: '#515151',
          selectionForeground: '#ffffff',
        }
      };
      
      // Update terminal theme
      terminal.current.options.theme = {
        ...terminal.current.options.theme,
        ...themes[nextTheme]
      };
    }
    
    // Save preference to localStorage
    localStorage.setItem('terminal-theme', nextTheme);
  };
  
  // Load saved theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem('terminal-theme');
    if (savedTheme && ['dark', 'light', 'gray'].includes(savedTheme)) {
      setTerminalTheme(savedTheme);
    }
  }, []);
  

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
        
        // On mobile, ensure terminal has focus before sending input
        // This prevents the issue where text creates new input lines
        if (isMobile && terminal.current && !isControlChar) {
          terminal.current.focus();
          // Small delay to ensure focus is properly set
          setTimeout(() => {
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
          }, 50);
        } else {
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

  // Save and restore scroll position when switching tabs
  useEffect(() => {
    if (!terminal.current) return;

    if (!isActive && terminal.current) {
      // Save current scroll position when leaving Shell tab
      const viewport = terminal.current.element?.querySelector('.xterm-viewport');
      if (viewport) {
        const scrollPosition = {
          scrollTop: viewport.scrollTop,
          viewportY: terminal.current.buffer.active.viewportY
        };
        setSavedScrollPosition(scrollPosition);
      }
    } else if (savedScrollPosition && isActive && terminal.current) {
      // Restore scroll position when returning to Shell tab
      const restorePosition = () => {
        if (terminal.current) {
          // Try using terminal's scroll method first
          if (savedScrollPosition.viewportY > 0) {
            terminal.current.scrollToLine(savedScrollPosition.viewportY);
          }
          
          // Also try viewport scrollTop as fallback
          const viewport = terminal.current.element?.querySelector('.xterm-viewport');
          if (viewport && savedScrollPosition.scrollTop > 0) {
            viewport.scrollTop = savedScrollPosition.scrollTop;
          }
        }
      };
      
      // Use requestAnimationFrame to ensure DOM is ready
      requestAnimationFrame(() => {
        setTimeout(restorePosition, 50); // Small delay to ensure terminal is fully rendered
      });
    }
  }, [isActive, savedScrollPosition]);

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

  // Cleanup WebSocket when component unmounts
  useEffect(() => {
    return () => {
      // Clean up WebSocket connection on unmount
      if (ws.current) {
        ws.current.close(1000, 'Component unmounting');
        ws.current = null;
      }
      
      // Clear heartbeat interval
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
        heartbeatInterval.current = null;
      }
      
      // Clear scroll check interval
      if (scrollCheckRef.current) {
        clearInterval(scrollCheckRef.current);
        scrollCheckRef.current = null;
      }
      
      // Clear any reconnection timeout
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    };
  }, []); // Empty dependency array - only runs on mount/unmount

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
        
        // Reattach to DOM only if not already attached to the current ref
        if (terminal.current.element && terminal.current.element.parentNode !== terminalRef.current) {
          // Remove from old parent if exists
          if (terminal.current.element.parentNode) {
            terminal.current.element.parentNode.removeChild(terminal.current.element);
          }
          terminal.current.open(terminalRef.current);
        } else if (!terminal.current.element) {
          // Terminal doesn't have an element yet, open it
          terminal.current.open(terminalRef.current);
        }
        
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


    // Terminal theme configurations
    const themes = {
      dark: {
        background: '#000000',
        foreground: '#f2f2f2',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selection: '#333333',
        selectionForeground: '#ffffff',
      },
      light: {
        background: '#ffffff',
        foreground: '#333333',
        cursor: '#333333',
        cursorAccent: '#ffffff',
        selection: '#b4d5fe',
        selectionForeground: '#000000',
      },
      gray: {
        background: '#2d2d2d',
        foreground: '#cccccc',
        cursor: '#ffffff',
        cursorAccent: '#2d2d2d',
        selection: '#515151',
        selectionForeground: '#ffffff',
      }
    };
    
    // Initialize new terminal with responsive settings and performance optimizations
    terminal.current = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block', // Use block cursor for better visibility
      cursorWidth: 1,
      fontSize: isMobile ? 15 : 16,  // Increased font size for better readability
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true, // Required for clipboard addon
      allowTransparency: false,
      convertEol: true,
      scrollback: isMobile ? 500 : 2000, // Further reduced for better input performance
      tabStopWidth: 4,
      fastScrollModifier: 'alt', // Optimize scrolling
      scrollSensitivity: isMobile ? 3 : 1, // Increased scroll sensitivity on mobile
      ...(isMobile && { cols: 80, rows: 20 }), // Reduced rows for mobile to account for navigation bar
      // Enable full color support
      windowsMode: false,
      macOptionIsMeta: true,
      macOptionClickForcesSelection: false,
      // Mobile-specific optimizations
      ...(isMobile && {
        smoothScrollDuration: 0, // Disable smooth scroll animation on mobile for better performance
        rightClickSelectsWord: false, // Prevent right-click selection issues on mobile
        altClickMovesCursor: false, // Disable alt-click cursor movement on mobile
      }),
      // Enhanced theme with full 16-color ANSI support + true colors
      theme: {
        // Basic colors - use selected theme
        ...themes[terminalTheme],
        
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
    searchAddon.current = new SearchAddon();
    
    // Load addons first (order matters)
    terminal.current.loadAddon(fitAddon.current);
    terminal.current.loadAddon(clipboardAddon);
    terminal.current.loadAddon(searchAddon.current);
    
    // Configure WebLinksAddon with custom handler for localhost URLs
    // Note: WebLinksAddon must be loaded after the terminal is opened
    const webLinksAddon = new WebLinksAddon((event, uri) => {
      // Check if it's a localhost URL
      if (isLocalhostUrl(uri)) {
        event.preventDefault();
        // On mobile, open localhost URLs in new tab instead of preview
        if (isMobile) {
          window.open(uri, '_blank');
        } else {
          handlePreviewUrl(uri);
        }
      } else {
        // Let non-localhost URLs open normally
        window.open(uri, '_blank');
      }
    });
    
    // WebGL addon disabled for better performance on input
    // Uncomment if needed for specific use cases
    // try {
    //   terminal.current.loadAddon(webglAddon);
    // } catch (error) {
    // }
    
    terminal.current.open(terminalRef.current);
    
    // Load WebLinksAddon after terminal is opened
    terminal.current.loadAddon(webLinksAddon);

    // Fit terminal immediately after opening
    requestAnimationFrame(() => {
      if (fitAddon.current) {
        fitAddon.current.fit();
      }
    });
    
    // Remove terminal data listener that was causing unnecessary processing
    // URL detection is already handled when needed

    // Add keyboard shortcuts for copy/paste and command history
    terminal.current.attachCustomKeyEventHandler((event) => {
      // Let Tab and arrow keys pass through to terminal completely
      if (event.key === 'Tab' || 
          event.key === 'ArrowUp' || event.key === 'ArrowDown' || 
          event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        // Return true to let the terminal's native key handling take over
        return true;
      }
      
      
      // Ctrl+F or Cmd+F for search
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault();
        setShowSearch(true);
        // Focus search input after a small delay to ensure it's rendered
        setTimeout(() => {
          if (searchInputRef.current) {
            searchInputRef.current.focus();
          }
        }, 100);
        return false;
      }
      
      // ESC to close search
      if (event.key === 'Escape' && showSearch) {
        setShowSearch(false);
        setSearchQuery('');
        if (searchAddon.current) {
          searchAddon.current.clearDecorations();
        }
        return false;
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

    // Handle terminal input and track commands for history
    let currentLineBuffer = '';
    
    terminal.current.onData((data) => {
      if (ws.current && ws.current.readyState === WebSocket.OPEN) {
        // Track input for command history
        if (data === '\r' || data === '\n') {
          // Enter pressed - save command to history
          if (currentLineBuffer.trim().length > 0) {
            // Add to command history (avoid duplicates of the last command)
            const trimmedCommand = currentLineBuffer.trim();
            if (commandHistory.current.length === 0 || 
                commandHistory.current[commandHistory.current.length - 1] !== trimmedCommand) {
              commandHistory.current.push(trimmedCommand);
              // Keep history size reasonable (max 100 commands)
              if (commandHistory.current.length > 100) {
                commandHistory.current.shift();
              }
            }
            // Reset history navigation index
            commandHistoryIndex.current = -1;
            currentCommand.current = '';
          }
          currentLineBuffer = '';
        } else if (data === '\x7f') {
          // Backspace
          if (currentLineBuffer.length > 0) {
            currentLineBuffer = currentLineBuffer.slice(0, -1);
          }
        } else if (data === '\x15') {
          // Ctrl+U (clear line)
          currentLineBuffer = '';
        } else if (data.charCodeAt(0) >= 32) {
          // Regular character
          currentLineBuffer += data;
        }
        
        // Send input to terminal
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
          }, 100); // Increased debounce for better performance
        }
      }
    });

    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }
    
    // Mobile-specific touch scroll improvements
    if (isMobile && terminal.current && terminal.current.element) {
      const viewport = terminal.current.element.querySelector('.xterm-viewport');
      if (viewport) {
        // Enable better touch scrolling on mobile
        viewport.style.touchAction = 'pan-y';
        viewport.style.overflowY = 'auto';
        viewport.style.webkitOverflowScrolling = 'touch';
        viewport.style.scrollBehavior = 'smooth';
        
        // Prevent default touch behaviors that interfere with scrolling
        viewport.addEventListener('touchstart', (e) => {
          // Allow scrolling but prevent text selection during scroll
          if (e.touches.length === 1) {
            e.stopPropagation();
          }
        }, { passive: true });
        
        viewport.addEventListener('touchmove', (e) => {
          // Allow scrolling
          e.stopPropagation();
        }, { passive: true });
      }
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
      
      // Clear activity timeout
      if (activityTimeout.current) {
        clearTimeout(activityTimeout.current);
        activityTimeout.current = null;
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
    let lastDimensions = { width: 0, height: 0 };
    
    const handleResize = (forceRefresh = false) => {
      // Immediate visual update
      if (fitAddon.current && terminal.current) {
        // Clear any rendering artifacts before resize
        if (forceRefresh && terminal.current.element) {
          const viewport = terminal.current.element.querySelector('.xterm-viewport');
          if (viewport) {
            // Force a reflow to clear rendering artifacts
            viewport.style.display = 'none';
            viewport.offsetHeight; // Trigger reflow
            viewport.style.display = '';
          }
        }
        
        // Force terminal to recalculate size
        requestAnimationFrame(() => {
          try {
            // Fit the terminal to the new dimensions
            fitAddon.current.fit();
            
            // Force a refresh of the terminal renderer
            if (terminal.current.element) {
              terminal.current.refresh(0, terminal.current.rows - 1);
            }
            
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
            }, 50);
          } catch (error) {
            console.error('Error during terminal resize:', error);
          }
        });
      }
    };

    // Use ResizeObserver to detect container size changes (e.g., when Tasks panel opens/closes)
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      
      const { width, height } = entry.contentRect;
      
      // Check if dimensions actually changed significantly
      const widthChanged = Math.abs(width - lastDimensions.width) > 5;
      const heightChanged = Math.abs(height - lastDimensions.height) > 5;
      
      if (widthChanged || heightChanged) {
        lastDimensions = { width, height };
        // Force refresh when dimensions change significantly (panel opened/closed)
        handleResize(true);
      }
    });
    
    // Observe the terminal container
    if (terminalRef.current) {
      resizeObserver.observe(terminalRef.current);
    }

    // Also listen for window resize
    window.addEventListener('resize', () => handleResize(false));
    
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

  // Handle sidebar close to fix rendering artifacts
  useEffect(() => {
    if (!isInitialized || !fitAddon.current || !terminal.current) return;
    
    if (onSidebarClose) {
      // When sidebar closes, force a complete terminal refresh without clearing content
      const cleanupTimer = setTimeout(() => {
        if (terminal.current && fitAddon.current) {
          // Clear the viewport to remove artifacts
          const viewport = terminal.current.element?.querySelector('.xterm-viewport');
          if (viewport) {
            // Force GPU acceleration reset
            viewport.style.transform = 'translateZ(0)';
            void viewport.offsetHeight; // Force reflow
            viewport.style.transform = '';
          }
          
          // Refit and refresh without clearing content
          fitAddon.current.fit();
          terminal.current.refresh(0, terminal.current.rows - 1);
          
          // Update backend with new dimensions
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
              type: 'resize',
              cols: terminal.current.cols,
              rows: terminal.current.rows
            }));
          }
        }
      }, 500);
      
      return () => clearTimeout(cleanupTimer);
    }
  }, [onSidebarClose, isInitialized]);
  
  // Trigger resize when Tasks panel opens/closes
  useEffect(() => {
    if (!isInitialized || !fitAddon.current || !terminal.current) return;
    
    // Add a longer delay to allow smooth animation and avoid message accumulation
    const resizeTimer = setTimeout(() => {
      requestAnimationFrame(() => {
        if (fitAddon.current && terminal.current) {
          // Store current scroll position
          const scrollback = terminal.current.buffer.active.viewportY;
          
          // Clear any rendering artifacts before resize
          if (terminal.current.element) {
            const viewport = terminal.current.element.querySelector('.xterm-viewport');
            const screen = terminal.current.element.querySelector('.xterm-screen');
            
            if (viewport && screen) {
              // Force a reflow to clear rendering artifacts
              viewport.style.opacity = '0.99';
              screen.style.transform = 'translateZ(0)';
              
              // Trigger reflow
              void viewport.offsetHeight;
              
              // Restore after a frame
              requestAnimationFrame(() => {
                viewport.style.opacity = '1';
                screen.style.transform = '';
              });
            }
          }
          
          // Fit terminal to new dimensions
          fitAddon.current.fit();
          
          // Force a complete refresh of the terminal display
          terminal.current.refresh(0, terminal.current.rows - 1);
          
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
        
        // Show reconnection success message if this was a reconnection
        if (lastSessionId && terminal.current) {
          terminal.current.write('\x1b[32m✓ Reconnected successfully. Session context maintained.\x1b[0m\r\n');
        }
        
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
                // Use stored session ID if this is a reconnection, otherwise use current session
                const sessionIdToUse = lastSessionId || selectedSession?.id;
                const projectPathToUse = lastProjectPath.current || selectedProject.fullPath || selectedProject.path;
                
                const initPayload = {
                  type: 'init',
                  projectPath: projectPathToUse,
                  sessionId: sessionIdToUse,
                  hasSession: !!sessionIdToUse,
                  cols: terminal.current.cols,
                  rows: terminal.current.rows,
                  bypassPermissions: isBypassingPermissions,
                  isReconnection: !!lastSessionId // Flag to indicate this is a reconnection
                };
                
                // Store session info for future reconnections
                if (sessionIdToUse) {
                  setLastSessionId(sessionIdToUse);
                }
                if (projectPathToUse) {
                  lastProjectPath.current = projectPathToUse;
                }
                
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
            // Mark session as active when receiving output from Claude
            markSessionActive();
            // Removed URL regex processing here for better performance
            // URLs are already handled by WebLinksAddon
            
            // Write output directly to terminal (preserving ANSI colors)
            terminal.current.write(data.data);
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
          } else if (data.type === 'claude-complete') {
            // Claude finished a task - play completion sound
            playCompletionSound();
          }
        } catch (error) {
        }
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);
        setIsConnecting(false);
        // Mark session as inactive when WebSocket disconnects
        markSessionInactive();
        
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
            const sessionInfo = lastSessionId ? ' (maintaining session context)' : '';
            terminal.current.write(`\r\n\x1b[33mConnection lost. Attempting to reconnect${sessionInfo}...\x1b[0m\r\n`);
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

  // Create getRootProps once to avoid recreation
  const dropzoneProps = getRootProps({onClick: e => e.stopPropagation()});
  const inputProps = getInputProps();
  
  // Create the terminal content once to be reused in both layouts
  const terminalContent = (
    <>
      <div 
        ref={terminalRef} 
        className="h-full w-full focus:outline-none" 
        style={{ outline: 'none' }} 
      />
      
      {/* Drag overlay for images */}
      {(isDragActive || isDraggedImageOver) && (
        <div className="absolute inset-0 bg-primary/20 border-2 border-dashed border-primary rounded-lg flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white dark:bg-card rounded-lg p-4 shadow-lg pointer-events-none">
            <svg className="w-8 h-8 text-primary mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <p className="text-sm font-medium text-primary dark:text-primary mb-1">Solte as imagens aqui</p>
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
        <div className="absolute inset-0 flex items-center justify-center bg-background bg-opacity-90">
          <div className="text-white text-sm sm:text-base">Loading terminal...</div>
        </div>
      )}
      
      {/* Connect button when not connected */}
      {isInitialized && !isConnected && !isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-background bg-opacity-90 p-3 sm:p-4">
          <div className="text-center max-w-sm w-full">
            <CtaButton onClick={connectToShell} className="w-full justify-center">Continue in Shell</CtaButton>
            <p className="text-muted-foreground text-sm sm:text-base mt-3 sm:mt-4 px-2 break-words font-medium">
              {selectedSession ? (
                <>Resume session: {selectedSession.summary.slice(0, isMobile ? 30 : 50)}...</>
              ) : (
                'Start a new vibeclaude session'
              )}
            </p>
            <p className="text-muted-foreground text-xs mt-1 px-2 text-center">
              Arraste imagens ou pressione ⌘V para adicionar ao chat
            </p>
            {isBypassingPermissions && (
              <p className="text-warning text-xs mt-2 px-2 flex items-center justify-center space-x-1 flex-wrap">
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
        <div className="absolute inset-0 flex items-center justify-center bg-background bg-opacity-90 p-3 sm:p-4">
          <div className="text-center max-w-sm w-full">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-warning">
              <div className="w-5 h-5 sm:w-6 sm:h-6 animate-spin rounded-full border-2 border-warning border-t-transparent"></div>
              <span className="text-sm sm:text-base font-medium">Connecting...</span>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm mt-2 sm:mt-3 px-2 break-words">
              Starting Claude CLI in {selectedProject.displayName || selectedProject.name}
            </p>
          </div>
        </div>
      )}

      {/* Search Bar */}
      {showSearch && (
        <div className="absolute top-4 right-4 z-20 bg-background border border-border rounded-lg shadow-lg p-2 flex items-center space-x-2">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (searchAddon.current) {
                searchAddon.current.findNext(e.target.value, {
                  incremental: true,
                  decorations: {
                    matchBackground: '#FFD700',
                    activeMatchBackground: '#FFA500'
                  }
                });
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (searchAddon.current && searchQuery) {
                  if (e.shiftKey) {
                    searchAddon.current.findPrevious(searchQuery);
                  } else {
                    searchAddon.current.findNext(searchQuery);
                  }
                }
              } else if (e.key === 'Escape') {
                setShowSearch(false);
                setSearchQuery('');
                if (searchAddon.current) {
                  searchAddon.current.clearDecorations();
                }
              }
            }}
            placeholder="Search terminal..."
            className="px-3 py-1 bg-background text-foreground text-sm rounded border border-border focus:outline-none focus:ring-2 focus:ring-primary w-48"
            autoFocus
          />
          <button
            onClick={() => {
              if (searchAddon.current && searchQuery) {
                searchAddon.current.findPrevious(searchQuery);
              }
            }}
            className="p-1.5 hover:bg-accent rounded transition-colors"
            title="Previous match (Shift+Enter)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={() => {
              if (searchAddon.current && searchQuery) {
                searchAddon.current.findNext(searchQuery);
              }
            }}
            className="p-1.5 hover:bg-accent rounded transition-colors"
            title="Next match (Enter)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button
            onClick={() => {
              setShowSearch(false);
              setSearchQuery('');
              if (searchAddon.current) {
                searchAddon.current.clearDecorations();
              }
            }}
            className="p-1.5 hover:bg-accent rounded transition-colors"
            title="Close (Esc)"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
    </>
  );
  
  // Always use PanelGroup for consistent DOM structure
  return (
    <PanelGroup direction="horizontal" className="h-full w-full flex">
      {/* Terminal Panel - Always present */}
      <Panel 
        ref={terminalPanelHandleRef}
        defaultSize={showPreview && !isMobile ? 30 : 100} 
        minSize={30} 
        className="h-full"
        style={lockedTerminalWidth ? { flex: `0 0 ${lockedTerminalWidth}px` } : undefined}
      >
        <div 
          ref={terminalPanelRef}
          className="h-full min-h-0 flex flex-col bg-background rounded-xl border border-border" 
          {...dropzoneProps}>
          <input {...inputProps} />
            {/* Status Bar (aligned with Files header) */}
            <div className="flex-shrink-0 border-b border-border px-3 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-success' : 'bg-destructive'}`} />
                  {selectedSession && (
                    <span className="text-xs text-primary-foreground truncate">
                      ({selectedSession.summary.slice(0, isMobile ? 20 : 30)}...)
                    </span>
                  )}
                  {!selectedSession && (
                    <span className="text-xs text-muted-foreground hidden xs:inline">(New Session)</span>
                  )}
                  {!isInitialized && (
                    <span className="text-xs text-warning">
                      {isMobile ? 'Init...' : '(Initializing...)'}
                    </span>
                  )}
                  {isRestarting && (
                    <span className="text-xs text-blue-400">
                      {isMobile ? 'Restart...' : '(Restarting...)'}
                    </span>
                  )}
                </div>
                <div className="flex items-center space-x-1 min-w-0 flex-shrink-0">
                  
                  {/* Terminal Theme Toggle - always shows icon */}
                  <button
                    onClick={cycleTerminalTheme}
                    className="p-1 sm:p-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-all duration-200 flex-shrink-0"
                    title={`Terminal theme: ${terminalTheme} (click to change)`}
                  >
                    <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d={terminalTheme === 'light' 
                          ? "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                          : terminalTheme === 'dark'
                          ? "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21c2.185 0 4.188-.779 5.75-2.078l.203-.206A9.003 9.003 0 0020 12a8.965 8.965 0 00-.646-3.354z"
                          : "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                        }
                      />
                    </svg>
                  </button>
                  
                  {/* Bypass Permissions Toggle - Minimalista */}
                  <button
                    onClick={toggleBypassPermissions}
                    className={`p-1.5 rounded-md transition-all duration-200 ${
                      isBypassingPermissions 
                        ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' 
                        : 'hover:bg-accent text-muted-foreground hover:text-foreground'
                    }`}
                    title={isBypassingPermissions ? "Bypass permissions enabled (sudo mode)" : "Enable bypass permissions (sudo mode)"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d={isBypassingPermissions 
                          ? "M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" 
                          : "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                        } 
                      />
                    </svg>
                  </button>
                  
                  {/* Preview Toggle Button */}
                  {!isMobile && (
                    <button
                      onClick={() => {
                        if (showPreview) {
                          setShowPreview(false);
                          setPreviewUrl('');
                        } else {
                          // Try to detect URL from terminal or use default
                          const urls = detectUrlsInTerminal() || new Set();
                          // Use detected URLs from terminal or smart detection
                          let firstUrl = 'http://localhost:5892';
                          
                          if (urls.size > 0) {
                            firstUrl = Array.from(urls)[0];
                          } else {
                            // Use async detection for best URL
                            detectBestPreviewUrl().then(url => {
                              setPreviewUrl(url);
                            }).catch(() => {
                              // Fallback already set
                            });
                          }
                          setPreviewUrl(firstUrl);
                          // Close any right side panel to avoid overcrowding
                          if (onSidebarClose) {
                            onSidebarClose();
                          }
                          setShowPreview(true);
                        }
                      }}
                      className={`p-1 sm:p-1.5 text-xs rounded transition-all duration-200 flex-shrink-0 ${
                        showPreview 
                          ? 'text-blue-500 hover:text-blue-600 bg-blue-500/10 hover:bg-blue-500/20' 
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                      }`}
                      title={showPreview ? "Close preview panel" : "Open preview panel"}
                    >
                      <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" 
                        />
                      </svg>
                    </button>
                  )}
            
            {/* Preview Close Button - Only shows when preview is open */}
            {false && !isMobile && showPreview && (
              <button
              onClick={() => {
                setShowPreview(false);
                setPreviewUrl('');
              }}
              className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded transition-all"
              title="Close preview panel"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              </button>
            )}
            
            {isConnected && (
              <button
                onClick={disconnectFromShell}
                className="p-1.5 rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-200"
                title="Disconnect from shell"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
            
            <button
              onClick={restartShell}
              disabled={isRestarting || isConnected}
              className="p-1 sm:px-1.5 lg:px-2 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1 hover:bg-accent rounded transition-all duration-200 flex-shrink-0"
              title="Restart Shell (disconnect first)"
            >
              <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="hidden lg:inline whitespace-nowrap">Restart</span>
            </button>
            </div>
          </div>
        </div>

        {/* Terminal */}
        <div className="flex-1 min-h-0 p-1 md:p-2 pb-1 md:pb-2 overflow-hidden relative">
          {terminalContent}
        </div>
      </div>
    </Panel>
    
    {/* Preview panel - always render for consistent DOM structure */}
    {!isMobile && (
      <>
        {/* Resize Handle - only interactive when preview shown */}
        <PanelResizeHandle 
          className={showPreview ? "w-1 bg-transparent hover:bg-accent/30 transition-colors cursor-col-resize" : "w-0 pointer-events-none"} 
          disabled={!showPreview}
        />
        
        {/* Preview Panel - hidden when not in use */}
        <Panel 
          ref={previewPanelHandleRef}
          defaultSize={showPreview ? 70 : 0} 
          minSize={showPreview ? 30 : 0}
          maxSize={showPreview ? 100 : 0}
          className={showPreview ? "h-full" : "h-full hidden"}
        >
          {showPreview && (
            <PreviewPanel
              url={initialPreviewPaused ? '' : previewUrl}
              projectPath={selectedProject?.path}
              projectName={selectedProject?.name}
              onClose={() => setShowPreview(false)}
              onRefresh={() => detectUrlsInTerminal()}
              isMobile={false}
              initialPaused={initialPreviewPaused}
            />
          )}
        </Panel>
      </>
    )}
  </PanelGroup>
  );
}

export default Shell;
