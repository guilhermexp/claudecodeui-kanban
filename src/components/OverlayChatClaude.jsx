import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
// Use unified Claude WebSocket from context to avoid duplicate connections
import { useClaudeWebSocket } from '../contexts/ClaudeWebSocketContext';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { normalizeCodexEvent } from '../utils/codex-normalizer';
import { normalizeClaudeEvent } from '../utils/claude-normalizer';
import CtaButton from './ui/CtaButton';
import { loadPlannerMode, savePlannerMode, loadModelLabel, saveModelLabel, loadCliProvider, saveCliProvider } from '../utils/chat-prefs';
import { hasChatHistory, loadChatHistory, saveChatHistory } from '../utils/chat-history';
import { hasLastSession, loadLastSession, saveLastSession, clearLastSession } from '../utils/chat-session';
import { useMessageFeedback } from '../hooks/useMessageFeedback';
import { useClaudeSessionState } from '../hooks/claude/useClaudeSessionState';
import { getMessageIndicator } from '../utils/message-feedback';
import { createLogger } from '../utils/logger';
import CodeBlockCollapsible from './overlay-claude/CodeBlockCollapsible';
import ToolResultItem from './overlay-claude/ToolResultItem';
import ThinkingCollapsible from './overlay-claude/ThinkingCollapsible';

// Store for collapsed state of details elements to persist across re-renders
const detailsStateStore = new Map();

