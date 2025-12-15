import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import { useDropzone } from 'react-dropzone';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import PreviewPanel from './PreviewPanel';
import FileManagerSimple from './FileManagerSimple';
import ProjectBrowserSidebar from './ProjectBrowserSidebar';
import CtaButton from './ui/CtaButton';
import { detectBestPreviewUrl } from '../utils/detectPreviewUrl';
import { authPersistence } from '../utils/auth-persistence';
import { useCleanup } from '../hooks/useCleanup';
import 'xterm/css/xterm.css';

const DEFAULT_FONT_SIZE = 18;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 26;
const clampFontSize = (size) => Math.max(MIN_FONT_SIZE, Math.min(MAX_FONT_SIZE, size));
const getStoredFontSize = () => {
  if (typeof window === 'undefined') return DEFAULT_FONT_SIZE;
  const saved = parseInt(window.localStorage?.getItem('terminal-font-size') || '', 10);
  if (Number.isNaN(saved)) return DEFAULT_FONT_SIZE;
  return clampFontSize(saved);
};

const PROJECT_BROWSER_OPEN_KEY = 'app-project-browser-open';
const getStoredBrowserState = () => {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage?.getItem(PROJECT_BROWSER_OPEN_KEY);
    if (stored === null) return true;
    return stored !== '0';
  } catch {
    return true;
  }
};

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
  
  /* Make terminal responsive with proper spacing */
  .xterm {
    width: 100% !important;
    height: 100% !important;
    background-color: transparent !important; /* Let parent provide background */
    padding: 0.25rem 0.5rem !important; /* Add minimal padding to prevent text from touching edges */
  }
  
  .xterm .xterm-viewport {
    width: 100% !important;
    overflow-x: auto !important;
    background-color: transparent !important;
  }
  
  .xterm .xterm-screen {
    width: calc(100% - 1rem) !important; /* Account for padding */
    background-color: transparent !important;
  }
  
  /* Mobile optimizations */
  @media (max-width: 640px) {
    .xterm {
      padding: 0.375rem 0.625rem !important; /* Slightly more padding on mobile for touch */
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
  
  /* Tablet and small screens - ensure adequate spacing */
  @media (max-width: 1024px) {
    .xterm {
      padding: 0.375rem 0.5rem !important; /* Consistent padding on smaller screens */
    }
    
    .xterm .xterm-screen {
      width: calc(100% - 1rem) !important;
    }
  }
  
  /* Mobile scroll optimization */
  @media (max-width: 768px) {
    .xterm {
      overscroll-behavior: contain;
      padding: 0.5rem 0.625rem !important; /* More generous padding for mobile */
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

// Global store for shell sessions to persist across tab switches AND project switches
const shellSessions = new Map();

function Shell({
  selectedProject,
  selectedSession,
  isActive,
  onConnectionChange,
  onSessionStateChange,
  isMobile,
  resizeTrigger,
  onSidebarClose,
  activeSidePanel,
  onPreviewStateChange,
  onBindControls = null,
  onTerminalVisibilityChange = null,
  disablePreview = false,
  flushRight = false,
  projects = [],
  onProjectSelect: onProjectSidebarSelect = null,
  onProjectsRefresh = null
}) {
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
  const [isManualDisconnect, setIsManualDisconnect] = useState(true);
  const [toast, setToast] = useState(null);
  const [terminalFontSize, setTerminalFontSize] = useState(getStoredFontSize);
  const isAuthenticatedRef = useRef(false);
  const terminalFontSizeRef = useRef(terminalFontSize);
  terminalFontSizeRef.current = terminalFontSize;
  
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
  const [showProjectBrowser, setShowProjectBrowser] = useState(() => getStoredBrowserState());
  
  // Terminal visibility (allow chat + preview without terminal)
  const [showTerminal, setShowTerminal] = useState(true);
  
  // Unified cleanup utilities for listeners/timers
  const { addManagedEventListener } = useCleanup();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage?.setItem(PROJECT_BROWSER_OPEN_KEY, showProjectBrowser ? '1' : '0');
    } catch {
      // Ignore persistence errors
    }
  }, [showProjectBrowser]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('terminal-font-size', String(terminalFontSize));
      } catch {}
    }

    if (!terminal.current) {
      return;
    }

    const appliedSize = clampFontSize(terminalFontSize);
    if (terminal.current.options.fontSize !== appliedSize) {
      terminal.current.options.fontSize = appliedSize;
      try {
        terminal.current.refresh(0, terminal.current.rows - 1);
      } catch {}
    }

    requestAnimationFrame(() => {
      if (fitAddon.current) {
        try { fitAddon.current.fit(); } catch {}
      }
      if (ws.current && ws.current.readyState === WebSocket.OPEN && terminal.current) {
        try {
          ws.current.send(JSON.stringify({
            type: 'resize',
            cols: terminal.current.cols,
            rows: terminal.current.rows
          }));
        } catch {}
      }
    });
  }, [terminalFontSize]);

  useEffect(() => {
    try { onTerminalVisibilityChange && onTerminalVisibilityChange(showTerminal); } catch {}
  }, [showTerminal, onTerminalVisibilityChange]);

  // Overlay active when loading/connecting/disconnected (used to hide cursor/artifacts)
  const overlayActive = !isInitialized || (!isConnected || isConnecting);

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

  // Responsive layout when preview/chat panels are open
  useEffect(() => {
    if (isMobile) return;
    try {
      if (showPreview) {
        if (!showTerminal) {
          if (previewPanelHandleRef.current?.resize) previewPanelHandleRef.current.resize(100);
          if (terminalPanelHandleRef.current?.resize) terminalPanelHandleRef.current.resize(0);
        } else {
          const previewPct = activeSidePanel ? 65 : 70;
          const shellPct = 100 - previewPct;
          if (previewPanelHandleRef.current?.resize) previewPanelHandleRef.current.resize(previewPct);
          if (terminalPanelHandleRef.current?.resize) terminalPanelHandleRef.current.resize(shellPct);
        }
      } else {
        if (terminalPanelHandleRef.current?.resize) terminalPanelHandleRef.current.resize(100);
        if (previewPanelHandleRef.current?.resize) previewPanelHandleRef.current.resize(0);
      }
    } catch {}
  }, [showPreview, activeSidePanel, isMobile, showTerminal]);
  const [previewUrl, setPreviewUrl] = useState('');
  // (Removed global publish of preview URL; assistant now lives inside preview again)
  const [detectedUrls, setDetectedUrls] = useState(new Set());
  const previewControlsRef = useRef(null);
  
  // Image drag & drop states
  const [isDraggedImageOver, setIsDraggedImageOver] = useState(false);
  
  // Terminal theme state
  const [terminalTheme, setTerminalTheme] = useState('dark');

  // MCP output formatter: fix single-char-per-line blocks and truncate extra-long lines
  const formatMcpOutput = useCallback((raw) => {
    try {
      if (!raw || (typeof raw !== 'string')) return raw;
      if (!(/\(MCP\)/.test(raw) || /microsoft-|playwright|tool use|Tool use/i.test(raw))) {
        // Not an MCP-styled chunk; apply only safe truncation
        return raw.split(/\r?\n/).map((ln) => (ln.length > 240 ? ln.slice(0, 240) + ' …' : ln)).join('\n');
      }

      const lines = raw.split(/\r?\n/);
      const out = [];
      let buf = '';
      let singles = 0;

      const flushSingles = () => {
        if (singles >= 4) {
          // Join accumulated single-char lines into one
          out.push(buf);
        } else if (singles > 0) {
          // Keep as-is if short (avoids breaking ascii art)
          for (const ch of buf.split('')) out.push(ch);
        }
        buf = '';
        singles = 0;
      };

      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (ln && ln.trim().length === 1) {
          buf += ln.trim();
          singles++;
          continue;
        }
        flushSingles();
        out.push(ln.length > 240 ? ln.slice(0, 240) + ' …' : ln);
      }
      flushSingles();
      return out.join('\n');
    } catch {
      return raw;
    }
  }, []);
  
  // Sound notification function (Web Audio API)
  const playCompletionSound = async () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
      setTimeout(() => ctx.close && ctx.close().catch(() => {}), 400);
    } catch {}
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
      const hostname = urlObj.hostname;

      // Standard localhost addresses
      const validHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
      if (validHosts.includes(hostname)) return true;

      // Private network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      if (hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        return true;
      }

      return false;
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
    console.log('[Preview] handlePreviewUrl called with URL:', url);
    console.log('[Preview] isMobile:', isMobile);
    console.log('[Preview] Current showPreview:', showPreview);

    // Prevent preview from opening on mobile devices
    if (isMobile) {
      console.log('[Preview] Blocked: mobile mode');
      return;
    }

    console.log('[Preview] Setting preview URL and showing preview');
    setPreviewUrl(url);
    setShowPreview(true);
    detectUrlsInTerminal();

    console.log('[Preview] Preview should now be visible with URL:', url);

    // Close sidebar when preview opens to maximize space
    if (onSidebarClose) {
      console.log('[Preview] Closing sidebar to maximize space');
      onSidebarClose();
    }
  };

  // Expose preview/file controls to parent (MainContent)
  useEffect(() => {
    if (typeof onBindControls === 'function') {
      const controls = {
        openPreview: () => setShowPreview(true),
        closePreview: () => setShowPreview(false),
        showTerminal: () => setShowTerminal(true),
        hideTerminal: () => setShowTerminal(false),
        toggleTerminal: () => setShowTerminal(v => !v),
        toggleFiles: () => previewControlsRef.current?.toggleFiles?.(),
        showFiles: () => previewControlsRef.current?.showFiles?.(),
        hideFiles: () => previewControlsRef.current?.hideFiles?.(),
        showProjectBrowser: () => setShowProjectBrowser(true),
        hideProjectBrowser: () => setShowProjectBrowser(false),
        toggleProjectBrowser: () => setShowProjectBrowser((prev) => !prev),
        // Shell actions exposed for header buttons
        toggleBypass: () => toggleBypassPermissions(),
        restart: () => restartShell(),
        disconnect: () => disconnectFromShell(true, true),
        // Ensure Files overlay opens reliably: open preview, then wait until child binds
        openFilesPrimary: () => {
          setShowPreview(true);
          let tries = 0;
          const t = setInterval(() => {
            tries += 1;
            try { previewControlsRef.current?.showFiles?.(); } catch {}
            if (previewControlsRef.current?.showFiles || tries > 40) {
              // one last call to be safe then stop
              try { previewControlsRef.current?.showFiles?.(); } catch {}
              clearInterval(t);
            }
          }, 50);
        }
      };
      onBindControls(controls);
      return () => {
        try { onBindControls(null); } catch {}
      };
    }
  }, [onBindControls]);

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

  const handleProjectBrowserSelect = useCallback((project) => {
    if (!project) return;
    onProjectSidebarSelect?.(project);
  }, [onProjectSidebarSelect]);
  
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

  // Connect to Codex function (auto-starts codex with bypass)
  const connectToCodex = () => {
    if (!isInitialized || isConnected || isConnecting) return;

    // Reset manual disconnect flag when connecting manually
    setIsManualDisconnect(false);

    setIsConnecting(true);

    // Store flag to auto-start codex after connection
    sessionStorage.setItem('auto-start-codex', 'true');

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
    const newState = !isBypassingPermissions;
    setIsBypassingPermissions(newState);

    // Replace transient toast with persistent visual indicator elsewhere.
    // Keep toast state clear to avoid showing the floating banner in the wrong place.
    setToast(null);
    
    // Send message to server if connected and authenticated
    if (ws.current && ws.current.readyState === WebSocket.OPEN && isAuthenticatedRef.current) {
      ws.current.send(JSON.stringify({
        type: 'bypassPermissions',
        enabled: newState
      }));
    }
  };

  const increaseFontSize = () => {
    setTerminalFontSize((current) => clampFontSize(current + 1));
  };

  const decreaseFontSize = () => {
    setTerminalFontSize((current) => clampFontSize(current - 1));
  };

  const resetFontSize = () => {
    setTerminalFontSize((current) => (current === DEFAULT_FONT_SIZE ? current : DEFAULT_FONT_SIZE));
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
                
                // First upload the image to server (only if authenticated)
                if (isAuthenticatedRef.current) {
                  ws.current.send(JSON.stringify({
                    type: 'image',
                    data: {
                      filename: fileName,
                      type: file.type,
                      size: file.size,
                      base64: base64Data
                    }
                  }));
                }
                
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
            
            if (ws.current && ws.current.readyState === WebSocket.OPEN && isAuthenticatedRef.current) {
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
          
          if (ws.current && ws.current.readyState === WebSocket.OPEN && isAuthenticatedRef.current) {
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
        background: 'rgba(0,0,0,0)',
        foreground: '#f2f2f2',
        cursor: '#ffffff',
        cursorAccent: '#000000',
        selection: '#333333',
        selectionForeground: '#ffffff',
      },
      light: {
        background: 'rgba(0,0,0,0)',
        foreground: '#333333',
        cursor: '#333333',
        cursorAccent: '#ffffff',
        selection: '#b4d5fe',
        selectionForeground: '#000000',
      },
      gray: {
        background: 'rgba(0,0,0,0)',
        foreground: '#cccccc',
        cursor: '#ffffff',
        cursorAccent: '#2d2d2d',
        selection: '#515151',
        selectionForeground: '#ffffff',
      }
    };
    
    const computedFontSize = clampFontSize(terminalFontSizeRef.current || DEFAULT_FONT_SIZE);

    // Initialize new terminal with responsive settings and performance optimizations
    terminal.current = new Terminal({
      cursorBlink: true,
      cursorStyle: 'block', // Use block cursor for better visibility
      cursorWidth: 1,
      fontSize: computedFontSize,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      allowProposedApi: true, // Required for clipboard addon
      allowTransparency: true,
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
        
        // Extended colors for better terminal output
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
      console.log('[WebLinks] Link clicked:', uri);
      console.log('[WebLinks] Event:', event);
      console.log('[WebLinks] isMobile:', isMobile);

      // Check if it's a localhost URL
      const isLocalhost = isLocalhostUrl(uri);
      console.log('[WebLinks] Is localhost/private IP:', isLocalhost);

      if (isLocalhost) {
        // CRITICAL: Stop all event propagation
        if (event) {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        console.log('[WebLinks] Prevented default + stopped propagation, handling internally');

        // On mobile, open localhost URLs in new tab instead of preview
        if (isMobile) {
          console.log('[WebLinks] Opening in new tab (mobile mode)');
          window.open(uri, '_blank');
        } else {
          console.log('[WebLinks] Opening in preview panel');
          handlePreviewUrl(uri);
        }
        return false; // Extra safety: return false to prevent default
      } else {
        // Let non-localhost URLs open normally
        console.log('[WebLinks] Opening external URL in new tab');
        window.open(uri, '_blank');
      }
    }, {
      // Add validation to ensure we only handle HTTP(S) links
      willLinkActivate: (event, uri) => {
        console.log('[WebLinks] willLinkActivate:', uri);
        return true; // Allow all links to be activated
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
        // Send terminal size to backend after fitting (multiple pings for reliability)
        const sendResize = () => {
          if (terminal.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
            try {
              ws.current.send(JSON.stringify({
                type: 'resize',
                cols: terminal.current.cols,
                rows: terminal.current.rows
              }));
            } catch {}
          }
        };
        setTimeout(sendResize, 50);
        setTimeout(sendResize, 200);
        setTimeout(sendResize, 700);
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
        
        // Send input to terminal (only if authenticated)
        if (isAuthenticatedRef.current && ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({
            type: 'input',
            data: data
          }));
        }
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
              
              // Send updated terminal size to backend after resize (only if authenticated)
              if (ws.current && ws.current.readyState === WebSocket.OPEN && isAuthenticatedRef.current) {
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
        const onTouchStart = (e) => {
          // Allow scrolling but prevent text selection during scroll
          if (e.touches.length === 1) {
            e.stopPropagation();
          }
        };
        const onTouchMove = (e) => {
          // Allow scrolling
          e.stopPropagation();
        };
        
        addManagedEventListener(viewport, 'touchstart', onTouchStart, { passive: true }, 'shell viewport touchstart');
        addManagedEventListener(viewport, 'touchmove', onTouchMove, { passive: true }, 'shell viewport touchmove');
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

  // Auto-connect when terminal is initialized and project is selected
  useEffect(() => {
    console.log('[Shell Debug] Auto-connect check:', {
      isInitialized,
      hasSelectedProject: !!selectedProject,
      isConnected,
      isConnecting,
      isManualDisconnect,
      willConnect: isInitialized && selectedProject && !isConnected && !isConnecting && !isManualDisconnect
    });

    if (isInitialized && selectedProject && !isConnected && !isConnecting && !isManualDisconnect) {
      console.log('[Shell Debug] Auto-connecting WebSocket...');
      // Small delay to ensure terminal is fully ready
      const timer = setTimeout(() => {
        connectWebSocket();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isInitialized, selectedProject, isConnected, isConnecting, isManualDisconnect]);

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

    // Also listen for window resize/orientation with stable handlers
    const onWindowResize = () => handleResize(false);
    const onOrientationChange = () => handleResize(true);
    addManagedEventListener(window, 'resize', onWindowResize, false, 'shell window resize');
    addManagedEventListener(window, 'orientationchange', onOrientationChange, false, 'shell window orientationchange');

    return () => {
      resizeObserver.disconnect();
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
    console.log('[Shell Debug] connectWebSocket called', { isConnecting, isConnected });

    if (isConnecting || isConnected) {
      console.log('[Shell Debug] Already connecting or connected, returning');
      return;
    }

    try {
      // Get authentication token
      const token = await authPersistence.getToken();
      console.log('[Shell Debug] Token retrieved:', token ? 'exists' : 'missing');
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
        wsBaseUrl = `${protocol}//${window.location.hostname}:7347`;
      }
      
      // Include token in WebSocket URL for backward compatibility (server now expects auth message)
      const wsUrl = `${wsBaseUrl}/shell?token=${encodeURIComponent(token)}`;

      console.log('[Shell Debug] Creating WebSocket connection to:', wsUrl);

      // Reset initialization flag before creating new connection
      hasInitialized.current = false;

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        console.log('[Shell Debug] WebSocket opened successfully');
        setIsConnected(true);
        setIsConnecting(false);
        // Reset auth state for this connection and send auth as FIRST message
        isAuthenticatedRef.current = false;
        try {
          ws.current.send(JSON.stringify({ type: 'auth', token }));
        } catch (e) {
          // If sending fails, connection will close and retry
        }
        
        // Reset reconnection attempts on successful connection
        reconnectAttempts.current = 0;
        
        // Don't start heartbeat here - wait for auth-success
        // Initialization and heartbeat will happen after receiving auth-success
      };

      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'auth-success') {
            // Mark authenticated and perform initialization handshake
            isAuthenticatedRef.current = true;
            
            // Show reconnection success message if this was a reconnection
            if (lastSessionId && terminal.current) {
              terminal.current.write('\x1b[32m✓ Reconnected successfully. Session context maintained.\x1b[0m\r\n');
            }
            
            // Start heartbeat to keep connection alive (only after authentication)
            if (heartbeatInterval.current) {
              clearInterval(heartbeatInterval.current);
            }
            
            heartbeatInterval.current = setInterval(() => {
              if (ws.current && ws.current.readyState === WebSocket.OPEN && isAuthenticatedRef.current) {
                ws.current.send(JSON.stringify({ type: 'ping' }));
              }
            }, 30000); // Send ping every 30 seconds
            
            // Fit and send init + initial resize
            setTimeout(() => {
              if (fitAddon.current && terminal.current && ws.current?.readyState === WebSocket.OPEN) {
                try { fitAddon.current.fit(); } catch {}
                setTimeout(() => {
                  if (!hasInitialized.current && ws.current?.readyState === WebSocket.OPEN) {
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
                      isReconnection: !!lastSessionId
                    };
                    if (sessionIdToUse) setLastSessionId(sessionIdToUse);
                    if (projectPathToUse) lastProjectPath.current = projectPathToUse;
                    try { ws.current.send(JSON.stringify(initPayload)); } catch {}
                    hasInitialized.current = true;

                    // Auto-start Claude Code or Codex if enabled and not reconnecting
                    if (!lastSessionId) {
                      console.log('[Shell] Checking auto-start configuration...');
                      try {
                        // Check if Codex auto-start was requested
                        const autoStartCodex = sessionStorage.getItem('auto-start-codex');

                        if (autoStartCodex === 'true') {
                          console.log('[Shell] Codex auto-start requested, will send command in 500ms');
                          // Clear the flag
                          sessionStorage.removeItem('auto-start-codex');

                          // Wait a bit for the shell to be ready, then send the command
                          setTimeout(() => {
                            if (ws.current?.readyState === WebSocket.OPEN) {
                              try {
                                const command = 'codex --dangerously-bypass-approvals-and-sandbox\r';
                                console.log('[Shell] Sending Codex auto-start command');
                                ws.current.send(JSON.stringify({ type: 'input', data: command }));
                                console.log('[Shell] Codex command sent successfully');
                              } catch (e) {
                                console.error('[Shell] Failed to auto-start codex:', e);
                              }
                            } else {
                              console.warn('[Shell] WebSocket not open, cannot send codex command');
                            }
                          }, 500);
                        } else {
                          // Check for Claude Code auto-start
                          const settings = localStorage.getItem('claude-tools-settings');
                          console.log('[Shell] Settings from localStorage:', settings);
                          let shouldAutoStart = false;

                          if (settings) {
                            const parsed = JSON.parse(settings);
                            console.log('[Shell] Parsed settings:', parsed);
                            shouldAutoStart = parsed.autoStartClaudeCode;
                            console.log('[Shell] shouldAutoStart:', shouldAutoStart);
                          }

                          if (shouldAutoStart) {
                            console.log('[Shell] Auto-start is enabled, will send command in 500ms');
                            // Wait a bit for the shell to be ready, then send the command
                            setTimeout(() => {
                              if (ws.current?.readyState === WebSocket.OPEN) {
                                try {
                                  // Build command with bypass flag if enabled
                                  let command = 'claude code';
                                  if (isBypassingPermissions) {
                                    command += ' --dangerously-skip-permissions';
                                    console.log('[Shell] Adding --dangerously-skip-permissions flag');
                                  }
                                  command += '\r';

                                  console.log('[Shell] Sending auto-start command:', command.replace('\r', '\\r'));
                                  ws.current.send(JSON.stringify({ type: 'input', data: command }));
                                  console.log('[Shell] Auto-start command sent successfully');
                                } catch (e) {
                                  console.error('[Shell] Failed to auto-start claude code:', e);
                                }
                              } else {
                                console.warn('[Shell] WebSocket not open, cannot send auto-start command');
                              }
                            }, 500);
                          } else {
                            console.log('[Shell] Auto-start is disabled or not configured');
                          }
                        }
                      } catch (e) {
                        console.error('[Shell] Error checking auto-start setting:', e);
                      }
                    } else {
                      console.log('[Shell] Skipping auto-start (reconnection detected, lastSessionId:', lastSessionId, ')');
                    }
                  }
                  // Send resize after init
                  setTimeout(() => {
                    if (terminal.current && ws.current?.readyState === WebSocket.OPEN) {
                      try {
                        ws.current.send(JSON.stringify({
                          type: 'resize',
                          cols: terminal.current.cols,
                          rows: terminal.current.rows
                        }));
                      } catch {}
                    }
                  }, 100);
                }, 50);
              }
            }, 200);
            return;
          }
          // Only process messages after authentication
          if (!isAuthenticatedRef.current) {
            return;
          }
          
          if (data.type === 'output') {
            // Mark session as active when receiving output
            markSessionActive();
            // Removed URL regex processing here for better performance
            // URLs are already handled by WebLinksAddon
            
            // Format MCP chunks and truncate overlong lines visually
            const payload = formatMcpOutput(data.data);
            terminal.current.write(payload);
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
          } else if (data.type === 'init-success') {
            // Shell initialization successful
            setIsInitialized(true);
            // Don't write anything here - let the shell show its own prompt
            // The shell will output its prompt naturally when ready
          } else if (data.type === 'error') {
            // Handle errors from server
            if (terminal.current) {
              terminal.current.write(`\r\n\x1b[31mError: ${data.error || 'Unknown error'}\x1b[0m\r\n`);
            }
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
      <div className="h-full w-full relative">
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
              Imagens serão processadas no terminal
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-1">
              Ou pressione ⌘V para colar da área de transferência
            </p>
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {!isInitialized && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span className="text-xs sm:text-sm text-white/90">Loading terminal…</span>
          </div>
        </div>
      )}
      
      {/* Connect button when not connected */}
      {isInitialized && !isConnected && !isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent px-4">
          <div className="flex flex-col items-center gap-3 sm:gap-4 text-center max-w-md w-full">
            {/* Title */}
            <div className="text-center select-none">
              <div className="text-base sm:text-lg font-semibold text-foreground/90 mb-1">Start Shell session</div>
              <div className="text-muted-foreground text-xs sm:text-sm">Choose your AI assistant</div>
            </div>

            {/* Buttons - stacked on mobile, side by side on desktop */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
              <button
                onClick={connectToShell}
                className="h-11 sm:h-10 px-6 sm:px-8 rounded-lg border-2 border-blue-500/50 bg-blue-500/10 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 hover:border-blue-500 active:scale-95 transition-all min-w-[120px]"
              >
                Claude
              </button>
              <button
                onClick={connectToCodex}
                className="h-11 sm:h-10 px-6 sm:px-8 rounded-lg border-2 border-orange-500/50 bg-orange-500/10 text-sm font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 hover:border-orange-500 active:scale-95 transition-all min-w-[120px]"
              >
                Codex
              </button>
            </div>

            {/* Bypass status badge */}
            {isBypassingPermissions && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-500">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs font-medium">Bypass enabled</span>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Connecting state */}
      {isConnecting && (
        <div className="absolute inset-0 flex items-center justify-center bg-transparent">
          <div className="text-center max-w-sm w-full">
            <div className="flex items-center justify-center space-x-2 sm:space-x-3 text-warning">
              <div className="w-5 h-5 sm:w-6 sm:h-6 animate-spin rounded-full border-2 border-warning border-t-transparent"></div>
              <span className="text-sm sm:text-base font-medium">Connecting...</span>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm mt-2 sm:mt-3 px-2 break-words">
              Starting shell session in {selectedProject.displayName || selectedProject.name}
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

      </div>
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
  const sidebarVisible = showProjectBrowser && !isMobile;

  return (
    <div className="h-full w-full flex gap-3 p-4 pr-2 md:pr-3">
      {sidebarVisible && (
        <div className="h-full flex-shrink-0 w-[230px]">
          <ProjectBrowserSidebar
            projects={projects}
            selectedProject={selectedProject}
            onProjectSelect={handleProjectBrowserSelect}
            onProjectsRefresh={onProjectsRefresh}
            onCollapse={() => setShowProjectBrowser(false)}
            className="h-full shadow-[0_20px_60px_rgba(0,0,0,0.45)]"
          />
        </div>
      )}

      <div className="flex-1 h-full rounded-[28px] border border-border/40 bg-card/70 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.45)] overflow-hidden">
        <PanelGroup direction="horizontal" className="h-full w-full flex">
          {/* Terminal Panel - Always present */}
          <Panel 
            ref={terminalPanelHandleRef}
            defaultSize={showPreview && !isMobile ? 45 : 100} 
            minSize={0} 
            className="h-full"
            style={lockedTerminalWidth ? { flex: `0 0 ${lockedTerminalWidth}px` } : undefined}
          >
            <div 
            ref={terminalPanelRef}
          className={`h-full min-h-0 flex flex-col relative ${showTerminal ? `${(showPreview || flushRight) ? 'border border-r-0 rounded-[26px] rounded-r-none' : 'border rounded-[26px]' } border-border/60 bg-background/60 backdrop-blur-2xl overflow-hidden` : 'border-0'} ${overlayActive ? 'shell-cursor-hidden' : ''}`} 
          {...dropzoneProps}>
          {/* Shell controls in local header (top-right) */}
          <div className="absolute top-2 right-2 z-20 flex items-center gap-1.5">
            <div
              className="flex items-center gap-1 h-7 px-2 rounded-full border border-border bg-background/90 text-[10px] sm:text-[11px] font-semibold text-muted-foreground shadow-sm"
              title={`Tamanho da fonte do Shell (${terminalFontSize}px). Duplo clique para resetar.`}
              onDoubleClick={resetFontSize}
            >
              <button
                type="button"
                onClick={decreaseFontSize}
                disabled={terminalFontSize <= MIN_FONT_SIZE}
                className="text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground"
                title="Diminuir fonte"
              >
                A-
              </button>
              <span className="text-[10px] tracking-wide">{terminalFontSize}px</span>
              <button
                type="button"
                onClick={increaseFontSize}
                disabled={terminalFontSize >= MAX_FONT_SIZE}
                className="text-xs font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:text-foreground"
                title="Aumentar fonte"
              >
                A+
              </button>
            </div>
            <button
              onClick={toggleBypassPermissions}
              className={`icon-pill-sm ${isBypassingPermissions ? 'text-amber-400' : 'text-muted-foreground'}`}
              title={isBypassingPermissions ? 'Bypass permissions: ON' : 'Bypass permissions: OFF'}
            >
              {isBypassingPermissions ? (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              )}
            </button>
            <button
              onClick={restartShell}
              disabled={isRestarting || isConnected}
              className="icon-pill-sm text-muted-foreground disabled:opacity-50"
              title="Restart shell"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6"/>
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/>
              </svg>
            </button>
            <button
              onClick={() => disconnectFromShell(true, true)}
              className="icon-pill-sm text-muted-foreground"
              title="Disconnect shell"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <input {...inputProps} />
          
          {/* Removed floating toast; bypass status now persists under subtitle when relevant */}

        {/* Terminal area or Files (empty state of Shell) */}
        {showTerminal && (
          // Maintain minimal padding when preview is open for better readability
          <div className={`flex-1 min-h-0 ${showPreview ? 'px-1 py-0.5 sm:px-2 sm:py-1' : 'p-1 md:p-2'} overflow-hidden relative`}>
            <div className="h-full overflow-hidden relative p-0 bg-transparent">
              {terminalContent}
            </div>
          </div>
        )}
        {!showTerminal && !showPreview && (
          <div className={`flex-1 min-h-0 ${showPreview ? 'px-1 py-0.5 sm:px-2 sm:py-1' : 'p-1 md:p-2'} overflow-hidden relative`}>
            <div className="h-full rounded-2xl border border-border bg-card flex items-center justify-center">
              <span className="text-xs text-muted-foreground">Terminal hidden</span>
            </div>
          </div>
        )}
        </div>
    </Panel>
    
          {/* Preview panel - always render for consistent DOM structure */}
          {!isMobile && (
            <>
              {/* Resize Handle - only interactive when preview shown */}
              {!disablePreview && (
                <PanelResizeHandle 
                  className={showPreview ? "w-px bg-border transition-colors cursor-col-resize" : "w-0 pointer-events-none"} 
                  disabled={!showPreview}
                />
              )}
              
              {/* Preview Panel - hidden when not in use */}
              <Panel 
                ref={previewPanelHandleRef}
                defaultSize={disablePreview ? 0 : (showPreview ? 55 : 0)} 
                minSize={disablePreview ? 0 : (showPreview ? 30 : 0)}
                maxSize={disablePreview ? 0 : (showPreview ? 100 : 0)}
                className={disablePreview || !showPreview ? "h-full hidden" : "h-full"}
              >
                {!disablePreview && showPreview && (
                  <div className="h-full w-full border border-l-0 border-border/60 rounded-[26px] rounded-l-none overflow-hidden bg-background/60 backdrop-blur-2xl">
                    <PreviewPanel
                      url={initialPreviewPaused ? '' : previewUrl}
                      projectPath={selectedProject?.fullPath || selectedProject?.path}
                      projectName={selectedProject?.name}
                      onClose={() => setShowPreview(false)}
                      onRefresh={() => detectUrlsInTerminal()}
                      isMobile={false}
                      initialPaused={initialPreviewPaused}
                      tightEdgeLeft={true}
                      onBindControls={(controls) => { previewControlsRef.current = controls; }}
                    />
                  </div>
                )}
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>
    </div>
  );
}

export default Shell;