// Simple hash function for text content
function hashText(s) {
  let h = 2166136261;
  for (let i = 0; i < Math.min(s.length, 100); i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h.toString(36);
}
import { useActivityTimer } from '../hooks/useActivityTimer';
import { useClaudeStreamHandler } from '../hooks/claude/useClaudeStreamHandler';

const log = createLogger('OverlayChatClaude');

// Using external, shared components from overlay-claude/ to reduce file size

// Overlay Chat com formatação bonita usando ReactMarkdown
// Usa NOSSO backend interno (porta 7347) - sem servidores externos!
const OverlayChat = React.memo(function OverlayChat({ projectPath, projects = [], previewUrl, embedded = false, disableInlinePanel = false, useSidebarWhenOpen = false, sidebarContainerRef = null, onBeforeOpen, onPanelClosed, cliProviderFixed = null, chatId = 'default', onSessionIdChange = null, onBindControls = null, onSessionInfoChange = null, onActivityChange = null }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  
  // CLI Provider state - fixed if passed via props, otherwise from localStorage
  const [cliProvider, setCliProvider] = useState(() => cliProviderFixed || loadCliProvider());
  
  // Separate states for each CLI provider
  const [codexMessages, setCodexMessages] = useState([]);
  const [claudeMessages, setClaudeMessages] = useState([]);
  const [codexSessionId, setCodexSessionId] = useState(null);
  const { claudeSessionId, setClaudeSessionId, claudeSessionActive, setClaudeSessionActive, resetClaudeSession } = useClaudeSessionState(null, false);
  const [codexSessionActive, setCodexSessionActive] = useState(false);
  const [currentModel, setCurrentModel] = useState(null);
  
  // Use the new message feedback system for better UX
  const {
    messages: feedbackMessages,
    statusMessage,
    addMessage: addFeedbackMessage,
    addTemporary,
    startLoading,
    completeLoading,
    updateStatus,
    clearTemporary,
    clearAll: clearAllFeedback,
    removeMessage,
    updateMessage,
    setMessages: setFeedbackMessages
  } = useMessageFeedback();
  
  // Current active states based on selected provider
  const messages = cliProvider === 'codex' ? codexMessages : claudeMessages;
  const setMessages = cliProvider === 'codex' ? setCodexMessages : setClaudeMessages;
  const sessionId = cliProvider === 'codex' ? codexSessionId : claudeSessionId;
  const setSessionId = cliProvider === 'codex' ? setCodexSessionId : setClaudeSessionId;
  const sessionActive = cliProvider === 'codex' ? codexSessionActive : claudeSessionActive;
  
  const [isTyping, setIsTyping] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [typingStatus, setTypingStatus] = useState({ mode: 'idle', label: '' });
  const [typingStart, setTypingStart] = useState(null); // legacy; not used for timer anymore
  // Lock indicator from first send to final done
  const [activityLock, setActivityLock] = useState(false);
  // Minimal tool header indicator (running/success/error)
  const [toolIndicator, setToolIndicator] = useState({ label: null, status: 'idle' });
  const [selectedElement, setSelectedElement] = useState(null);
  const [attachments, setAttachments] = useState([]); // chips like "div", "span" etc
  const [imageAttachments, setImageAttachments] = useState([]); // Array of image data URLs
  const [isDragging, setIsDragging] = useState(false);
  
  // Slash commands state
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  
  // Context window tracking - dados reais do Claude
  const [contextInfo, setContextInfo] = useState({
    num_turns: 0,
    duration_ms: 0,
    estimated_tokens: 0,
    max_context: 200000 // Claude 3.5 tem 200k tokens de contexto
  });
  
  // Available slash commands - minimalista sem emojis
  const slashCommands = [
    { command: '/clear', description: 'Clear chat history' },
    { command: '/reset', description: 'Reset session' },
    { command: '/model', description: 'Change AI model' },
    { command: '/help', description: 'Show available commands' },
    { command: '/project', description: 'Change project' },
    { command: '/stop', description: 'Stop current operation' },
    { command: '/save', description: 'Save conversation' },
    { command: '/export', description: 'Export chat as markdown' },
    { command: '/stats', description: 'Show usage statistics' },
    { command: '/theme', description: 'Toggle theme' },
    // Comandos personalizados do usuário
    { command: '/memory', description: 'Edit Claude memory file' },
    { command: '/docs', description: 'Open documentation' },
    { command: '/config', description: 'Edit configuration' },
    { command: '/tools', description: 'Manage tool permissions' },
    { command: '/mcp', description: 'MCP server status' },
    { command: '/logs', description: 'View system logs' },
    { command: '/restart', description: 'Restart Claude session' },
    { command: '/version', description: 'Show version info' }
  ];
  
  const trayInputRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const autoGreetSentRef = useRef(false);
  const [hasSaved, setHasSaved] = useState(false);
  const restoredRef = useRef(false);
  const lastAssistantTextRef = useRef('');
  // Project pinning: allow chat to stay on a project even if app selection changes
  const [chatProjectPath, setChatProjectPath] = useState(projectPath || null);
  const [pendingProjectPath, setPendingProjectPath] = useState(null);
  const [showProjectSwitchPrompt, setShowProjectSwitchPrompt] = useState(false);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const projectButtonRef = useRef(null);
  const projectMenuRef = useRef(null);
  const activeProjectPath = chatProjectPath || projectPath || process.cwd();

  // When outer project changes, ask user if chat should follow (shell can switch independently)
  useEffect(() => {
    if (!projectPath) return;
    if (!chatProjectPath) { setChatProjectPath(projectPath); return; }
    if (projectPath !== chatProjectPath) {
      setPendingProjectPath(projectPath);
      setShowProjectSwitchPrompt(true);
    }
  }, [projectPath]);

  // Close project dropdown on outside click or Esc
  useEffect(() => {
    if (!showProjectMenu) return;
    const onDocClick = (e) => {
      const btn = projectButtonRef.current;
      const menu = projectMenuRef.current;
      const target = e.target;
      if (!btn || !menu) return;
      if (btn.contains(target) || menu.contains(target)) return;
      setShowProjectMenu(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setShowProjectMenu(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [showProjectMenu]);
  
  // Preferences (kept, but control hidden from header)
  const [hideThinking] = useState(() => {
    try { return localStorage.getItem('codex-hide-thinking') === '1'; } catch { return false; }
  });
  
  // Estado para controlar modo perigoso (persistido por projeto)
  const [dangerousMode, setDangerousMode] = useState(() => {
    try {
      const key = projectPath ? `codex-dangerous-${projectPath}` : 'codex-dangerous-global';
      return localStorage.getItem(key) === '1';
    } catch { return false; }
  });
  
  // Auth-aware WebSocket (connect only once token is available)
  const { isLoading: authLoading, token } = useAuth();
  const authReady = !!token && !authLoading;
  // Use unified Claude endpoint to isolate Claude traffic
  const { sendMessage, isConnected, registerMessageHandler, connect } = useClaudeWebSocket();
  const [wsMessages, setWsMessages] = useState([]);
  useEffect(() => {
    // Subscribe to unified Claude messages via context
    const unsub = registerMessageHandler('overlay-claude', (data) => {
      setWsMessages(prev => [...prev, data]);
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, [registerMessageHandler]);
  const [clientSessionId, setClientSessionId] = useState(null); // synthetic id when real id is not yet available
  const [resumeRolloutPath, setResumeRolloutPath] = useState(null);
  
  // Claude now uses WebSocket like Codex - no need for SSE stream
  // Keeping these variables for compatibility but they're unused
  const claudeStreamConnected = isConnected; // Use WebSocket connection status
  const claudeStreamLoading = false;
  const claudeStreamError = null;
  
  // Debug sessionId changes
  useEffect(() => {
  }, [sessionId, sessionActive]);
  const [isSessionInitializing, setIsSessionInitializing] = useState(false);

  
  const [sessionStarted, setSessionStarted] = useState(false); // Track if user started a session
  const initTimerRef = useRef(null);
  // Carregar/sincronizar toggle perigoso quando o projeto mudar (usar projeto ativo do chat)
  useEffect(() => {
    try {
      if (activeProjectPath) {
        const v = localStorage.getItem(`codex-dangerous-${activeProjectPath}`) === '1';
        setDangerousMode(v);
      }
    } catch {}
  }, [activeProjectPath]);
  useEffect(() => {
    try {
      if (activeProjectPath) {
        localStorage.setItem(`codex-dangerous-${activeProjectPath}`, dangerousMode ? '1' : '0');
      }
    } catch {}
  }, [activeProjectPath, dangerousMode]);
  const [nearBottom, setNearBottom] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const [plannerMode, setPlannerMode] = useState(() => loadPlannerMode());
  const [modelLabel, setModelLabel] = useState(() => loadModelLabel());
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showProviderMenu, setShowProviderMenu] = useState(false);
  // UI preferences (temporary hard default): hide outputs/code cards from assistant/system
  const HIDE_OUTPUTS = true;
  
  // Helper functions to eliminate duplications
  const resetTypingState = useCallback(() => {
    setIsTyping(false);
    setTypingStatus({ mode: 'idle', label: '' });
    setActivityLock(false);
  }, []);
  
  const isValidSessionId = useCallback((sessionId) => {
    return sessionId && !String(sessionId).startsWith('temp-');
  }, []);
  
  const resetSessionState = useCallback(() => {
    setClaudeSessionId(null);
    setClaudeSessionActive(false);
    setClaudeMessages([]);
    setSessionMode(null);
    prevClaudeSessionIdRef.current = null;
  }, []);
  
  // Utility function to render badges in markdown content
  const renderContentBadges = useCallback((content) => {
    try {
      const text = String(content || '');
      const pieces = [];
      let rest = text;
      const keyify = (arr) => arr.map((el, idx) => (
        typeof el === 'string' ? <React.Fragment key={`t-${idx}`}>{el}</React.Fragment> : React.cloneElement(el, { key: el.key ?? `k-${idx}` })
      ));
      const badge = (cls, label) => <span className={`badge ${cls}`}>{label}</span>;
      const copyBadge = (cls, label, value) => (
        <span
          className={`badge ${cls}`}
          onClick={() => { try { navigator.clipboard.writeText(value); } catch {} }}
          title="Copy"
          style={{ cursor: 'pointer' }}
        >{label}</span>
      );
      const extToCls = (p) => {
        try {
          const ext = (p.split('.').pop() || '').toLowerCase();
          if (ext === 'js' || ext === 'jsx') return 'badge-js';
          if (ext === 'ts' || ext === 'tsx') return 'badge-ts';
          if (ext === 'md' || ext === 'markdown') return 'badge-md';
          if (ext === 'json') return 'badge-json';
          return 'badge-ref';
        } catch { return 'badge-ref'; }
      };
      
      // Leading language/file-kind badges
      if (/^(JS|TS|MD|JSON)\s+/.test(rest)) {
        const m = /^(JS|TS|MD|JSON)\s+/.exec(rest);
        const kind = m[1];
        pieces.push(badge(`badge-${kind.toLowerCase()}`, kind));
        rest = rest.slice(m[0].length);
      }
      
      // References badge
      if (/^References\b/.test(rest)) {
        pieces.push(badge('badge-ref', 'References'));
        rest = rest.replace(/^References\b\s*/, '');
        if (rest) pieces.push(<span key="tail"> {rest} </span>);
        return keyify(pieces);
      }
      
      // Trailing MODIFY badge
      if (/\sMODIFY\b/.test(rest)) {
        const idx = rest.lastIndexOf(' MODIFY');
        const before = rest.slice(0, idx);
        const after = rest.slice(idx + 1);
        pieces.push(<span key="before"> {before} </span>);
        pieces.push(badge('badge-modify', 'MODIFY'));
        const tail = after.replace(/^MODIFY\b\s*/, '');
        if (tail) pieces.push(<span key="tail"> {tail} </span>);
        return keyify(pieces);
      }
      
      // Inline path highlighting with copy (best-effort)
      const pathRegex = /(\/?[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.[a-zA-Z0-9]{1,6})/g; // /a/b/c.ext
      const parts = rest.split(pathRegex);
      if (parts.length > 1) {
        const out = [];
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (!part) continue;
          const isPath = /(\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+\.[a-zA-Z0-9]{1,6})/.test(part);
          if (isPath) {
            const label = part.length > 48 ? part.slice(0, 46) + '…' : part;
            out.push(copyBadge(extToCls(part), label, part));
            out.push(' ');
          } else {
            out.push(part);
          }
        }
        return keyify(out);
      }

      return text;
    } catch { 
      return content; 
    }
  }, []);

  // Utilities inspired by Claudable UI
  const shortenPath = (text) => {
    try {
      if (!text) return text;
      const pathPattern = /(\/[^\/\s]+(?:\/[^\/\s]+){3,}\/([^\/\s]+\.[^\/\s]+))/g;
      return String(text).replace(pathPattern, (_m, _full, filename) => `.../${filename}`);
    } catch { return text; }
  };

  const isToolUsageMessage = (content, metadata = null) => {
    try {
      const txt = String(content || '');
      if (!txt.trim()) return false;
      if (txt.includes('[object Object]')) return true;
      // Pattern used by Claudable
      const p = /\*\*(Read|LS|Glob|Grep|Edit|Write|Bash|MultiEdit|TodoWrite)\*\*\s*`?([^`\n]+)`?/;
      if (p.test(txt)) return true;
      // Our older system message sometimes: "🔧 Tool …`arg`"
      if (/^🔧\s+.+`[^`]+`/.test(txt)) return true;
      // Generic emoji tool name (e.g., "🔎 WebSearch" / "🛠 WebFetch")
      const emojiTool = /^(?:[\p{Emoji}\p{Extended_Pictographic}]\s*)?(WebSearch|WebFetch|Search)\b/iu;
      if (emojiTool.test(txt)) return true;
      return false;
    } catch { return false; }
  };

  const ToolMessage = ({ content, metadata }) => {
    try {
      const txt = String(content || '');
      let action = 'Executed';
      let filePath = '';
      let cleanContent = undefined;
      const m = /\*\*(Read|LS|Glob|Grep|Edit|Write|Bash|MultiEdit|TodoWrite)\*\*\s*`?([^`\n]+)`?/.exec(txt);
      if (m) {
        const toolName = m[1];
        const arg = m[2].trim();
        switch (toolName) {
          case 'Read': action = 'Read'; filePath = arg; break;
          case 'Edit':
          case 'MultiEdit': action = 'Edited'; filePath = arg; break;
          case 'Write': action = 'Created'; filePath = arg; break;
          case 'LS':
          case 'Glob':
          case 'Grep': action = 'Searched'; filePath = arg; break;
          case 'Bash': action = 'Executed'; filePath = arg.split('\n')[0]; break;
          case 'TodoWrite': action = 'Generated'; filePath = 'Todo List'; break;
        }
        try { if (action === 'Executed' && filePath) lastToolCommandRef.current = filePath.trim(); } catch {}
        return <ToolResultItem action={action} filePath={filePath} content={cleanContent} />;
      }
      // Our older system line: "🔧 ToolName `arg`"
      const m2 = /^🔧\s+([^`]+)\s*`([^`]+)`/.exec(txt);
      if (m2) {
        const arg = m2[2];
        try { if (arg) lastToolCommandRef.current = String(arg).trim(); } catch {}
        return <ToolResultItem action={'Executed'} filePath={arg} content={undefined} />;
      }
      return null;
    } catch { return null; }
  };

  // Parse a lightweight "References" block from plain text
  const parseReferencesBlock = (text) => {
    try {
      const lines = String(text || '').split('\n');
      let idx = lines.findIndex(l => /^\s*References\s*$/i.test(l.trim()));
      if (idx === -1) return null;
      // capture until next blank line or end
      let j = idx + 1;
      const captured = [];
      while (j < lines.length) {
        const ln = lines[j];
        if (!ln || /^\s*$/.test(ln)) break;
        captured.push(ln);
        j++;
      }
      // Extract file-like paths (with extension) and whether line indicates MODIFY
      const pathRe = /([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+\.[A-Za-z0-9]{1,6})/g;
      const items = [];
      for (const raw of captured) {
        const modify = /\bMODIFY\b/i.test(raw);
        const paths = Array.from(raw.matchAll(pathRe)).map(m => m[1]);
        for (const p of paths) {
          items.push({ path: p, modify });
        }
      }
      const before = lines.slice(0, idx).join('\n');
      const after = lines.slice(j).join('\n');
      return { before, items, after };
    } catch { return null; }
  };

  // Collapsible for long plain text paragraphs
  const ShowMoreText = ({ text, maxLines = 14, maxChars = 1200 }) => {
    try {
      const s = String(text || '');
      const lines = s.split('\n');
      const tooLong = lines.length > maxLines || s.length > maxChars;
      const [open, setOpen] = useState(false);
      if (!tooLong) return <span>{s}</span>;
      const head = lines.slice(0, maxLines).join('\n');
      const tail = lines.slice(maxLines).join('\n');
      return (
        <div className="my-1">
          <pre className="whitespace-pre-wrap leading-relaxed">{open ? s : head}</pre>
          {!open && tail && <div className="text-xs text-muted-foreground mt-1">… {lines.length - maxLines} more lines</div>}
          <button
            className="mt-1 text-xs px-2 py-0.5 rounded-md bg-muted hover:bg-accent transition"
            onClick={() => setOpen(v => !v)}
          >{open ? 'Show less' : 'Show more'}</button>
        </div>
      );
    } catch { return <span>{text}</span>; }
  };
  
  // Reset chat when provider changes
  useEffect(() => {
    // Clear input and attachments when switching providers
    setInput('');
    setAttachments([]);
    setImageAttachments([]);
    resetTypingState();
    setIsSessionInitializing(false);
    setSessionStarted(false);
    
    // Don't call endSession directly to avoid circular dependency
    // Just reset the states - the session will be ended when starting a new one
  }, [cliProvider, resetTypingState]);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const primedResumeRef = useRef(null);
  const [codexLimitStatus, setCodexLimitStatus] = useState(null); // { remaining, resetAt, raw }
  const [queueLength, setQueueLength] = useState(0);
  const [selectedModel, setSelectedModel] = useState('default');
  const { theme } = useTheme();
  const themeCodex = theme === 'dark'; // Use Codex theme only in dark mode
  // Track how current session was started: 'normal' | 'bypass' | 'resume'
  const [sessionMode, setSessionMode] = useState(null);

  // Apply runtime option changes to backend when model or plan mode changes
  const lastSentOptionsRef = useRef(null);
  const optionsRestartingRef = useRef(false);
  const sessionJustStartedRef = useRef(false);
  // Track previous session ID to detect transitions
  const prevClaudeSessionIdRef = useRef(null);
  
  useEffect(() => {
    if (!isConnected || cliProvider !== 'claude') return;
    // Only apply options when we have a real Claude session ID (avoid temp IDs/races)
    const hasRealSession = isValidSessionId(claudeSessionId);
    if (!hasRealSession) {
      // Reset the previous ID when we don't have a real session
      if (!claudeSessionId) {
        prevClaudeSessionIdRef.current = null;
      }
      return;
    }
    
    // Check if this is a session ID change (not just a re-render)
    const isSessionChange = prevClaudeSessionIdRef.current !== claudeSessionId;
    
    // If this is the first time we're getting a real session ID or transitioning from temp to real,
    // don't send options - the session was just created with the right options
    if (isSessionChange) {
      const wasNull = !prevClaudeSessionIdRef.current;
      const wasTemp = prevClaudeSessionIdRef.current && String(prevClaudeSessionIdRef.current).startsWith('temp-');
      
      // Update the previous session ID
      prevClaudeSessionIdRef.current = claudeSessionId;
      
      // Don't send options on initial session creation or temp->real transition
      if (wasNull || wasTemp) {
        return;
      }
    }
    
    // Don't send options immediately after session starts - wait for first message to be processed
    if (sessionJustStartedRef.current) {
      sessionJustStartedRef.current = false;
      return;
    }
    
    const modelMap = { 'default': null, 'opus': 'opus', 'sonnet': 'sonnet', 'opus-plan': 'opus' };
    // Do not change permission mode mid-session; only update model
    const opts = { model: modelMap[selectedModel] };
    // Skip sending if model is null/default to avoid needless restart right after start
    if (!opts.model) return;
    const sig = JSON.stringify(opts);
    if (lastSentOptionsRef.current === sig) return; // Deduplicate under StrictMode/rerenders
    lastSentOptionsRef.current = sig;
    optionsRestartingRef.current = true;
    sendMessage({ type: 'claude-set-options', options: opts });
  }, [selectedModel, isConnected, cliProvider, sendMessage, claudeSessionId]);

  // Keep CLI defaults for model; do not force any specific model here

  // Detect saved history for this project
  useEffect(() => {
    try {
      if (activeProjectPath) {
        const hasHistory = hasChatHistory(projectPath);
        const hasSession = hasLastSession(projectPath);
        
        // Debug logging
        
        // Check overlayChatSessions directly for debugging
        const overlaySessions = localStorage.getItem('overlayChatSessions');
        if (overlaySessions) {
          try {
            const data = JSON.parse(overlaySessions);
          } catch (e) {
            console.error('  - Error parsing overlayChatSessions:', e);
          }
        }
        
        setHasSaved(hasChatHistory(activeProjectPath));
        setHasSavedSession(hasLastSession(activeProjectPath));
      }
    } catch (e) {
      console.error('Error checking saved data:', e);
    }
  }, [activeProjectPath]);

  // Persist messages to localStorage (project-scoped)
  useEffect(() => {
    try {
      if (activeProjectPath && messages && messages.length) {
        saveChatHistory(activeProjectPath, messages);
        setHasSaved(true);
      }
    } catch {}
  }, [activeProjectPath, messages]);

  // Persist last session metadata when available
  useEffect(() => {
    try {
      if (activeProjectPath && sessionId && !sessionId.startsWith('temp-')) {
        saveLastSession(activeProjectPath, { sessionId, rolloutPath: resumeRolloutPath });
        setHasSavedSession(true);
      }
    } catch (e) {
      console.error('Error saving session:', e);
    }
  }, [projectPath, sessionId, resumeRolloutPath]);

  // Session helpers
  const startSession = useCallback((mode = 'normal', resumeSessionId = null) => {
    // Prevent duplicate session starts
    if (isSessionInitializing) {
      return;
    }
    
    // Also prevent starting if session is already active
    if (cliProvider === 'claude' && claudeSessionActive) {
      return;
    }
    
    const options = { projectPath: projectPath || process.cwd(), cwd: projectPath || process.cwd() };
    
    if (cliProvider === 'claude') {
      // Para Claude, abra a sessão apenas com o primeiro comando "Oi"
      if (!isConnected) {
        console.error('WebSocket not connected for Claude session');
        return;
      }

      // Não crie a sessão explicitamente; ela nasce no primeiro comando
      if (!primedResumeRef.current) {
        setClaudeSessionId(null);
        setClaudeSessionActive(false);
      }
      setIsSessionInitializing(true);
      setSessionStarted(true);
      setSessionMode(mode);

      const isResume = mode === 'resume' && !!resumeSessionId;
      const modelMap = { default: null, opus: 'opus', sonnet: 'sonnet', 'opus-plan': 'opus' };
      const greetOptions = {
        projectPath: projectPath || process.cwd(),
        cwd: projectPath || process.cwd(),
        sessionId: isResume ? resumeSessionId : null,
        resume: isResume,
        model: modelMap[selectedModel],
        images: []
      };

      // Não enviar comando automático - deixar usuário iniciar a conversa
      // Isso reduz o tempo de inicialização de ~40s para ~1s
      if (!isResume) {
        // Apenas marcar como inicializado sem enviar comando
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setActivityLock(false);
        autoGreetSentRef.current = true;
      }

      // Reduzir timeout de 40s para 10s já que não enviamos comando inicial
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
      initTimerRef.current = setTimeout(() => {
        setIsSessionInitializing(false);
        // Mensagem mais clara indicando que está pronto
        addMessage({ type: 'system', text: 'Sessão pronta. Digite sua mensagem.' });
      }, 10000);

    } else if (isConnected) {
      // For Codex, use WebSocket
      const messageType = 'codex-start-session';
      sendMessage({ type: messageType, options });
      setIsSessionInitializing(true);
      setSessionStarted(true);
      setCodexSessionActive(true);
      
      // Fallback timeout
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
      initTimerRef.current = setTimeout(() => {
        setIsSessionInitializing(false);
        addMessage({ type: 'system', text: 'Session start timeout. You can retry or continue without session.' });
      }, 8000);
    }
  }, [isConnected, sendMessage, projectPath, cliProvider, claudeStreamConnected]); // Remove addMessage from deps - it's defined after

  // Convenience actions for UI
  const startSessionNormal = useCallback(() => startSession('normal'), [startSession]);
  const startSessionBypass = useCallback(() => startSession('bypass'), [startSession]);
  const resumeLastSession = useCallback(() => {
    try {
      if (!projectPath) { addMessage({ type: 'system', text: 'Select a project to resume a session.' }); return; }
      const s = loadLastSession(projectPath);
      if (!s || !s.sessionId || String(s.sessionId).startsWith('temp-')) {
        addMessage({ type: 'system', text: 'No previous session available to resume.' });
        return;
      }
      startSession('resume', s.sessionId);
    } catch (e) {
      addMessage({ type: 'system', text: 'Failed to load last session.' });
    }
  }, [projectPath, startSession]); // addMessage defined later; safe to omit

  // Guard to ensure only user actions can truly end the session
  const allowEndRef = useRef(false);

  const endSessionCore = useCallback(() => {
    if (!allowEndRef.current) {
      try { log.debug('OverlayChatClaude: endSession blocked (non-user)'); } catch {}
      return;
    }
    try { log.debug('OverlayChatClaude: endSession invoked'); } catch {}
    setIsEnding(true);
    if (cliProvider === 'claude') {
      // For Claude, clear session state
      resetSessionState();
      // Notify server to stop streaming process
      try {
        if (isConnected) {
          sendMessage({ type: 'claude-end-session' });
        }
      } catch {}
      try { if (onSessionIdChange) onSessionIdChange(null); } catch {}
      // Could send an abort message if needed:
      // if (isConnected && claudeSessionId) {
      //   sendMessage({ type: 'claude-abort', sessionId: claudeSessionId });
      // }
    } else if (isConnected) {
      // For Codex, use WebSocket
      const messageType = 'codex-end-session';
      sendMessage({ type: messageType });
      
      // Clear session for Codex
      setCodexSessionActive(false);
      setCodexSessionId(null);
      setCodexMessages([]);
    }
    // Do not auto-close panel here; let explicit close button handle it
    setTimeout(() => {
      setIsEnding(false);
    }, 400);
  }, [isConnected, sendMessage, cliProvider, isSessionInitializing, projectPath, onPanelClosed]);

  const endSessionUser = useCallback(() => {
    allowEndRef.current = true;
    endSessionCore();
    allowEndRef.current = false;
    autoGreetSentRef.current = false;
  }, [endSessionCore]);

  // Expose controls to parent (global header)
  useEffect(() => {
    if (typeof onBindControls !== 'function') return;
    const controls = {
      end: () => { try { endSessionUser(); } catch {} },
      new: () => { try { endSessionUser(); } catch {}; setTimeout(() => startSession(), 200); }
    };
    try { onBindControls(controls); } catch {}
    return () => { try { onBindControls(null); } catch {} };
  }, [onBindControls]);

  const restartSession = useCallback(() => {
    endSessionUser();
    // Small delay to allow server to clear state
    setTimeout(() => startSession(), 200);
  }, [endSessionUser, startSession]);

  // Map tool names to small icons
  const getToolIcon = useCallback((name) => {
    const n = String(name || '').toLowerCase();
    if (n.includes('bash') || n.includes('shell')) return '💻';
    if (n.includes('edit') || n.includes('patch')) return '✏️';
    if (n.includes('git')) return '🌿';
    return '🔧';
  }, []);

  // Elapsed time for the whole "working" cycle (from start to done)
  const elapsedSec = useActivityTimer(
    activityLock || isSessionInitializing || isTyping || ['queued','busy','thinking','tool'].includes(typingStatus.mode)
  );

  // Bubble activity to parent for layout intelligence
  useEffect(() => {
    const active = activityLock || isSessionInitializing || isTyping || ['queued','busy','thinking','tool'].includes(typingStatus.mode);
    try { onActivityChange && onActivityChange(active); } catch {}
  }, [activityLock, isSessionInitializing, isTyping, typingStatus, onActivityChange]);

  // Message handling (persistent, same behavior as Codex overlay)
  const addMessage = useCallback((newMessage) => {
    setMessages(prev => {
      const timestamp = new Date().toISOString();
      const messageWithMeta = {
        ...newMessage,
        timestamp,
        id: `msg-${Date.now()}-${Math.random()}`
      };
      // Track last assistant text to avoid duplicating on 'result'
      try {
        if (newMessage?.type === 'assistant' && typeof newMessage.text === 'string') {
          lastAssistantTextRef.current = newMessage.text.trim();
        }
      } catch {}

      // Respect preference: hide "✱ Thinking..." system blocks
      if (
        hideThinking &&
        newMessage?.type === 'system' &&
        typeof newMessage.text === 'string' &&
        (newMessage.text.startsWith('Thinking…') || newMessage.text.startsWith('✱ Thinking...'))
      ) {
        return prev;
      }

      // Drop duplicate "Session Parameters" back-to-back
      if (
        prev.length > 0 &&
        newMessage.type === 'system' &&
        typeof newMessage.text === 'string' &&
        newMessage.text.startsWith('Session Parameters:')
      ) {
        const last = prev[prev.length - 1];
        if (last.type === 'system' && typeof last.text === 'string' && last.text === newMessage.text) {
          return prev; // ignore duplicate
        }
      }

      // Smart merging: combine messages from same role within 5 seconds
      if (prev.length > 0) {
        const lastMessage = prev[prev.length - 1];
        const timeDiff = new Date(timestamp).getTime() - new Date(lastMessage.timestamp).getTime();
        
        // Merge if same type, within 5 seconds, and not a tool message
        if (
          lastMessage.type === newMessage.type && 
          timeDiff < 5000 && 
          lastMessage.type === 'assistant' &&
          !lastMessage.text.includes('Using tool:')
        ) {
          // Merge content
          const mergedMessage = {
            ...lastMessage,
            text: lastMessage.text + '\n\n' + newMessage.text,
            timestamp,
            id: messageWithMeta.id
          };
          return [...prev.slice(0, -1), mergedMessage];
        }
      }
      
      return [...prev, messageWithMeta];
    });
  }, [hideThinking]);
  // Claude stream handler (processes CLAUDE-specific WS messages)
  const { processClaudeMessage } = useClaudeStreamHandler({
    claudeSessionId,
    setClaudeSessionId,
    claudeSessionActive,
    setClaudeSessionActive,
    setIsSessionInitializing,
    setIsTyping,
    setTypingStatus,
    setActivityLock,
    clientSessionId,
    setClientSessionId,
    onSessionIdChange,
    onSessionInfoChange,
    currentModel,
    setCurrentModel,
    projectPath,
    clearLastSession,
    addMessage,
    getToolIcon,
    optionsRestartingRef,
  });


  // Add message and return created id (for streaming updates)
  const addMessageAndGetId = useCallback((newMessage) => {
    const timestamp = new Date().toISOString();
    const id = `msg-${Date.now()}-${Math.random()}`;
    const messageWithMeta = { ...newMessage, timestamp, id };
    setMessages(prev => [...prev, messageWithMeta]);
    return id;
  }, []);

  // Update message text by id (append or replace)
  const updateMessageById = useCallback((id, updater) => {
    setMessages(prev => prev.map(m => m.id === id ? updater(m) : m));
    
    // Auto-scroll during streaming updates - instant scroll
    const c = messagesScrollRef.current;
    if (c && isTyping) {
      c.scrollTop = c.scrollHeight;
    }
  }, [isTyping]);

  // Restore last chat for this project
  const restoreLastChat = useCallback(() => {
    try {
      if (!activeProjectPath) return;
      const entry = loadChatHistory(activeProjectPath);
      if (entry && Array.isArray(entry.messages) && entry.messages.length) {
        // Only restore once per mount to avoid duplicate merges
        if (!restoredRef.current) {
          restoredRef.current = true;
          setMessages(entry.messages.map(m => ({
            ...m,
            id: `restored-${Date.now()}-${Math.random()}`
          })));
          if (onBeforeOpen) onBeforeOpen();
          setOpen(true);
        }
      }
    } catch {}
  }, [projectPath, onBeforeOpen]);

  // Prime resume from saved session (one-shot)
  const primeResumeFromSaved = useCallback(() => {
    if (!projectPath) return;
    try {
      const s = loadLastSession(projectPath);
      if (s && s.sessionId) {
        // Don't load temporary sessions - they're not real Claude sessions
        if (s.sessionId.startsWith('temp-')) {
          clearLastSession(projectPath); // Clear the invalid session
          return;
        }
        
        // For Claude, set the session ID to resume
        if (cliProvider === 'claude') {
          setClaudeSessionId(s.sessionId);
          setClaudeSessionActive(true);
        }
        // For Codex, set the rollout path
        primedResumeRef.current = s.rolloutPath || null;
      }
    } catch {}
  }, [projectPath, cliProvider]);

  const execStreamsRef = useRef(new Map()); // callId -> { id, buffer, lastTs }
  const processedMessagesRef = useRef(new Set()); // Track processed messages to prevent duplicates
  const lastToolLabelRef = useRef(null); // Deduplicate consecutive tool_use lines
  const lastToolCommandRef = useRef(null); // Track last bash command to avoid duplicate fenced block
  
  // Process messages from WebSocket with cleaner formatting
  useEffect(() => {
    if (wsMessages && wsMessages.length > 0) {
      const lastMsg = wsMessages[wsMessages.length - 1];
      // Let the Claude-specific handler process Claude events first
      if (cliProvider === 'claude') {
        const handled = processClaudeMessage(lastMsg);
        if (handled) {
          // Clear init timer if session is effectively started via response
          try {
            if (lastMsg.type === 'claude-response' && lastMsg.data && lastMsg.data.session_id) {
              if (initTimerRef.current) { clearTimeout(initTimerRef.current); initTimerRef.current = null; }
              setIsSessionInitializing(false);
              // Remove any lingering timeout messages
              setMessages(prev => prev.filter(m => !(m.type === 'system' && typeof m.text === 'string' && m.text.startsWith('Session start timeout'))));
            }
          } catch {}
          return;
        }
      }
      
      // Create a unique key for this message to prevent duplicate processing
      const msgKey = `${lastMsg.type}-${lastMsg.sessionId || ''}-${JSON.stringify(lastMsg)}-${wsMessages.length}`;
      if (processedMessagesRef.current.has(msgKey)) {
        return;
      }
      processedMessagesRef.current.add(msgKey);
      
      // Keep processed messages set size reasonable
      if (processedMessagesRef.current.size > 100) {
        const entries = Array.from(processedMessagesRef.current);
        processedMessagesRef.current = new Set(entries.slice(-50));
      }
      
      // Handle Claude session events - only handle claude-session-started from onSession callback
      if (lastMsg.type === 'claude-session-started' && cliProvider === 'claude') {
        if (initTimerRef.current) { clearTimeout(initTimerRef.current); initTimerRef.current = null; }
        
        log.info('Session started:', {
          type: lastMsg.type,
          sessionId: lastMsg.sessionId,
          temporary: lastMsg.temporary
        });
        
        if (lastMsg.sessionId) {
          // Prevent duplicate session handling
          if (claudeSessionId === lastMsg.sessionId) {
            return;
          }
          
          setClaudeSessionId(lastMsg.sessionId);
          setIsSessionInitializing(false);
          // claude-session-started always contains real session IDs (no more temp IDs)
          log.debug('Setting session active = true');
          setClaudeSessionActive(true);
          // Mark that session just started to prevent immediate options update
          sessionJustStartedRef.current = true;
          
          // Clear any client session ID
          if (clientSessionId) setClientSessionId(null);
          
          // Do not add another welcome here; we already inject on button press
          
          // Notify callbacks
          try { if (onSessionIdChange) onSessionIdChange(lastMsg.sessionId); } catch {}
          try { if (onSessionInfoChange) onSessionInfoChange({ sessionId: lastMsg.sessionId, model: currentModel }); } catch {}
        }
        
        setIsTyping(false);
        return;
      }
      
      if (lastMsg.type === 'session-not-found' && cliProvider === 'claude') {
        // Session expired or not found - clear it and prepare for new session
        setClaudeSessionId(null); // Clear the invalid session
        setClaudeSessionActive(false);
        clearLastSession(projectPath); // Clear from localStorage
        addMessage({ type: 'system', text: 'Previous session expired. A new session will be created.' });
        setIsSessionInitializing(false);
        setIsTyping(false);
        return;
      }
      if (lastMsg.type === 'claude-session-closed') {
        if (initTimerRef.current) { clearTimeout(initTimerRef.current); initTimerRef.current = null; }
        
        // Only process if session was actually active
        if (claudeSessionActive) {
          setClaudeSessionId(null);
          setClaudeSessionActive(false);
          if (clientSessionId) setClientSessionId(null);
          // Suppress message when closure is due to options restart
          // Keep UI clean on idle/transport closes — silently mark inactive
          optionsRestartingRef.current = false;
        }
        
        setIsSessionInitializing(false);
        setIsTyping(false);
        return;
      }
      if (lastMsg.type === 'claude-response') {
        // Process Claude streaming response
        if (lastMsg.data) {
          const data = lastMsg.data;
          if (data.message && data.message.model) {
            setCurrentModel(data.message.model);
            try { if (onSessionInfoChange) onSessionInfoChange({ sessionId: claudeSessionId || data.session_id, model: data.message.model }); } catch {}
          }
          
          // Handle different event types from Claude CLI
          if (data.type === 'system' && data.session_id) {
            // System event with session ID - just update state, don't add message
            // The message was already added by session-created event
            // Only update if we don't have a session ID or if we have a temp session ID
            if (!claudeSessionId || (claudeSessionId && String(claudeSessionId).startsWith('temp-'))) {
              // But don't update if the new session ID is the same as current one
              if (claudeSessionId !== data.session_id) {
                setClaudeSessionId(data.session_id);
                setClaudeSessionActive(true);
              }
              // Don't add duplicate message here
            }
          } else if (data.type === 'text' && data.text) {
            // Text output from Claude
            addMessage({ type: 'assistant', text: data.text });
            // Keep activity indicator via lock; update label heuristically
            setIsTyping(false);
            setTypingStatus({ mode: 'thinking', label: detectPhaseLabel(data.text) });
          } else if (data.type === 'assistant' && data.message) {
            // Assistant message from Claude CLI (new format)
            const msg = data.message;
            if (msg.content) {
              if (typeof msg.content === 'string') {
                addMessage({ type: 'assistant', text: msg.content });
                setIsTyping(false);
                setTypingStatus({ mode: 'thinking', label: detectPhaseLabel(msg.content) });
              } else if (Array.isArray(msg.content)) {
                // Handle content blocks
                let hasTextContent = false;
                let textContent = '';
                
                msg.content.forEach(block => {
                  if (block.type === 'text' && block.text) {
                    // Accumulate all text blocks
                    textContent += (textContent ? '\n' : '') + block.text;
                    hasTextContent = true;
                  } else if (block.type === 'tool_use') {
                    // tool_use may come embedded in assistant message
                    const idRaw = block.tool_use_id || block.toolUseId || block.id || '';
                    const shortId = idRaw ? String(idRaw).slice(0, 6) : null;
                    const toolNameRaw = block.name || block.tool || '';
                    const isMcp = /mcp/i.test(toolNameRaw) || /mcp/i.test(idRaw || '');
                    const toolName = toolNameRaw || (isMcp ? 'MCP tool' : 'Tool');
                    const label = `${toolName}${shortId ? ` #${shortId}` : ''}`;
                    setIsTyping(true);
                    setTypingStatus({ mode: 'tool', label });
                    lastToolLabelRef.current = label;
                  }
                });
                
                // Add accumulated text content as a single message
                if (hasTextContent && textContent) {
                  addMessage({ type: 'assistant', text: textContent });
                  setIsTyping(false);
                  setTypingStatus({ mode: 'thinking', label: detectPhaseLabel(textContent) });
                }
              }
            }
          } else if (data.type === 'thinking' || data.type === 'reasoning') {
            const content = data.content || data.text || '';
            // Mostrar "✱ Thinking..." como no terminal
            addMessage({ type: 'system', text: '✱ Thinking...' });
            if (content && content.trim()) {
              addMessage({ type: 'system', text: content });
            }
            setIsTyping(true);
            setTypingStatus({ mode: 'thinking', label: 'Thinking' });
          } else if (data.type === 'message' && data.content) {
            // Message with content (old format)
            if (typeof data.content === 'string') {
              addMessage({ type: 'assistant', text: data.content });
              setIsTyping(false);
              setTypingStatus({ mode: 'thinking', label: detectPhaseLabel(data.content) });
            } else if (Array.isArray(data.content)) {
              // Handle content blocks
              data.content.forEach(block => {
                if (block.type === 'text' && block.text) {
                  addMessage({ type: 'assistant', text: block.text });
                } else if (block.type === 'tool_use') {
                  const idRaw = block.tool_use_id || block.toolUseId || block.id || '';
                  const shortId = idRaw ? String(idRaw).slice(0, 6) : null;
                  const toolNameRaw = block.name || block.tool || '';
                  const isMcp = /mcp/i.test(toolNameRaw) || /mcp/i.test(idRaw || '');
                  const toolName = toolNameRaw || (isMcp ? 'MCP tool' : 'Tool');
                  const label = `${toolName}${shortId ? ` #${shortId}` : ''}`;
                  setIsTyping(true);
                  setTypingStatus({ mode: 'tool', label });
                  lastToolLabelRef.current = label;
                  try { setToolIndicator({ label: toolNameRaw || toolName, status: 'running' }); } catch {}
                }
              });
              setIsTyping(false);
              setTypingStatus({ mode: 'thinking', label: '' });
            }
          } else if (data.type === 'error' || data.error) {
            const err = data.error || data.message || 'Unknown error';
            addMessage({ type: 'error', text: String(err) });
            setIsTyping(false);
            setTypingStatus({ mode: 'idle', label: '' });
          } else if (data.type === 'tool_use') {
            // Tool usage notification (no noisy system message)
            const idRaw = data.tool_use_id || data.toolUseId || data.id || '';
            const shortId = idRaw ? String(idRaw).slice(0, 6) : null;
            const toolNameRaw = data.name || data.tool || '';
            const isMcp = /mcp/i.test(toolNameRaw) || /mcp/i.test(idRaw || '');
            const toolName = toolNameRaw || (isMcp ? 'MCP tool' : 'Tool');
            const label = `${toolName}${shortId ? ` #${shortId}` : ''}`;
            setIsTyping(true);
            setTypingStatus({ mode: 'tool', label });
            lastToolLabelRef.current = label;
            try { setToolIndicator({ label: toolNameRaw || toolName, status: 'running' }); } catch {}
          } else if (data.type === 'result') {
            // Capturar informações reais de contexto do Claude
            if (data.num_turns !== undefined || data.duration_ms !== undefined) {
              setContextInfo(prev => ({
                ...prev,
                num_turns: data.num_turns || prev.num_turns,
                duration_ms: data.duration_ms || prev.duration_ms,
                // Estimativa: ~750 tokens por turno em média
                estimated_tokens: (data.num_turns || prev.num_turns) * 750
              }));
            }
            
            // Final result from Claude CLI — show it like the Codex completion
            if (data.is_error) {
              const errText = typeof data.error === 'string' ? data.error : (data.error?.message || 'Unknown error');
              addMessage({ type: 'error', text: errText });
            } else if (data.result) {
              const text = typeof data.result === 'string' ? data.result : (data.result?.text || JSON.stringify(data.result, null, 2));
              if (text && text.trim()) {
                const trimmed = text.trim();
                const last = (lastAssistantTextRef.current || '').trim();
                // Avoid duplicate if assistant already emitted same text
                if (!(last && (trimmed === last || trimmed.startsWith(last)))) {
                  addMessage({ type: 'assistant', text: trimmed });
                }
              }
            }
            // Keep activity/typing until explicit completion event
            setIsTyping(true);
            setTypingStatus((s) => (s.mode === 'tool' ? s : { mode: 'thinking', label: 'Finishing…' }));
            lastToolLabelRef.current = null;
            try { setToolIndicator((ti) => ({ ...ti, status: data.is_error ? 'error' : 'success' })); } catch {}
          } else if (data.type === 'user' && data.message) {
            // User message with tool results – show results like Codex shows tool output
            const msg = data.message;
            if (msg.content && Array.isArray(msg.content)) {
              msg.content.forEach(block => {
                if (block.type === 'tool_result') {
                  // Tool completed – show the tool result as a system message
                  try {
                    const extractText = (content) => {
                      if (!content) return '';
                      if (typeof content === 'string') return content;
                      if (Array.isArray(content)) {
                        return content.map(c => (typeof c === 'string' ? c : (c?.text || ''))).filter(Boolean).join('\n');
                      }
                      if (typeof content === 'object') {
                        if (typeof content.text === 'string') return content.text;
                        if (Array.isArray(content.data)) return content.data.join('\n');
                      }
                      return '';
                    };
                    const resultText = extractText(block.content) || extractText(block.output) || '';
                    if (resultText.trim()) {
                      const lang = detectCodeLanguage(resultText);
                      const fenced = '```' + lang + '\n' + resultText.replace(/```/g, '\\u0060\\u0060\\u0060') + '\n```';
                      addMessage({ type: 'system', text: fenced });
                  } else {
                    // If no text, at least note completion
                      if (!HIDE_OUTPUTS) {
                        addMessage({ type: 'system', text: 'Tool finished.' });
                      }
                  }
                  } catch {
                    // Ignore parse errors, still end typing state
                  }
                  // Tool result received; keep typing active until run completes
                  setIsTyping(true);
                  setTypingStatus({ mode: 'thinking', label: 'Processing result…' });
                  lastToolLabelRef.current = null;
                  try { setToolIndicator((ti) => ({ ...ti, status: 'success' })); } catch {}
                }
              });
            }
          } else if (data.type === 'completion') {
            // Completion of a chunk; keep global typing until claude-complete
            setIsTyping(true);
            setTypingStatus((s) => (s.mode === 'tool' ? s : { mode: 'thinking', label: 'Finalizing…' }));
            lastToolLabelRef.current = null;
          }
        }
        return;
      }
      if (lastMsg.type === 'claude-output') {
        // Streaming output from Claude (non-JSON). Keep typing active until 'claude-complete'.
        const raw = (lastMsg.data || '').trim();
        if (!raw) return;
        // Some backends print a plain 'done' at end as a final line
        if (raw.toLowerCase() === 'done') {
          setIsTyping(false);
          setTypingStatus({ mode: 'idle', label: '' });
          setActivityLock(false);
          lastToolLabelRef.current = null;
          return;
        }
        addMessage({ type: 'assistant', text: raw });
        // Keep indicator running during streaming
        setIsTyping(true);
        setActivityLock(true);
        return;
      }
      if (lastMsg.type === 'claude-error') {
        resetTypingState();
        setActivityLock(false);
        addMessage({ type: 'error', text: lastMsg.error });
        return;
      }
      if (lastMsg.type === 'claude-complete') {
        resetTypingState();
        setActivityLock(false);
        // Optionally add a completion indicator
        if (cliProvider === 'claude') {
        }
        try {
          const audio = new Audio('/api/sounds/complete.wav');
          audio.play().catch(async () => {
            try {
              const AudioCtx = window.AudioContext || window.webkitAudioContext;
              if (!AudioCtx) return;
              const ctx = new AudioCtx();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, ctx.currentTime);
              gain.gain.setValueAtTime(0.0001, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
              gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.3);
              setTimeout(() => ctx.close && ctx.close().catch(() => {}), 400);
            } catch {}
          });
        } catch {}
        return;
      }
      
      // Normalize Codex events (ported from Vibe Kanban patterns)
      if (lastMsg.type === 'codex-session-started') {
        if (initTimerRef.current) { clearTimeout(initTimerRef.current); initTimerRef.current = null; }
        if (lastMsg.sessionId) {
          // Real session start with ID
          setSessionId(lastMsg.sessionId);
          // Replace synthetic id if any
          if (clientSessionId) setClientSessionId(null);
          if (lastMsg.rolloutPath) setResumeRolloutPath(lastMsg.rolloutPath);
          // Desabilitar salvamento automático de sessão para evitar demora na inicialização
          // Se quiser persistir sessões, o usuário deve fazê-lo explicitamente
          // if (!lastMsg.sessionId.startsWith('temp-')) {
          //   try { saveLastSession(activeProjectPath || process.cwd(), { sessionId: lastMsg.sessionId, rolloutPath: lastMsg.rolloutPath || null }, 'claude'); setHasSavedSession(true);} catch {}
          // }
          addMessage({ type: 'system', text: `Session started (${lastMsg.sessionId.slice(0, 8)}…)` });
          setIsSessionInitializing(false);
        } else {
          // Just an acknowledgment, keep waiting for real session
          // Generate a synthetic client session id for display
          if (!clientSessionId) {
            try {
              const tmp = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              setClientSessionId(tmp);
            } catch {
              const tmp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              setClientSessionId(tmp);
            }
          }
          // Set a timeout to enable input after 2 seconds even without full session ID
          setTimeout(() => {
            setIsSessionInitializing(false);
          }, 2000);
        }
        setIsTyping(false);
        return;
      }
      if (lastMsg.type === 'codex-session-closed') {
        if (initTimerRef.current) { clearTimeout(initTimerRef.current); initTimerRef.current = null; }
        
        // Only process if session was actually active
        if (codexSessionActive) {
          setCodexSessionId(null);
          setCodexSessionActive(false);
          if (clientSessionId) setClientSessionId(null);
          addMessage({ type: 'system', text: 'Session closed' });
        }
        
        setIsSessionInitializing(false);
        setIsTyping(false);
        return;
      }
      if (lastMsg.type === 'codex-error' && isSessionInitializing) {
        // Stop spinner if warmup failed
        if (initTimerRef.current) { clearTimeout(initTimerRef.current); initTimerRef.current = null; }
        setIsSessionInitializing(false);
      }

      // Meta/status passthrough (only show when real info available)
      if (lastMsg.type === 'codex-meta' && lastMsg.data) {
        try {
          const d = lastMsg.data;
          // Try to normalize common shapes
          const rate = d.rate_limit || d.rate_limits || d.limits || null;
          const remaining = rate?.remaining ?? rate?.daily_remaining ?? rate?.remaining_requests;
          const reset = rate?.reset ?? rate?.reset_at ?? rate?.next_renewal_at;
          if (remaining != null || reset != null) {
            setCodexLimitStatus({ remaining, resetAt: reset, raw: d });
            addMessage({ type: 'system', text: `Limits: ${remaining != null ? remaining : '?'} remaining${reset ? `, reset ${reset}` : ''}` });
          } else if (d.stderr && /rate limit|quota|renewal/i.test(d.stderr)) {
            addMessage({ type: 'system', text: d.stderr });
          }
        } catch {}
        return;
      }

      // Normalize based on provider
      const normalized = cliProvider === 'claude' 
        ? normalizeClaudeEvent(lastMsg) || []
        : normalizeCodexEvent(lastMsg) || [];
      if (normalized.length) {
        resetTypingState();
        normalized.forEach((m) => addMessage({ type: m.type, text: m.text }));
        return;
      }
      // Fallbacks for start/complete/tool notices
      if (lastMsg.type === 'codex-start' || lastMsg.type === 'task_started') {
        if (!isSessionInitializing) {
          setIsTyping(true);
          setTypingStatus({ mode: 'thinking', label: 'Thinking' });
          setTypingStart(Date.now());
          // elapsed timer resets automatically when active state changes
        }
        return;
      }
      if (lastMsg.type === 'codex-complete') {
        resetTypingState();
        setTypingStart(null);
        // elapsed timer resets automatically when active state changes
        setActivityLock(false);
        return;
      }
      if (lastMsg.type === 'codex-error') {
        resetTypingState();
        setTypingStart(null);
        // elapsed timer resets automatically when active state changes
        addMessage({ type: 'error', text: lastMsg.error });
        setActivityLock(false);
        return;
      }
      if (lastMsg.type === 'codex-tool') {
        const toolData = lastMsg.data;
        if (toolData && toolData.name && !['reasoning', 'thinking'].includes(toolData.name.toLowerCase())) {
          setIsTyping(true);
          setTypingStatus({ mode: 'tool', label: toolData.name });
          addMessage({ type: 'system', text: `${getToolIcon(toolData.name)} ${toolData.name}` });
          setTypingStart(Date.now());
          // elapsed timer resets automatically when active state changes
        }
        return;
      }

      // Streaming: exec begin/delta/end
      if (lastMsg.type === 'codex-exec-begin') {
        const { callId, command, cwd } = lastMsg;
        const cmdString = Array.isArray(command) ? command.join(' ') : String(command || '');
        const title = `🔧 bash\n\n\`${cmdString}\``;
        const id = addMessageAndGetId({ type: 'system', text: title });
        execStreamsRef.current.set(callId, { id, buffer: '', lastTs: Date.now() });
        setIsTyping(true);
        return;
      }
      if (lastMsg.type === 'codex-exec-delta') {
        const { callId, text = '' } = lastMsg;
        const stream = execStreamsRef.current.get(callId);
        if (stream) {
          stream.buffer += text;
          const now = Date.now();
          if (now - (stream.lastTs || 0) > 120) { // throttle updates ~8fps
            stream.lastTs = now;
            const fenced = '```bash\n' + stream.buffer.replace(/```/g, '\u0060\u0060\u0060') + '\n```';
            updateMessageById(stream.id, (m) => ({ ...m, text: m.text.split('\n\n')[0] + '\n\n' + fenced }));
          }
        }
        return;
      }
      if (lastMsg.type === 'codex-exec-end') {
        const { callId, exit_code } = lastMsg;
        const stream = execStreamsRef.current.get(callId);
        if (stream) {
          const fenced = '```bash\n' + stream.buffer.replace(/```/g, '\u0060\u0060\u0060') + '\n```';
          updateMessageById(stream.id, (m) => ({ ...m, text: m.text.split('\n\n')[0] + '\n\n' + fenced + `\n\nExit code: ${exit_code}` }));
          execStreamsRef.current.delete(callId);
        }
        setIsTyping(false);
        return;
      }
      // Queue/busy state from server
      if (lastMsg.type === 'codex-queued') {
        const pos = (typeof lastMsg.position === 'number') ? lastMsg.position + 1 : null;
        setIsTyping(true);
        setTypingStatus({ mode: 'queued', label: pos ? `Queued #${pos}` : 'Queued' });
        if (typeof lastMsg.queueLength === 'number') setQueueLength(lastMsg.queueLength);
        if (pos && pos > 1) {
          addMessage({ type: 'system', text: `Queued (position ${pos})` });
        }
        return;
      }
      if (lastMsg.type === 'codex-busy') {
        const q = (typeof lastMsg.queueLength === 'number') ? lastMsg.queueLength : 0;
        setIsTyping(true);
        setTypingStatus({ mode: 'busy', label: q > 0 ? `Busy • queue ${q}` : 'Busy' });
        setQueueLength(q);
        return;
      }
      if (lastMsg.type === 'codex-idle') {
        resetTypingState();
        setQueueLength(0);
        setActivityLock(false);
        return;
      }
      if (lastMsg.type === 'codex-aborted') {
        resetTypingState();
        setQueueLength(0);
        addMessage({ type: 'system', text: 'Aborted and cleared queue' });
        setActivityLock(false);
        return;
      }
    }
  }, [wsMessages, addMessage, cliProvider, projectPath, claudeSessionId, clientSessionId]);

  // Expose global function for element selection
  useEffect(() => {
    const fn = (html, elementData) => {
      if (!html) return;
      const tag = (elementData?.tag || 'div').toLowerCase();
      // Add as an attachment chip (do NOT send yet)
      setAttachments(prev => [...prev, { type: 'html', tag, html }]);
      setSelectedElement(elementData || null);
      if (onBeforeOpen) onBeforeOpen();
      setOpen(true);
    };
    window.pushToOverlayChat = fn;
    
    return () => {
      if (window.pushToOverlayChat === fn) {
        delete window.pushToOverlayChat;
      }
    };
  }, [addMessage]);

  // Docked mode: open via the bottom tray input or quick actions
  
  const getHost = () => {
    try {
      return previewUrl ? new URL(previewUrl).host : 'Current Page';
    } catch {
      return 'Current Page';
    }
  };

  // Heuristic language detector for tool_result blocks
  const detectCodeLanguage = (text) => {
    try {
      const t = String(text || '').trim();
      if (!t) return 'text';
      // Diffs
      if (/^(diff --git|index [0-9a-f]+\.[0-9a-f]+|--- a\/|\+\+\+ b\/)/m.test(t)) return 'diff';
      // SQL
      if (/^(SELECT|INSERT|UPDATE|DELETE)\b/i.test(t) || /\bCREATE\s+TABLE\b/i.test(t)) return 'sql';
      // HTML/XML
      if (/<[a-z][^>]*>/i.test(t) && /<\/.+>/.test(t)) return 'html';
      // TypeScript/JS (imports/exports/react)
      if (/(^|\n)\s*import\s+.+from\s+['"][^'"]+['"];?/m.test(t)) return 'tsx';
      if (/(^|\n)\s*export\s+(default|const|function|class)\b/m.test(t)) return 'tsx';
      if (/(^|\n)\s*(const|let|var)\s+\w+\s*=/.test(t) && /(=>|function|class)\b/.test(t)) return 'javascript';
      // Bash/CLI
      if (/^\$\s+.+/m.test(t)) return 'bash';
      if (/(^|\n)\s*(git|npm|pnpm|yarn|curl|wget|ls|cat|echo|chmod|chown|make)\b/.test(t)) return 'bash';
      if (/^[a-zA-Z0-9_\-.]+\s+--?[a-zA-Z0-9][^\n]*/m.test(t)) return 'bash';
      return 'text';
    } catch { return 'text'; }
  };

  // Detect if assistant text looks like planning/spec/analysis
  const detectPhaseLabel = (text) => {
    try {
      const t = String(text || '').slice(0, 400).toLowerCase();
      const first = (t.split('\n')[0] || '').trim();
      const hasPlanHead = /^(##?\s*plan\b|plan\b|plano\b|spec\b|especifica|observa|analysis|análise)/i.test(first);
      const hasKeywords = /(plan|plano|spec|especifica|analysis|análise|observa(tion|ções)?)/i.test(t);
      const looksBulleted = /\n\s*[-*]\s+/.test(t);
      return (hasPlanHead || (hasKeywords && looksBulleted)) ? 'Planning' : 'Writing';
    } catch { return 'Writing'; }
  };

  // Resolve sidebar element when needed to support portal
  const [resolvedSidebarEl, setResolvedSidebarEl] = useState(null);
  useEffect(() => {
    if (useSidebarWhenOpen && open) {
      const tryResolve = () => {
        const el = sidebarContainerRef?.current || null;
        if (el) {
          setResolvedSidebarEl(el);
        } else {
          // Try again next frame until it mounts
          requestAnimationFrame(tryResolve);
        }
      };
      tryResolve();
    } else {
      setResolvedSidebarEl(null);
    }
  }, [useSidebarWhenOpen, open, sidebarContainerRef]);

  // Handle image file selection
  const handleImageSelect = (files) => {
    const validImages = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    ).slice(0, 5); // Limit to 5 images
    
    validImages.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const newAttachment = {
          id: Date.now() + Math.random(),
          type: 'image',
          url: e.target.result,
          name: file.name,
          size: file.size
        };
        setImageAttachments(prev => [...prev, newAttachment]);
      };
      reader.readAsDataURL(file);
    });
  };

  // Shared chat panel content (can render inline or into a portal)
  const renderPanelContent = () => (
    <div className={`${embedded ? 'w-full h-full flex flex-col bg-background' : 'w-full max-h-[70vh] bg-background rounded-2xl flex flex-col overflow-hidden border border-border shadow-2xl'} relative`}>
      {isEnding && (
        <div className="absolute inset-0 z-50 bg-background/40 backdrop-blur-sm flex items-center justify-center">
          <div className="px-4 py-3 rounded-lg bg-background/90 border border-border/50 shadow-lg">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 border-2 border-destructive/40 border-t-destructive rounded-full animate-spin" />
              <div className="text-sm font-medium text-foreground">
                Ending session…
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Show provider selector and session info in embedded mode */}
      {embedded && (
        <>
          {/* Only show dropdown if provider is not fixed */}
          {!cliProviderFixed && (
            <div className="absolute top-3 right-3 z-10">
                <button
                  onClick={() => setShowProviderMenu(!showProviderMenu)}
                  className="px-2 py-1 rounded text-xs bg-background/50 hover:bg-accent/20 transition-colors flex items-center gap-1"
                  title="Switch AI Provider"
                >
                  {cliProvider === 'claude' ? (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 8v8M8 12h8"/>
                    </svg>
                  ) : (
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="6" width="12" height="12" rx="2"/>
                      <path d="M12 9v6M9 12h6"/>
                    </svg>
                  )}
                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                {showProviderMenu && (
                  <div className="absolute top-full mt-1 right-0 bg-background border border-border rounded-lg shadow-xl overflow-hidden z-50">
                    <button
                      onClick={() => {
                        setCliProvider('codex');
                        saveCliProvider('codex');
                        setShowProviderMenu(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/20 transition-colors w-full text-left ${cliProvider === 'codex' ? 'bg-accent/10 text-accent-foreground' : ''}`}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="6" y="6" width="12" height="12" rx="2"/>
                        <path d="M12 9v6M9 12h6"/>
                      </svg>
                      Codex AI
                    </button>
                    <button
                      onClick={() => {
                        setCliProvider('claude');
                        saveCliProvider('claude');
                        setShowProviderMenu(false);
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent/20 transition-colors w-full text-left ${cliProvider === 'claude' ? 'bg-accent/10 text-accent-foreground' : ''}`}
                    >
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M12 8v8M8 12h8"/>
                      </svg>
                      Claude Code
                    </button>
                  </div>
                )}
              </div>
            )}
        </>
      )}
      {!embedded && (
      <div className={`px-4 py-3 border-b border-border/30 flex items-center justify-between bg-muted/50 backdrop-blur-sm`}>
        <div className="flex items-center gap-2">
          <div className={`text-sm tracking-widest font-extrabold ${themeCodex ? 'text-zinc-400' : ''}`}>{cliProvider === 'claude' ? 'CLAUDE' : 'CODEX'}</div>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
          {/* Hide raw session id from header to keep UI clean */}
          {sessionActive && sessionMode && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-background/60 border border-border/30 font-mono text-muted-foreground/70">
              {sessionMode === 'bypass' ? 'Bypass' : sessionMode === 'resume' ? 'Resume' : 'Normal'}
            </span>
          )}
          {!sessionActive && isSessionInitializing && (
            <span className="ml-2 inline-flex items-center gap-2 text-xs opacity-80">
              <span className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin inline-block" />
              Starting…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!sessionActive && !isSessionInitializing && (
            <div className="flex">
              <div className="flex flex-col gap-1.5 p-2 rounded-2xl bg-background/40 backdrop-blur-md border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.2)]">
                <CtaButton
                  onClick={startSessionNormal}
                  variant="default"
                  className="w-full justify-center px-3 py-1.5 text-xs rounded-2xl"
                  title="Start new session"
                >
                  Start
                </CtaButton>
                <CtaButton
                  onClick={startSessionBypass}
                  variant="default"
                  className="w-full justify-center px-3 py-1.5 text-xs rounded-2xl"
                  title="Start with full permissions (bypass)"
                >
                  Bypass
                </CtaButton>
                {/* Resume removed from header; use the Resume chip above input */}
              </div>
            </div>
          )}
          {/* Only controls: End / New (no session id or mode chips per request) */}
          {(sessionActive || (sessionId && !String(sessionId).startsWith('temp-')) || messages.length > 0) && (
            <button
              onClick={() => { try { endSessionUser(); } catch {} }}
              disabled={!isConnected}
              className="w-7 h-7 rounded-full border border-white/40 bg-white/10 shadow-sm flex items-center justify-center text-white hover:bg-white/20 transition disabled:opacity-50"
              title="End session"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
          <button
            onClick={() => {
              try { if (sessionActive) endSessionUser(); } catch {}
              try { clearLastSession(projectPath); } catch {}
              try { setMessages([]); } catch {}
              try { startSessionNormal(); } catch {}
            }}
            className="w-7 h-7 rounded-full border border-white/40 bg-white/10 shadow-sm flex items-center justify-center text-white hover:bg-white/20 transition"
            title="New session"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/>
            </svg>
          </button>

          {/* Close panel (does NOT end session) */}
          <button
            onClick={() => {
              try { log.debug('OverlayChatClaude: close panel clicked'); } catch {}
              setOpen(false);
              try { if (typeof onPanelClosed === 'function') onPanelClosed(); } catch {}
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10"
            title="Close panel"
          >
            <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
          <button
            onClick={restartSession}
            disabled={!isConnected}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-50"
            title="Restart"
          >
            <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v8h8"/></svg>
          </button>
          {/* End session button removed (now using bottom-right floating control) */}
          {/* Settings removed: functionality moved to bottom segmented controls */}
        </div>
      </div>
      )}
      <div ref={messagesScrollRef} className={`${embedded ? 'flex-1 overflow-y-auto px-3 py-2 space-y-2 pb-20' : 'overflow-y-auto px-4 py-3 space-y-2 bg-transparent max-h-[50vh] pb-20'} relative`} style={{ scrollBehavior: 'auto', overflowAnchor: 'none' }}>
        {/* Removed top banner for Dangerous mode (we already have a chip near input) */}
        {codexLimitStatus && (
          <div className="mb-2 px-3 py-2 rounded-md border border-border/40 bg-muted/40 text-[11px] text-muted-foreground">
            Limits: {codexLimitStatus.remaining != null ? codexLimitStatus.remaining : '?'} remaining{codexLimitStatus.resetAt ? `, reset ${codexLimitStatus.resetAt}` : ''}
          </div>
        )}
        {/* floating controls removidos; migrados para o header */}
        {messages.length === 0 && !isTyping && !sessionActive && !isSessionInitializing && (
          <div className="flex flex-col items-center justify-center gap-3 h-full min-h-[220px] py-2">
            <div className="flex items-center gap-3">
              <CtaButton
                onClick={startSessionNormal}
                disabled={isSessionInitializing || !isConnected}
                icon={false}
                variant="default"
                size="sm"
                className="justify-center"
              >
                Start Claude
              </CtaButton>
              <CtaButton
                onClick={startSessionBypass}
                disabled={isSessionInitializing || !isConnected}
                icon={false}
                variant="default"
                size="sm"
                className="justify-center"
              >
                Start Bypass
              </CtaButton>
            </div>
            <div className="text-center select-none">
              <div className="text-sm sm:text-base font-semibold text-foreground/90">Start a new Claude session</div>
              <div className="text-muted-foreground text-xs">Arraste imagens ou pressione ⌘V para adicionar ao chat</div>
            </div>
          </div>
        )}
        {/* Hide any empty pre blocks that slip through Markdown renderers */}
        <style>{`.prose pre:empty{display:none}`}</style>
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isUser = m.type === 'user';
            const isError = m.type === 'error';
            const isSystem = m.type === 'system';
            const isAssistant = !isUser && !isError && !isSystem;
            const containerClass = isUser
              ? 'text-zinc-500'
              : isError
              ? 'text-destructive'
              : isSystem
              ? 'text-muted-foreground italic'
              : 'text-foreground';

            // Detect tool messages and extract inline command for copy
            const isToolMessage = !isError && isSystem && typeof m.text === 'string' && m.text.startsWith('🔧 ');
            const extractCommand = (txt) => {
              const match = /`([^`]+)`/.exec(txt || '');
              return match ? match[1] : '';
            };

            // Spec Card heuristic (Plan/Observations/Spec)
            // Ensure m.text is always a string
            const textContent = typeof m.text === 'string' ? m.text : (m.text?.toString() || '');
            const rawText = textContent.trim();
            const firstLine = rawText.split('\n')[0] || '';
            const looksLikeSpec = !isUser && !isError && !isSystem && /^(plan|observations|spec|plano|observa|especifica)/i.test(firstLine);
            const specTitle = looksLikeSpec ? (firstLine.length > 2 ? firstLine : 'Plan Specification') : null;

            // Rule Card heuristic ("Rule: <name>" then optional tags line)
            const linesAll = textContent.split('\n');
            const nonEmpty = linesAll.filter(l => l.trim().length > 0);
            const ruleMatch = !isUser && !isError && !isSystem && /^rule:\s*/i.test((nonEmpty[0] || ''));
            const ruleName = ruleMatch ? (nonEmpty[0].replace(/^rule:\s*/i, '').trim() || 'rule') : null;
            const ruleTags = ruleMatch && nonEmpty[1] && /,/.test(nonEmpty[1]) ? nonEmpty[1].trim() : null;

            const RuleCard = ({ children }) => {
              if (!ruleMatch) return <>{children}</>;
              // Build trimmed markdown excluding header lines
              let body = textContent;
              body = body.replace(/^\s*Rule:.*\n?/i, '');
              if (ruleTags) body = body.replace(new RegExp(`^\s*${ruleTags.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\n?`), '');
              return (
                <div className="px-0 py-0 bg-transparent border-0 shadow-none">
                  <div className="text-[11px] text-muted-foreground mb-1">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/50">Rule: {ruleName}</span>
                    {ruleTags && (<span className="ml-2 text-muted-foreground/80">{ruleTags}</span>)}
                  </div>
                  <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
                    <ReactMarkdown components={markdownComponents}>{body}</ReactMarkdown>
                  </div>
                </div>
              );
            };

            const SpecWrapper = ({ children }) => {
              if (!looksLikeSpec) return <>{children}</>;
              return (
                <div className="px-0 py-0 bg-transparent border-0 shadow-none">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600/80 text-white">✓</span>
                    <span>{specTitle}</span>
                  </div>
                  {children}
                </div>
              );
            };

            // Compact assistant text: hide verbose narrative blocks without code
            // Always show assistant responses; outputs are filtered separately

            return (
              <motion.div 
                key={m.id}
                initial={{ opacity: 0, y: 14, scale: isAssistant ? 0.995 : 1 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14 }}
                transition={{ duration: isAssistant ? 0.35 : 0.25, ease: 'easeOut' }}
                className={`w-full`}
              >
                <div className={`${containerClass} w-full max-w-none pr-2`}>
                  {/^(Updated Todo List|Lista de tarefas atualizada|TODO List:|Todo List:)/i.test(textContent) ? (
                    <div>
                      <div className="text-sm font-semibold mb-1">{(textContent.split('\n')[0] || '').trim()}</div>
                      <ul className="space-y-1 ml-1">
                        {textContent.split('\n').slice(1).filter(line => line.trim()).slice(0, 30).map((line, idx) => {
                          const checked = /(^|\s)(\[x\]|✔)/i.test(line);
                          const content = line.replace(/^[-*\d\.\)\s]+/, '');
                          return (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <input type="checkbox" disabled checked={checked} className="mt-1 rounded" />
                              <span>{content}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    isUser ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
                        <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
                      </div>
                    ) : isError ? (
                      <SpecWrapper>
                        <div className={`prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1 text-destructive`}>
                          <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
                        </div>
                      </SpecWrapper>
                    ) : isSystem ? (
                        <div className="bg-transparent relative">
                          {isToolMessage && (
                            <button
                              className="absolute -top-1 -right-1 text-[10px] px-2 py-0.5 rounded bg-background/80 border border-border/50 opacity-60 hover:opacity-100 transition-opacity"
                              title="Copy command"
                              onClick={async () => {
                                try { await navigator.clipboard.writeText(extractCommand(m.text)); } catch {}
                              }}
                            >
                              Copy
                            </button>
                          )}
                  {(() => {
                    // Try to extract a References block for compact rendering
                    const refs = parseReferencesBlock(textContent);
                    if (refs && refs.items && refs.items.length) {
                      const fileBadge = (p) => {
                        const ext = (p.split('.').pop() || '').toLowerCase();
                        const label = ext.toUpperCase();
                        const style = (() => {
                          if (ext === 'js' || ext === 'jsx') return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
                          if (ext === 'ts' || ext === 'tsx') return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
                          if (ext === 'md' || ext === 'markdown') return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                          if (ext === 'json') return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
                          return 'bg-muted text-foreground/70 border-border/60';
                        })();
                        return (
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] border ${style} mr-1`}>
                            {label}
                          </span>
                        );
                      };
                      return (
                        <div className="space-y-1">
                          {refs.before && (
                            <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1">
                              <ReactMarkdown components={markdownComponents}>{refs.before}</ReactMarkdown>
                            </div>
                          )}
                          <details className="group">
                            <summary className="list-none cursor-pointer flex items-center gap-2 px-2 py-1 rounded-md hover:bg-accent/10 w-fit">
                              <svg className="w-4 h-4 transition-transform group-open:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                              <span className="font-medium">References</span>
                            </summary>
                            <div className="mt-1 space-y-1 ml-6">
                              {refs.items.map((it, i) => (
                                <div key={`ref-${i}`} className="flex items-center gap-2 text-sm">
                                  {fileBadge(it.path)}
                                  <span title={it.path} className="px-2 py-0.5 text-xs rounded bg-muted/70 text-foreground/80">
                                    {(() => {
                                      const parts = it.path.split('/').filter(Boolean);
                                      return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : it.path;
                                    })()}
                                  </span>
                                  {it.modify && (
                                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">MODIFY</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </details>
                          {refs.after && (
                            <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1">
                              <ReactMarkdown components={markdownComponents}>{refs.after}</ReactMarkdown>
                            </div>
                          )}
                        </div>
                      );
                    }
                    if (/^✱ Thinking\.\.\./.test(textContent)) {
                      // Mostrar "✱ Thinking..." como no terminal, com indicador pulsante
                      return (
                        <div className="flex items-center gap-2 text-sm italic text-muted-foreground py-1">
                          <span className="thinking-indicator text-amber-500">✱</span>
                          <span>Thinking...</span>
                        </div>
                      );
                    }
                    if (/^Thinking…/.test(textContent)) {
                      return <ThinkingCollapsible text={textContent} />;
                    }
                    if (isToolUsageMessage(textContent)) {
                      return <ToolMessage content={textContent} />;
                    }
                    if (isToolMessage && typingStatus.mode === 'tool') {
                      return (
                        <div className="inline-flex items-center gap-2 text-sm opacity-85">
                          <span className="w-3 h-3 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin inline-block" />
                          <span className="italic">
                            <ReactMarkdown components={markdownComponentsSystem}>{textContent}</ReactMarkdown>
                          </span>
                        </div>
                      );
                    }
                    return (
                      <div className="max-w-none leading-relaxed prose prose-sm dark:prose-invert prose-pre:whitespace-pre-wrap prose-pre:break-words prose-pre:overflow-auto">
                        <ReactMarkdown components={markdownComponentsSystem}>{textContent}</ReactMarkdown>
                      </div>
                    );
                  })()}
                        </div>
                      ) : (
                        <RuleCard>
                          <SpecWrapper>
                            <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
                              <ReactMarkdown components={markdownComponents}>{textContent}</ReactMarkdown>
                            </div>
                          </SpecWrapper>
                        </RuleCard>
                      )
                  )}
                  {/* timestamps hidden */}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* Temporary feedback messages area */}
        {feedbackMessages.length > 0 && (
          <div className="space-y-1 py-2">
            <AnimatePresence>
              {feedbackMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-center gap-2 text-xs text-muted-foreground px-2"
                >
                  {msg.isLoading && (
                    <span className="w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
                  )}
                  {msg.category && getMessageIndicator(msg.category)}
                  <span className="italic">{msg.text}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
        
        {/* Status message (floating, no background) */}
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="px-2 py-1 flex items-center justify-between text-xs text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 border-2 border-primary/40 border-t-primary rounded-full animate-spin" />
              <span>{statusMessage.operation}</span>
            </div>
            {statusMessage.progress && (
              <div className="text-xs text-muted-foreground">{statusMessage.progress}</div>
            )}
          </motion.div>
        )}
        
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-muted-foreground">
            <span className="w-4 h-4 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin inline-block" />
            <span className="text-[12px]">
              {typingStatus.mode === 'tool' && typingStatus.label
                ? `${getToolIcon(typingStatus.label)} Using ${typingStatus.label} — ${elapsedSec}s`
                : typingStatus.label ? `${typingStatus.label} — ${elapsedSec}s` : `Running… ${elapsedSec}s`}
            </span>
            <button
              onClick={() => {
                if (cliProvider === 'codex') {
                  sendMessage({ type: 'codex-abort' });
                } else if (cliProvider === 'claude') {
                  sendMessage({ type: 'claude-end-session' });
                }
              }}
              className="text-[11px] px-2 py-1 rounded border border-border/50 hover:bg-white/5"
              title={cliProvider === 'codex' ? 'Abort current task and clear queue' : 'Abort current run'}
            >
              Abort
            </button>
          </motion.div>
        )}
        <div ref={bottomRef} />
        {/* bottom cluster removido: controles migraram para o topo */}
      </div>
      {/* Centered project switch prompt with blur over the chat */}
      <AnimatePresence initial={false}>
        {showProjectSwitchPrompt && (
          <motion.div
            key="project-switch"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-background/50 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="w-[min(460px,90%)] rounded-xl border border-border bg-background/95 shadow-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9"/></svg>
                <div className="text-sm font-medium">Projeto alterado</div>
              </div>
              <div className="text-[13px] text-muted-foreground mb-4">
                Você mudou para <b>{pendingProjectPath?.split('/').pop() || 'novo projeto'}</b> na página. Deseja que este chat também troque para esse projeto?
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => { setShowProjectSwitchPrompt(false); setPendingProjectPath(null); }}
                  className="px-3 py-1.5 text-xs rounded-md border border-border hover:bg-accent/20"
                >
                  Manter aqui
                </button>
                <button
                  onClick={() => { setChatProjectPath(pendingProjectPath); setShowProjectSwitchPrompt(false); setPendingProjectPath(null); }}
                  className="px-3 py-1.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  Trocar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className={`${embedded ? 'px-2 py-1.5' : 'p-3'} relative`}>
        
        {/* Floating, minimal activity indicator above input */}
        <AnimatePresence initial={false}>
          {(() => {
            const active = activityLock || isSessionInitializing || isTyping || ['queued','busy','thinking','tool'].includes(typingStatus.mode);
            if (!active) return null;
            const label = (
              isSessionInitializing ? 'Initializing session...' :
              typingStatus.mode === 'thinking' ? '✱ Thinking...' :
              (typingStatus.mode === 'tool' && typingStatus.label) ? `Using ${typingStatus.label}...` :
              typingStatus.mode === 'queued' ? (typingStatus.label || 'Queued...') :
              typingStatus.mode === 'busy' ? (typingStatus.label || 'Busy...') :
              'Working...'
            );
            
            // Diferentes indicadores para cada estado real
            const getIndicator = () => {
              switch(typingStatus.mode) {
                case 'thinking':
                  // Usa indicador simples quando está pensando (vai mostrar ✱ Thinking... no texto)
                  return null;
                case 'tool':
                  // Indicadores específicos por ferramenta
                  if (typingStatus.label?.includes('Read')) return <span className="animate-pulse text-sm text-green-500">📖</span>;
                  if (typingStatus.label?.includes('Edit')) return <span className="animate-pulse text-sm text-yellow-500">✏️</span>;
                  if (typingStatus.label?.includes('Write')) return <span className="animate-pulse text-sm text-blue-500">💾</span>;
                  if (typingStatus.label?.includes('Bash')) return <span className="animate-pulse text-sm text-purple-500">⚡</span>;
                  if (typingStatus.label?.includes('Search') || typingStatus.label?.includes('Grep')) return <span className="animate-pulse text-sm text-cyan-500">🔍</span>;
                  if (typingStatus.label?.includes('Web')) return <span className="animate-pulse text-sm text-indigo-500">🌐</span>;
                  return <span className="animate-pulse text-sm text-blue-500">🔧</span>;
                case 'queued':
                  return <span className="animate-pulse text-sm text-orange-500">⏳</span>;
                case 'busy':
                  return <span className="animate-pulse text-sm text-red-500">🔴</span>;
                default:
                  if (isSessionInitializing) return <span className="animate-pulse text-sm text-green-500">🚀</span>;
                  // Para "Working..." usa cor laranja do Claude
                  return <span className="animate-pulse text-sm text-orange-400">●</span>;
              }
            };
            
            return (
              <motion.div key="activity-input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }} className="pointer-events-none absolute -top-3 left-2 z-40 inline-flex items-center gap-2 text-[12px] text-muted-foreground">
                {typingStatus.mode === 'thinking' ? (
                  // Para thinking, mostra o ✱ com animação especial
                  <>
                    <span className="thinking-indicator text-sm text-amber-500">✱</span>
                    <span className="whitespace-nowrap">Thinking...</span>
                  </>
                ) : (
                  // Para outros estados, mostra indicador + label
                  <>
                    {getIndicator()}
                    <span className="whitespace-nowrap">{label}</span>
                  </>
                )}
                <span className="text-muted-foreground/60">• {Math.max(0, elapsedSec)}s</span>
              </motion.div>
            );
          })()}
        </AnimatePresence>
        
        {/* Slash Commands Menu - Minimalista */}
        {showSlashMenu && (
          <div className="absolute bottom-full left-0 right-0 mb-1 mx-2 bg-background/95 backdrop-blur-sm border border-border/50 rounded-md shadow-sm z-50 max-h-48 overflow-y-auto">
            {slashCommands
              .filter(cmd => cmd.command.includes(slashFilter.toLowerCase()))
              .map((cmd, index) => (
                <div
                  key={cmd.command}
                  onClick={() => {
                    setInput(cmd.command + ' ');
                    setShowSlashMenu(false);
                    trayInputRef.current?.focus();
                  }}
                  className={`flex items-center gap-2 px-2 py-1.5 hover:bg-accent/50 cursor-pointer transition-colors text-sm ${
                    index === selectedCommandIndex ? 'bg-accent/50' : ''
                  }`}
                >
                  <span className="font-mono text-primary/70">{cmd.command}</span>
                  <span className="text-xs text-muted-foreground">—</span>
                  <span className="text-xs text-muted-foreground flex-1">{cmd.description}</span>
                </div>
              ))}
          </div>
        )}
        
        <div 
          className={`${themeCodex 
            ? 'relative'
            : `rounded-2xl border ${isDragging ? 'border-primary border-2' : 'border-border'} shadow-sm transition-all duration-200 focus-within:border-primary/50 relative`}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
              <div className="text-primary font-medium">Drop images here</div>
            </div>
          )}
          {/* Image preview area */}
          {imageAttachments.length > 0 && (
            <div className="px-3 py-2 border-b border-border/40">
              <div className="flex gap-2 flex-wrap">
                {imageAttachments.map(img => (
                  <div key={img.id} className="relative group">
                    <img 
                      src={img.dataUrl} 
                      alt={img.name}
                      className="w-16 h-16 object-cover rounded-md border border-border"
                    />
                    <button
                      onClick={() => removeImageAttachment(img.id)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] px-1 rounded-b-md truncate">
                      {img.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Resume chip hidden per request */}
          {/* Segmented controls row - moved above input */}
          {/* Unified glass wrapper around header + input */}
          <div className="rounded-2xl overflow-visible bg-white/[0.04] backdrop-blur-md border border-white/12 shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
          <div className="flex items-center justify-between text-muted-foreground text-[11px] px-3 py-1 min-h-[36px] mb-0 overflow-visible flex-wrap gap-2 bg-white/8 relative">
            <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
              <button ref={projectButtonRef} onClick={() => setShowProjectMenu(v => !v)} className="relative flex items-center gap-1.5 hover:text-foreground transition-colors h-6 min-w-0" title={activeProjectPath || 'Current directory'}>
                <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>
                <span className="max-w-[120px] sm:max-w-[150px] truncate font-medium">{activeProjectPath ? activeProjectPath.split('/').pop() : 'STANDALONE_MODE'}</span>
                <svg className="w-3 h-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
              </button>
              {showProjectMenu && (
                <div ref={projectMenuRef} className="absolute z-50 bottom-full mb-1 left-3 w-60 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
                  <div className="text-[11px] px-3 py-2 text-muted-foreground border-b border-border">Switch project</div>
                  <button
                    onClick={() => { setChatProjectPath(null); setShowProjectMenu(false); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${!chatProjectPath ? 'text-foreground bg-muted/50' : 'text-muted-foreground'}`}
                  >
                    Follow app project (auto)
                  </button>
                  <div className="max-h-64 overflow-auto">
                    {(projects || []).map((p) => (
                      <button
                        key={p.name}
                        onClick={() => { setChatProjectPath(p.path || p.fullPath); setShowProjectMenu(false); }}
                        className={`w-full flex items-center justify-between gap-2 text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${chatProjectPath === (p.path || p.fullPath) ? 'text-foreground bg-muted/50' : 'text-muted-foreground'}`}
                        title={p.fullPath || p.path}
                      >
                        <span className="truncate">{p.displayName || p.name}</span>
                        {chatProjectPath === (p.path || p.fullPath) && (<svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12l5 5L20 7"/></svg>)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {chatProjectPath && projectPath && chatProjectPath !== projectPath && (
                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-border/50 whitespace-nowrap">
                  Pinned to {chatProjectPath.split('/').pop()} 
                  <button onClick={() => { setPendingProjectPath(projectPath); setShowProjectSwitchPrompt(true); }} className="underline hover:no-underline ml-1">switch</button>
                </span>
              )}
            </div>
            {cliProvider === 'claude' && (
              <div className="relative flex-shrink-0">
                <button 
                  onClick={() => setShowModelMenu(v => !v)} 
                  className="flex items-center gap-1 hover:text-foreground transition-colors h-6 text-[11px] sm:text-xs"
                >
                  <span className="hidden sm:inline text-muted-foreground">Model:</span>
                  <span className="font-medium">
                    {selectedModel === 'default' ? 'Default' : 
                     selectedModel === 'opus' ? 'Opus' :
                     selectedModel === 'sonnet' ? 'Sonnet' :
                     selectedModel === 'opus-plan' ? 'Plan' : 'Default'}
                  </span>
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </button>
                  {showModelMenu && (
                    <div className="absolute z-50 bottom-full mb-1 right-0 sm:left-0 w-48 rounded-lg border border-border bg-popover shadow-xl overflow-hidden">
                      <button 
                        onClick={() => { setSelectedModel('default'); setShowModelMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${selectedModel === 'default' ? 'text-foreground bg-muted/50' : 'text-muted-foreground'}`}
                      >
                        <div className="font-medium">Default (recommended)</div>
                        <div className="text-[10px] opacity-70">Opus 4.1 for up to 50% of usage limits, then Sonnet 4</div>
                      </button>
                      <button 
                        onClick={() => { setSelectedModel('opus'); setShowModelMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${selectedModel === 'opus' ? 'text-foreground bg-muted/50' : 'text-muted-foreground'}`}
                      >
                        <div className="font-medium">Opus</div>
                        <div className="text-[10px] opacity-70">Most capable model for complex tasks, consumes usage limits faster</div>
                      </button>
                      <button 
                        onClick={() => { setSelectedModel('sonnet'); setShowModelMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${selectedModel === 'sonnet' ? 'text-foreground bg-muted/50' : 'text-muted-foreground'}`}
                      >
                        <div className="font-medium">Sonnet</div>
                        <div className="text-[10px] opacity-70">Sonnet 4 for daily use</div>
                      </button>
                      <button 
                        onClick={() => { setSelectedModel('opus-plan'); setShowModelMenu(false); }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-muted transition-colors ${selectedModel === 'opus-plan' ? 'text-foreground bg-muted/50' : 'text-muted-foreground'}`}
                      >
                        <div className="font-medium">Opus Plan Mode</div>
                        <div className="text-[10px] opacity-70">Use Opus 4.1 in plan mode. Sonnet 4 otherwise</div>
                      </button>
                    </div>
                  )}
                </div>
              )}
              {cliProvider === 'codex' && (
                <>
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors h-6">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/><path d="M12 2v6m0 8v6m10-10h-6m-8 0H2"/></svg>
                    <span>Agent</span>
                  </button>
                  <button className="flex items-center gap-1 hover:text-foreground transition-colors h-6">
                    <span>Model:</span>
                    <span className="font-medium">gpt-5</span>
                  </button>
                </>
              )}
              {/* Match Codex overlay: Dangerous chip toggle */}
              {dangerousMode && (
                <button
                  onClick={() => setDangerousMode(false)}
                  className="flex items-center gap-1 text-yellow-500/80 hover:text-yellow-400 transition-colors h-6"
                  title="Dangerous mode active - click to disable"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                  <span>Dangerous</span>
                </button>
              )}
              {!dangerousMode && !themeCodex && (
                <button
                  onClick={() => {
                    const ok = window.confirm('Enable Dangerous mode? Codex may modify files in your real project.');
                    if (ok) setDangerousMode(true);
                  }}
                  className="opacity-0 hover:opacity-100 transition-opacity h-6"
                  title="Enable dangerous mode"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                  </svg>
                </button>
              )}
            </div>
          
          {/* Activity indicator moved to floating pill (top-right) */}

          {/* Context window indicator - minimalista e real */}
          {contextInfo.num_turns > 0 && (
            <div className="px-6 py-2 border-t border-white/10">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-mono">context: {contextInfo.num_turns} turns</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono">{Math.round(contextInfo.estimated_tokens / 1000)}k/{Math.round(contextInfo.max_context / 1000)}k</span>
                  <div className="w-20 h-1 bg-border/30 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        contextInfo.estimated_tokens / contextInfo.max_context > 0.8 ? 'bg-red-500/70' :
                        contextInfo.estimated_tokens / contextInfo.max_context > 0.6 ? 'bg-amber-500/70' :
                        'bg-green-500/70'
                      }`}
                      style={{ width: `${Math.min(100, (contextInfo.estimated_tokens / contextInfo.max_context) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Input container - transparent, only top divider to suggest separation */}
          <div className="space-y-4 bg-transparent border-t border-white/10 py-6 px-6">
            {/* Input area */}
            <div className="flex items-center gap-3">
              {/* plus */}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageSelect(e.target.files)} />
              <button onClick={() => fileInputRef.current?.click()} className="w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-all" title="Attach">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              </button>
              {/* textarea */}
              <textarea
                value={input}
                onChange={e => {
                  const value = e.target.value;
                  setInput(value);
                  
                  // Detectar comandos slash
                  if (value === '/') {
                    setShowSlashMenu(true);
                    setSlashFilter('');
                    setSelectedCommandIndex(0);
                  } else if (value.startsWith('/') && !value.includes(' ')) {
                    setShowSlashMenu(true);
                    setSlashFilter(value.slice(1));
                    setSelectedCommandIndex(0);
                  } else {
                    setShowSlashMenu(false);
                  }
                }}
                onKeyDown={handleKeyDown}
                onPaste={(e) => {
                  try {
                    const items = Array.from(e.clipboardData?.items || []);
                    const files = items.map(it => (it.kind === 'file' && it.type && it.type.startsWith('image/')) ? it.getAsFile() : null).filter(Boolean);
                    if (files.length > 0) { e.preventDefault(); handleImageSelect(files); }
                  } catch {}
                }}
                placeholder=""
                className="flex-1 text-[15px] leading-relaxed bg-transparent outline-none text-foreground placeholder:text-[#999999] resize-none py-1"
                disabled={!isConnected || (isSessionInitializing && !sessionActive)}
                rows={1}
                style={{ minHeight: '60px', maxHeight: '280px', height: 'auto', overflowY: input.split('\n').length > 4 ? 'auto' : 'hidden' }}
              />
              {/* voice (audio summary of selection) */}
              <button
                onClick={async () => {
                  try {
                    const sel = (() => {
                      const s = window.getSelection();
                      if (!s || s.isCollapsed) return '';
                      const container = messagesScrollRef.current;
                      if (!container) return s.toString();
                      let n = s.anchorNode; while (n) { if (n === container) break; n = n.parentNode; }
                      if (!n) return '';
                      return s.toString().trim();
                    })();
                    if (!sel) { addMessage({ type: 'system', text: 'Selecione um trecho da conversa para gerar áudio.' }); return; }
                    const resp = await fetch('/api/tts/gemini-summarize', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('auth-token') || ''}` },
                      body: JSON.stringify({ text: sel, voiceName: 'Zephyr' })
                    });
                    const data = await resp.json();
                    if (!resp.ok) throw new Error(data?.error || 'Falha ao gerar áudio');
                    addMessage({ type: 'system', text: '🔊 Áudio gerado', audioUrl: data.url });
                  } catch (e) {
                    addMessage({ type: 'error', text: `Falha ao gerar áudio: ${e.message}` });
                  }
                }}
                title="Resumo em áudio (seleção)"
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 1 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v2"/></svg>
              </button>

              {/* send */}
              <button
                onClick={handleSend}
                title="Send"
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-40"
                disabled={!isConnected || (isSessionInitializing && !sessionActive) || (!input.trim() && attachments.length === 0 && imageAttachments.length === 0)}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/></svg>
                {queueLength > 0 && cliProvider === 'codex' && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-4 text-center">
                    {queueLength}
                  </span>
                )}
              </button>
            </div>
          </div>
          </div>
          </div>
      </div>
    </div>
  );

  // Handle drag events
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setIsDragging(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleImageSelect(files);
    }
  };

  // Remove image attachment
  const removeImageAttachment = (id) => {
    setImageAttachments(prev => prev.filter(img => img.id !== id));
  };

  // Send message to backend (either Vibe Kanban or Node.js)
  const handleSend = async () => {
    const message = input.trim();
    
    // Processar comandos slash
    if (message.startsWith('/')) {
      const [command, ...args] = message.split(' ');
      const arg = args.join(' ');
      
      switch(command) {
        case '/clear':
          clearMessages();
          addMessage({ type: 'system', text: 'Chat history cleared' });
          setInput('');
          return;
          
        case '/reset':
          resetSession();
          addMessage({ type: 'system', text: 'Session reset' });
          setInput('');
          return;
          
        case '/help':
          const helpText = slashCommands
            .map(cmd => `${cmd.command} — ${cmd.description}`)
            .join('\n');
          addMessage({ type: 'system', text: `Available commands:\n\n${helpText}` });
          setInput('');
          return;
          
        case '/stop':
          if (isTyping) {
            handleAbort();
            addMessage({ type: 'system', text: 'Operation stopped' });
          } else {
            addMessage({ type: 'system', text: 'No operation in progress' });
          }
          setInput('');
          return;
          
        case '/export':
          const exportContent = messages.map(msg => 
            `${msg.type}: ${msg.text}`
          ).join('\n\n');
          navigator.clipboard.writeText(exportContent);
          addMessage({ type: 'system', text: 'Chat exported to clipboard' });
          setInput('');
          return;
          
        case '/model':
          // Toggle between models
          const models = ['default', 'claude-3.5-sonnet', 'claude-3.5-haiku'];
          const currentIndex = models.indexOf(selectedModel);
          const nextModel = models[(currentIndex + 1) % models.length];
          setSelectedModel(nextModel);
          addMessage({ type: 'system', text: `Model changed to ${nextModel}` });
          setInput('');
          return;
          
        case '/stats':
          addMessage({ type: 'system', text: `Session stats:\n• Messages: ${messages.length}\n• Session: ${sessionId || 'None'}\n• Model: ${selectedModel}` });
          setInput('');
          return;
          
        // Comandos personalizados
        case '/memory':
          // Abrir arquivo de memória do Claude
          addMessage({ type: 'system', text: 'Opening Claude memory file...' });
          // TODO: Implementar abertura do arquivo CLAUDE.md
          setInput('');
          return;
          
        case '/docs':
          addMessage({ type: 'system', text: 'Opening documentation...' });
          window.open('https://docs.anthropic.com/claude', '_blank');
          setInput('');
          return;
          
        case '/tools':
          addMessage({ type: 'system', text: 'Opening tools settings...' });
          // TODO: Abrir painel de configuração de ferramentas
          setInput('');
          return;
          
        case '/mcp':
          addMessage({ type: 'system', text: 'MCP servers status:\n• context7: active\n• supabase: active\n• playwright: active\n• github: active' });
          setInput('');
          return;
          
        case '/version':
          addMessage({ type: 'system', text: `Claude Code UI v1.0.0\nClaude CLI: ${sessionId ? 'connected' : 'disconnected'}` });
          setInput('');
          return;
          
        default:
          if (command.startsWith('/')) {
            addMessage({ type: 'system', text: `Unknown command: ${command}. Type /help for available commands.` });
            setInput('');
            return;
          }
      }
    }
    
    if (!message && imageAttachments.length === 0) return;
    
    // Prevent double sends
    if (isTyping) {
      return;
    }
    
    // Build message with images if present
    let displayMessage = message;
    if (imageAttachments.length > 0) {
      const imageNames = imageAttachments.map(img => img.name).join(', ');
      displayMessage = `${message}${message ? '\n\n' : ''}📎 Attached: ${imageNames}`;
    }
    
    // Build final content: attachments as code blocks + images + user text
    let prefix = '';
    if (attachments.length > 0) {
      const blocks = attachments.map((att, idx) => `Selected ${att.tag} (${idx + 1}):\n\n\u0060\u0060\u0060html\n${att.html}\n\u0060\u0060\u0060`).join('\n\n');
      prefix = blocks + '\n\n';
    }
    // Prepare images for Claude API - send as base64 data, not file paths
    let imageData = [];
    if (imageAttachments.length > 0) {
      for (const img of imageAttachments) {
        // Extract base64 data and media type from data URL
        const matches = img.url.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const mediaType = matches[1];
          const base64Data = matches[2];
          
          // Add image in Claude API format
          imageData.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: base64Data
            }
          });
        }
      }
    }
    // Apply planner/model hints ONLY for Codex, not for Claude
    let controlPrefix = '';
    let modelHint = '';
    
    if (cliProvider === 'codex') {
      // Only add planner mode for Codex
      if (plannerMode === 'Planer') {
        controlPrefix = 'You are in Planner mode. First, outline a short plan (bulleted), then execute only what is necessary. Keep outputs concise.\n\n';
      } else if (plannerMode === 'Auto') {
        controlPrefix = 'You may decide between planning or direct answer depending on user input.\n\n';
      }
      // Only add model hint for Codex
      modelHint = modelLabel ? `(model: ${modelLabel})\n\n` : '';
    }
    
    const fullMessage = controlPrefix + modelHint + prefix + message;
    
    // Show typing indicator
    setIsTyping(true);
    
    // Use WebSocket for both Claude and Codex
    if (cliProvider === 'claude') {
      // Display user message with timestamp for Claude
      addMessage({ type: 'user', text: displayMessage, images: imageAttachments });
      
      // Desabilitar auto-resume para evitar demora de 40s na inicialização
      // Apenas resumir se explicitamente solicitado pelo usuário
      let resumeSid = null;
      let shouldResume = false;
      
      // Apenas resumir se já temos uma sessão ativa E o usuário está continuando
      if (claudeSessionId && !String(claudeSessionId).startsWith('temp-') && claudeSessionActive) {
        resumeSid = claudeSessionId;
        shouldResume = true;
      }

      // Map selected model to Claude model names
      const modelMap = {
        'default': null, // Let Claude use default
        'opus': 'opus',
        'sonnet': 'sonnet', 
        'opus-plan': 'opus' // Opus with plan mode
      };
      
      // Check WebSocket connection
      if (!isConnected) {
        setIsTyping(false);
        addMessage({ type: 'error', text: 'No WebSocket connection. Please refresh the page.' });
        return;
      }
      
      // Build options for Claude command
      const options = {
        projectPath: activeProjectPath || process.cwd(),
        cwd: activeProjectPath || process.cwd(),
        sessionId: resumeSid || null,
        resume: !!shouldResume,
        model: modelMap[selectedModel],
        // Pass images as base64 data for Claude API
        images: imageData
      };
      
      // Send via WebSocket using the same format as the backend expects
      setActivityLock(true);
      sendMessage({ 
        type: 'claude-command', 
        command: fullMessage,
        options 
      });
      
    } else {
      // Display user message with timestamp for Codex
      addMessage({ type: 'user', text: displayMessage, images: imageAttachments });
      
      // Use WebSocket for Codex
      if (!isConnected) {
        setIsTyping(false);
        addMessage({ type: 'error', text: 'WebSocket not connected' });
        return;
      }
      
      const options = {
        projectPath: activeProjectPath || process.cwd(),
        cwd: activeProjectPath || process.cwd(),
        dangerous: dangerousMode,
        plannerMode,
        modelLabel,
        resumeRolloutPath: (!sessionActive && primedResumeRef.current) ? primedResumeRef.current : undefined
      };
      
      setActivityLock(true);
      // Unified endpoint expects 'codex-message' with 'message'
      sendMessage({ type: 'codex-message', message: fullMessage, options });
      // Clear one-shot resume after use
      primedResumeRef.current = null;
    }
    
    setAttachments([]);
    setImageAttachments([]);
    setInput('');
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    // Navegação no menu de comandos slash
    if (showSlashMenu) {
      const filteredCommands = slashCommands.filter(cmd => 
        cmd.command.includes(slashFilter.toLowerCase())
      );
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        return;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCommandIndex(prev => 
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        return;
      } else if (e.key === 'Tab' || (e.key === 'Enter' && filteredCommands.length > 0)) {
        e.preventDefault();
        const selected = filteredCommands[selectedCommandIndex];
        if (selected) {
          setInput(selected.command + ' ');
          setShowSlashMenu(false);
        }
        return;
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowSlashMenu(false);
        return;
      }
    }
    
    // Envio normal
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Optional: if page reloaded/disconnected and chat is empty but we have history, offer a subtle toast-like prompt
  useEffect(() => {
    try {
      if (projectPath && !messages.length && hasChatHistory(projectPath)) {
        setHasSaved(true);
      }
    } catch {}
  }, [projectPath, messages.length]);

  // Reconnect when auth token appears via storage (component may mount before login)
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === 'auth-token' && e.newValue) {
        try { connect && connect(); } catch {}
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [connect]);

  // Keep WebSocket/CLI alive: lightweight ping every 25s while connected
  useEffect(() => {
    if (!isConnected) return;
    let t = setInterval(() => {
      try { sendMessage && sendMessage({ type: 'ping' }); } catch {}
    }, 25000);
    return () => { try { clearInterval(t); } catch {} };
  }, [isConnected, sendMessage]);

  // Claude messages now come via WebSocket, not SSE stream
  // Process them in the wsMessages effect above

  // Claude now uses WebSocket - no need to establish separate SSE connection

  // Auto-scroll: instant and responsive
  useEffect(() => {
    const c = messagesScrollRef.current;
    if (!c) return;
    
    // Always scroll to bottom when typing (receiving response)
    if (isTyping) {
      c.scrollTop = c.scrollHeight;
      return;
    }
    
    // When not typing, only scroll if user was already near bottom
    const isNear = (c.scrollHeight - c.scrollTop - c.clientHeight) < 200;
    setNearBottom(isNear);
    if (isNear && messages.length > 0) {
      c.scrollTop = c.scrollHeight;
    }
  }, [messages.length, isTyping]);

  // Track scroll to toggle Jump button with debouncing
  useEffect(() => {
    const c = messagesScrollRef.current;
    if (!c) return;
    
    let scrollTimeout;
    const onScroll = () => {
      // Clear previous timeout
      if (scrollTimeout) clearTimeout(scrollTimeout);
      
      // Debounce scroll updates to reduce re-renders
      scrollTimeout = setTimeout(() => {
        const isNear = (c.scrollHeight - c.scrollTop - c.clientHeight) < 200;
        setNearBottom(isNear);
        setShowJump(!isNear);
      }, 100);
    };
    
    c.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    
    return () => {
      c.removeEventListener('scroll', onScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  // Custom components for ReactMarkdown
  // Small inline icon for language labels
  const LangIcon = ({ lang }) => {
    const l = String(lang || '').toLowerCase();
    if (l === 'bash' || l === 'sh' || l === 'zsh' || l === 'shell') {
      return (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="16" rx="2"/>
          <path d="M7 9l4 3-4 3"/>
          <path d="M13 15h4"/>
        </svg>
      );
    }
    return (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="4" y="5" width="16" height="14" rx="2"/>
        <path d="M8 9h8M8 13h8"/>
      </svg>
    );
  };

  const markdownComponents = {
    pre({ children, ...props }) {
      try {
        const getText = (n) => typeof n === 'string' ? n : (Array.isArray(n) ? n.map(getText).join('') : (n?.props ? getText(n.props.children) : ''));
        const text = getText(children).trim();
        if (!text) return null; // drop empty <pre></pre>
      } catch {}
      return (
        <pre
          {...props}
          className="bg-transparent p-0 m-0"
          style={{ background: 'transparent', padding: 0, margin: 0 }}
        >
          {children}
        </pre>
      );
    },
    code({ node, inline, className, children, ...props }) {
      const match = /(?:language|lang)-(\w+)/.exec(className || '');
      const language = match ? (match[1] || '').toLowerCase() : '';
      const raw = String(children);

      if (!inline) {
        // Skip duplicate bash command if already emitted as Tool row
        if (language === 'bash' && lastToolCommandRef.current) {
          const first = raw.split('\n')[0].trim();
          if (first && first === String(lastToolCommandRef.current)) {
            return null;
          }
        }
        // Auto-expand small blocks (<=6 lines) for better readability in assistant text
        const lineCount = raw.split('\n').length;
        const compactInline = (lineCount <= 1 && raw.length <= 48);
        if (compactInline) {
          // Render as inline chip to avoid breaking parentheses, etc.
          return (
            <code className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-border/50 bg-muted/40 text-foreground/90 font-mono text-[12px] align-middle">
              {raw}
            </code>
          );
        }
        if (lineCount <= 6) {
          const styleTheme = (theme === 'light') ? oneLight : vscDarkPlus;
          return (
            <div className="rounded-2xl border border-border bg-card p-3 md:p-4">
              <SyntaxHighlighter
                style={styleTheme}
                language={language || 'text'}
                PreTag="div"
                customStyle={{
                  margin: '0',
                  borderRadius: '0.5rem',
                  fontSize: '0.90rem',
                  width: '100%',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  background: 'transparent',
                  padding: '0'
                }}
              >
                {raw.replace(/\n$/, '')}
              </SyntaxHighlighter>
            </div>
          );
        }
        // Larger blocks remain collapsed with summary
        const blockKey = `details-${hashText(raw)}`;
        const isOpen = detailsStateStore.get(blockKey) ?? false;
        
        return (
          <details 
            className="group my-1 not-prose bg-transparent"
            open={isOpen}
            onToggle={(e) => {
              detailsStateStore.set(blockKey, e.target.open);
            }}
          >
            <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 px-0.5">
              <svg className="w-3 h-3 transition-transform group-open:rotate-90 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
              <span className="font-mono text-[10px] opacity-50">{lineCount}</span>
            </summary>
            <div className="mt-1">
              <CodeBlockCollapsible language={language || 'text'} text={raw} />
            </div>
          </details>
        );
      }

      // Inline code stays styled but minimal
      return (
        <code className="chat-inline-code" {...props}>
          {children}
        </code>
      );
    },
    a({ children, href, ...props }) {
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-primary hover:underline"
          {...props}
        >
          {children}
        </a>
      );
    },
    ul({ children, ...props }) {
      return (
        <ul className="list-disc list-outside pl-4 ml-0 my-2" {...props}>
          {children}
        </ul>
      );
    },
    ol({ children, ...props }) {
      return (
        <ol className="list-decimal list-outside pl-4 ml-0 my-2" {...props}>
          {children}
        </ol>
      );
    },
    blockquote({ children, ...props }) {
      return (
        <blockquote className="border-l-4 border-border pl-4 italic my-2 text-muted-foreground" {...props}>
          {children}
        </blockquote>
      );
    },
    h1({ children, ...props }) {
      return <h1 className="text-xl font-bold mt-3 mb-2" {...props}>{children}</h1>;
    },
    h2({ children, ...props }) {
      return <h2 className="text-lg font-semibold mt-2 mb-1" {...props}>{children}</h2>;
    },
    h3({ children, ...props }) {
      return <h3 className="text-base font-semibold mt-2 mb-1" {...props}>{children}</h3>;
    },
    p({ children, ...props }) {
      // Special light-lines like "Thought for …", or tool logs
      const asString = Array.isArray(children) && children.length === 1 && typeof children[0] === 'string'
        ? children[0]
        : (typeof children === 'string' ? children : null);
      if (typeof asString === 'string') {
        const s = shortenPath(asString.trim());
        // Tool header indicator (e.g., WebSearch)
        const headerMatch = /^([A-Z][\w\s-]{1,40})$/.exec(s.replace(/^🔧\s*/, ''));
        const header = headerMatch ? headerMatch[1] : null;
        const isToolHeader = header && /^(WebSearch|WebFetch|Search)$/i.test(header);
        if (isToolHeader) {
          const status = (toolIndicator.label && new RegExp(toolIndicator.label, 'i').test(header)) ? toolIndicator.status : (typingStatus.mode === 'tool' ? 'running' : 'idle');
          const iconKey = `tool-${header}-${status}`;
          const Icon = () => {
            if (status === 'running') return <span className="inline-block w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />;
            if (status === 'success') return (
              <svg className="w-3.5 h-3.5 text-green-500 transition duration-200 ease-out" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l2.5 2.5L16 9"/></svg>
            );
            if (status === 'error') return (
              <svg className="w-3.5 h-3.5 text-red-500 transition duration-200 ease-out" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9 9l6 6M15 9l-6 6"/></svg>
            );
            return <span className="inline-block w-3 h-3 rounded-full bg-muted-foreground/40" />;
          };
          return (
            <div className="flex items-center gap-2 my-1">
              <span key={iconKey} className="inline-flex items-center justify-center transform transition-transform duration-200 ease-out scale-100">
                <Icon />
              </span>
              <span className="text-foreground/90">{header}</span>
            </div>
          );
        }
        if (/^(Thought for \d+s?|Read\b|Grepped\b|Searched\b|Listed\b|No linter errors found|Command cancelled)/i.test(s)) {
          return <div className="text-xs text-muted-foreground my-1" {...props}>{s}</div>;
        }
        // Drop lone tool headers like "Bash", "JS" which duplicate the summary below
        if (/^(?:[\p{Emoji}\p{Extended_Pictographic}]\s*)?(Bash|JS|JavaScript|TS|TypeScript)\s*$/iu.test(s)) {
          return null;
        }
        // Long text → collapsible
        if (s.length > 1200 || s.split('\n').length > 14) {
          return <ShowMoreText text={s} />;
        }
        return <p className="my-1" {...props}>{renderContentBadges(s)}</p>;
      }
      return <p className="my-1" {...props}>{children}</p>;
    },
    // Basic task list support: - [ ] / - [x]
    li({ children, ...props }) {
      const raw = String(children && children[0] ? (children[0].props ? children[0].props.children : children[0]) : '');
      const unchecked = raw.startsWith('[ ] ') || raw.startsWith('[  ] ');
      const checked = raw.startsWith('[x] ') || raw.startsWith('[X] ');
      if (unchecked || checked) {
        const label = shortenPath(raw.replace(/^\[[xX\s]\]\s+/, ''));
        return (
          <li className="list-none my-1">
            <label className="inline-flex items-start gap-2">
              <input type="checkbox" disabled checked={checked} className="mt-1 rounded" />
              <span>{renderContentBadges(label)}</span>
            </label>
          </li>
        );
      }
      if (typeof children === 'string') {
        return <li className="my-1" {...props}>{renderContentBadges(shortenPath(children))}</li>;
      }
      if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
        return <li className="my-1" {...props}>{renderContentBadges(shortenPath(children[0]))}</li>;
      }
      return <li className="my-1" {...props}>{children}</li>;
    }
  };

  // Variant used for system/tool outputs: allow plain text fenced blocks with importance filter
  const markdownComponentsSystem = {
    ...markdownComponents,
    pre({ children, ...props }) {
      try {
        const getText = (n) => typeof n === 'string' ? n : (Array.isArray(n) ? n.map(getText).join('') : (n?.props ? getText(n.props.children) : ''));
        const text = getText(children).trim();
        if (!text) return null; // drop empty <pre></pre>
      } catch {}
      return (
        <pre
          {...props}
          className="bg-transparent p-0 m-0"
          style={{ background: 'transparent', padding: 0, margin: 0 }}
        >
          {children}
        </pre>
      );
    },
    p({ children, ...props }) {
      const asString = Array.isArray(children) && children.length === 1 && typeof children[0] === 'string'
        ? children[0] : (typeof children === 'string' ? children : null);
      if (typeof asString === 'string') {
        const s = asString.trim();
        // Drop standalone tool headers like "Bash"/"JS" which duplicate the summary below
        if (/^(?:[\p{Emoji}\p{Extended_Pictographic}]\s*)?(Bash|JS|JavaScript|TS|TypeScript)\s*$/iu.test(s)) {
          return null;
        }
      }
      return <p className="my-1" {...props}>{children}</p>;
    },
    code({ node, inline, className, children, ...props }) {
      const match = /(?:language|lang)-(\w+)/.exec(className || '');
      const language = match ? (match[1] || '').toLowerCase() : '';
      const raw = String(children);

      if (!inline) {
        const lines = raw.split('\n');
        const lineCount = lines.length;
        const important = (() => {
          const t = raw;
          if (!t.trim()) return false;
          // Hide noisy web-search dumps completely
          if (/web\s*search\s*results\s*for\s*query/i.test(t) || /\bLinks:\s*\[/i.test(t)) return false;
          if (lineCount <= 3) return true;
          return /(error|failed|exception|traceback|TS\d{3,}|TypeError|ReferenceError|SyntaxError|Build failed|Compilation error)/i.test(t);
        })();
        // Hide long, non-important outputs
        if (!important && lineCount > 10) return null;

        // Plain text outputs → minimal summary
        if (!language || ['text', 'txt', 'plain', 'plaintext'].includes(language)) {
          const plainKey = `details-plain-${hashText(raw)}`;
          const plainIsOpen = detailsStateStore.get(plainKey) ?? false;
          
          return (
            <details 
              className="group my-1 not-prose" 
              style={{ backgroundColor: 'transparent' }}
              open={plainIsOpen}
              onToggle={(e) => {
                detailsStateStore.set(plainKey, e.target.open);
              }}
            >
              <summary className="list-none cursor-pointer inline-flex items-center gap-1 text-xs text-muted-foreground/40 hover:text-muted-foreground/60 px-0.5" style={{ backgroundColor: 'transparent' }}>
                <svg className="w-3 h-3 transition-transform group-open:rotate-90 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" /></svg>
                <span className="font-mono text-[10px] opacity-50">{lineCount}</span>
              </summary>
              <pre className="mt-1 text-sm font-mono whitespace-pre-wrap break-words text-foreground/90 bg-transparent p-0">{raw}</pre>
            </details>
          );
        }
        // Non-plain languages: collapse into summary
        const langKey = `details-lang-${hashText(raw)}`;
        const langIsOpen = detailsStateStore.get(langKey) ?? false;
        
        return (
          <details 
            className="group my-1 not-prose" 
            style={{ backgroundColor: 'transparent' }}
            open={langIsOpen}
            onToggle={(e) => {
              detailsStateStore.set(langKey, e.target.open);
            }}
          >
            <summary className="list-none cursor-pointer inline-flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-muted-foreground px-1 py-0.5" style={{ backgroundColor: 'transparent' }}>
              <svg className="w-3 h-3 transition-transform group-open:rotate-90 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <span className="font-mono opacity-70">{language} • {lineCount}L</span>
            </summary>
            <div className="mt-1">
              <CodeBlockCollapsible language={language} text={raw} />
            </div>
          </details>
        );
      }
      return (
        <code className="chat-inline-code" {...props}>
          {children}
        </code>
      );
    },
  };

  // Docked panel positioning handled via absolute CSS classes

  if (embedded) {
    return (
      <div className="h-full w-full">
        {renderPanelContent()}
      </div>
    );
  }

  return (
    <>
      {/* Docked Chat Panel (expanded) */}
      {open && !disableInlinePanel && !useSidebarWhenOpen && (
        <div 
          className="absolute right-4 bottom-12 w-[min(360px,80vw)] z-50"
        >
          {renderPanelContent()}
        </div>
      )}
      {open && useSidebarWhenOpen && resolvedSidebarEl && (
        ReactDOM.createPortal(
          renderPanelContent(),
          resolvedSidebarEl
        )
      )}
      

      {/* Persistent Open Button with Provider Dropdown (provider unchanged) */}
      <div className="absolute right-4 bottom-4 z-40 flex items-center gap-2">
        {!sessionActive ? (
          <div className="flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowProviderMenu(!showProviderMenu)}
                className="px-3 py-2 rounded-l-full bg-primary/90 text-primary-foreground hover:bg-primary transition-colors text-sm flex items-center gap-1 border-r border-primary-foreground/20"
                title="Select AI Provider"
              >
                {cliProvider === 'claude' ? (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <path d="M12 8v8M8 12h8"/>
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="6" y="6" width="12" height="12" rx="2"/>
                    <path d="M12 9v6M9 12h6"/>
                  </svg>
                )}
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6"/>
                </svg>
              </button>
              {showProviderMenu && (
                <div className="absolute bottom-full mb-2 bg-background border border-border rounded-lg shadow-xl overflow-hidden">
                  <button
                    onClick={() => {
                      setCliProvider('codex');
                      saveCliProvider('codex');
                      setShowProviderMenu(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent/20 transition-colors ${cliProvider === 'codex' ? 'bg-accent/10 text-accent-foreground' : ''}`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="6" width="12" height="12" rx="2"/>
                      <path d="M12 9v6M9 12h6"/>
                    </svg>
                    Codex AI
                  </button>
                  <button
                    onClick={() => {
                      setCliProvider('claude');
                      saveCliProvider('claude');
                      setShowProviderMenu(false);
                    }}
                    className={`flex items-center gap-2 px-4 py-2 text-sm hover:bg-accent/20 transition-colors ${cliProvider === 'claude' ? 'bg-accent/10 text-accent-foreground' : ''}`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 8v8M8 12h8"/>
                    </svg>
                    Claude Code
                  </button>
                </div>
              )}
            </div>
            <CtaButton
              onClick={() => {
                if (isSessionInitializing) return;
                startSession();
                if (onBeforeOpen) onBeforeOpen();
                setOpen(true);
              }}
              title={`Start Codex AI Session for ${getHost()}`}
              disabled={isSessionInitializing || !isConnected}
            >
              {isSessionInitializing ? 'Starting…' : 'Start Codex AI Session'}
            </CtaButton>
          </div>
        ) : (
          <>
            <button
              onClick={endSession}
              className="px-3 py-2 rounded-full bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors text-xs"
              title="End Codex session"
            >
              End Session
            </button>
            {!open && (
              <CtaButton onClick={() => { if (onBeforeOpen) onBeforeOpen(); setOpen(true); }}>
                Open Chat
              </CtaButton>
            )}
          </>
        )}
        {/* Resume last session chip (outside panel) */}
        {/* Outside resume removed per request */}
      </div>
    </>
  );
});

export default OverlayChat;
