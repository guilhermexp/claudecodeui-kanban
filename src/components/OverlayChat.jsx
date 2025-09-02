import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
// ReactMarkdown is used inside extracted components
import { motion } from 'framer-motion';
import { useWebSocket } from '../utils/websocket';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { normalizeCodexEvent } from '../utils/codex-normalizer';
import { loadPlannerMode, savePlannerMode, loadModelLabel } from '../utils/chat-prefs';
import { hasChatHistory, loadChatHistory, saveChatHistory } from '../utils/chat-history';
import { hasLastSession, loadLastSession, saveLastSession, clearLastSession } from '../utils/chat-session';
import CtaButton from './ui/CtaButton';
import EmptyStateCodex from './overlay-codex/EmptyStateCodex';
import ImagePreviewList from './overlay-codex/ImagePreviewList';
import AttachmentsChips from './overlay-codex/AttachmentsChips';
import StatusStrip from './overlay-codex/StatusStrip';
import useImageUploads from './overlay-codex/useImageUploads';
import createMarkdownComponents from './overlay-codex/MarkdownConfig';
import MessageList from './overlay-codex/MessageList';

// OverlayChat (Codex) — refatorado em componentes menores

// Overlay Chat com formatação bonita usando ReactMarkdown
// Usa NOSSO backend interno (porta 7347) - sem servidores externos!
const OverlayChat = React.memo(function OverlayChat({ projectPath, previewUrl, embedded = false, disableInlinePanel = false, useSidebarWhenOpen = false, sidebarContainerRef = null, onBeforeOpen, onPanelClosed, chatId = 'default', onBindControls = null, cliProviderFixed = null, onActivityChange = null }) {
  // Debug props removed - use React DevTools for debugging
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  
  // Codex-only states
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatus, setTypingStatus] = useState({ mode: 'idle', label: '' });
  const [typingStart, setTypingStart] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  // Minimal activity lock to keep the input indicator visible during work
  const [activityLock, setActivityLock] = useState(false);
  const activityStartRef = useRef(null);
  const [selectedElement, setSelectedElement] = useState(null);
  const [attachments, setAttachments] = useState([]); // chips like "div", "span" etc
  const {
    imageAttachments,
    isDragging,
    onFileInputChange,
    onDragOver,
    onDragLeave,
    onDrop,
    removeImageAttachment,
    clearImages,
    addFiles,
  } = useImageUploads();
  const onPasteImages = useCallback((e) => {
    try {
      const items = Array.from(e.clipboardData?.items || []);
      const files = items.map(it => (it.kind === 'file' && it.type && it.type.startsWith('image/')) ? it.getAsFile() : null).filter(Boolean);
      if (files.length > 0) {
        e.preventDefault();
        if (typeof addFiles === 'function') addFiles(files);
      }
    } catch {}
  }, [addFiles]);
  const trayInputRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const [hasSaved, setHasSaved] = useState(false);
  const restoredRef = useRef(false);
  
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
  // Use unified Claude endpoint for all chat operations
  const { ws, sendMessage, messages: wsMessages, isConnected, reconnect } = useWebSocket(authReady, '/claude');
  const [clientSessionId, setClientSessionId] = useState(null); // synthetic id when real id is not yet available
  const [resumeRolloutPath, setResumeRolloutPath] = useState(null);
  
  
  // Session state tracking
  const [isSessionInitializing, setIsSessionInitializing] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false); // Track if user started a session
  const initTimerRef = useRef(null);
  // Carregar/sincronizar modo perigoso quando o projeto mudar (forçar bypass como padrão)
  useEffect(() => {
    try {
      if (projectPath) {
        const key = `codex-dangerous-${projectPath}`;
        // Force dangerous mode ON by default for Codex overlay
        localStorage.setItem(key, '1');
        setDangerousMode(true);
      }
    } catch {}
  }, [projectPath]);
  useEffect(() => {
    try {
      if (projectPath) {
        localStorage.setItem(`codex-dangerous-${projectPath}`, dangerousMode ? '1' : '0');
      }
    } catch {}
  }, [projectPath, dangerousMode]);
  const [nearBottom, setNearBottom] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const [plannerMode, setPlannerMode] = useState(() => loadPlannerMode());
  const [modelLabel, setModelLabel] = useState(() => loadModelLabel());
  const [showModeMenu, setShowModeMenu] = useState(false);
  // Report activity to parent for intelligent panel management (after state declarations)
  useEffect(() => {
    const active = activityLock || isSessionInitializing || isTyping || ['queued','busy','thinking','tool'].includes(typingStatus.mode);
    try {
      if (typeof onActivityChange === 'function') onActivityChange(active);
    } catch {}
  }, [activityLock, isSessionInitializing, isTyping, typingStatus.mode, onActivityChange]);
  const [showModelMenu, setShowModelMenu] = useState(false);
  
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const primedResumeRef = useRef(null);
  const [codexLimitStatus, setCodexLimitStatus] = useState(null); // { remaining, resetAt, raw }
  const [queueLength, setQueueLength] = useState(0);
  const [connectorMode, setConnectorMode] = useState(null); // 'subscription' | 'api' | null
  const [connectorHasKey, setConnectorHasKey] = useState(null); // boolean | null
  const { theme } = useTheme();
  const themeCodex = theme === 'dark'; // Use Codex theme only in dark mode

  // Chat input visual state

  // Do not force any model; keep CLI defaults
  // Ensure default start mode is Auto
  useEffect(() => {
    try {
      if (plannerMode !== 'Auto') {
        setPlannerMode('Auto');
        savePlannerMode('Auto');
      }
    } catch {}
  // run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detect saved history for this project
  useEffect(() => {
    try {
      if (projectPath) {
        const hasHistory = hasChatHistory(projectPath);
        const hasSession = hasLastSession(projectPath);
        
        // Check saved data for project
        
        // Check overlayChatSessions in localStorage
        const overlaySessions = localStorage.getItem('overlayChatSessions');
        if (overlaySessions) {
          try {
            const data = JSON.parse(overlaySessions);
          } catch (e) {
            console.error('  - Error parsing overlayChatSessions:', e);
          }
        }
        
        setHasSaved(hasHistory);
        setHasSavedSession(hasSession);
      }
    } catch (e) {
      console.error('Error checking saved data:', e);
    }
  }, [projectPath]);

  // Persist messages to localStorage (project-scoped)
  useEffect(() => {
    try {
      if (projectPath && messages && messages.length) {
        saveChatHistory(projectPath, messages);
        setHasSaved(true);
      }
    } catch {}
  }, [projectPath, messages]);

  // Persist last session metadata when available
  useEffect(() => {
    try {
      if (projectPath && sessionId) {
        saveLastSession(projectPath, { sessionId, rolloutPath: resumeRolloutPath });
        setHasSavedSession(true);
      }
    } catch (e) {
      console.error('Error saving session:', e);
    }
  }, [projectPath, sessionId, resumeRolloutPath]);

  // Session helpers
  const startSession = useCallback(() => {
    const options = { projectPath: projectPath || process.cwd(), cwd: projectPath || process.cwd() };
    
    if (isConnected) {
      // For Codex, use WebSocket
      const messageType = 'codex-start-session';
      sendMessage({ type: messageType, options });
      setIsSessionInitializing(true);
      setSessionStarted(true);
      setSessionActive(true);
      
      // Fallback timeout
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
      initTimerRef.current = setTimeout(() => {
        setIsSessionInitializing(false);
        addMessage({ type: 'system', text: 'Session start timeout. You can retry or continue without session.' });
      }, 8000);
    }
  }, [isConnected, sendMessage, projectPath]); // Remove addMessage from deps - it's defined after

  const endSession = useCallback(() => {
    if (isConnected) {
      // For Codex, use WebSocket
      const messageType = 'codex-end-session';
      sendMessage({ type: messageType });
      
      // Clear session for Codex
      setSessionActive(false);
      setSessionId(null);
      setMessages([]);
      setActivityLock(false);
    }
  }, [isConnected, sendMessage]);

  const restartSession = useCallback(() => {
    endSession();
    // Small delay to allow server to clear state
    setTimeout(() => startSession(), 200);
  }, [endSession, startSession]);

  // Expose controls to global header (Codex)
  useEffect(() => {
    if (typeof onBindControls !== 'function') return;
    const controls = {
      end: () => { try { if (sessionActive) endSession(); } catch {} },
      new: () => { try { if (sessionActive) endSession(); } catch {}; setTimeout(() => startSession(), 200); }
    };
    try { onBindControls(controls); } catch {}
    return () => { try { onBindControls(null); } catch {} };
  }, [onBindControls]);

  // Map tool names to small icons
  const getToolIcon = useCallback((name) => {
    const n = String(name || '').toLowerCase();
    if (n.includes('bash') || n.includes('shell')) return '💻';
    if (n.includes('edit') || n.includes('patch')) return '✏️';
    if (n.includes('git')) return '🌿';
    return '🔧';
  }, []);

  // Elapsed time while thinking/using a tool
  useEffect(() => {
    // Keep a simple timer running while there is activity
    const active = activityLock || isSessionInitializing || isTyping || ['queued','busy','thinking','tool'].includes(typingStatus.mode);
    if (active) {
      if (!activityStartRef.current) {
        activityStartRef.current = Date.now();
      }
      const start = activityStartRef.current || Date.now();
      setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      const id = setInterval(() => {
        setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      }, 1000);
      return () => clearInterval(id);
    }
    activityStartRef.current = null;
    setElapsedSec(0);
  }, [activityLock, isSessionInitializing, isTyping, typingStatus.mode]);

  // Smart message merging logic inspired by Claudable
  const addMessage = useCallback((newMessage) => {
    setMessages(prev => {
      const timestamp = new Date().toISOString();
      const messageWithMeta = {
        ...newMessage,
        timestamp,
        id: `msg-${Date.now()}-${Math.random()}`
      };

      // Respect preference: hide "Thinking…" system blocks
      if (
        hideThinking &&
        newMessage?.type === 'system' &&
        typeof newMessage.text === 'string' &&
        newMessage.text.startsWith('Thinking…')
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
      if (!projectPath) return;
      const entry = loadChatHistory(projectPath);
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
      if (s && (s.rolloutPath || s.sessionId)) {
        primedResumeRef.current = s.rolloutPath || null;
      }
    } catch {}
  }, [projectPath]);

  // Auto-resume Codex session when panel reabre e há sessão salva
  useEffect(() => {
    try {
      if (!isConnected || sessionActive || isSessionInitializing) return;
      const s = loadLastSession(projectPath || process.cwd());
      if (s?.rolloutPath) {
        const options = { projectPath: projectPath || process.cwd(), cwd: projectPath || process.cwd(), resumeRolloutPath: s.rolloutPath };
        sendMessage({ type: 'codex-start-session', options });
        setIsSessionInitializing(true);
      }
    } catch {}
    // only when connection or project changes
  }, [isConnected, projectPath]);

  const execStreamsRef = useRef(new Map()); // callId -> { id, buffer, lastTs }
  
  // Process messages from WebSocket with cleaner formatting
  useEffect(() => {
    if (wsMessages && wsMessages.length > 0) {
      const lastMsg = wsMessages[wsMessages.length - 1];
      
      // Normalize Codex events (ported from Vibe Kanban patterns)
      if (lastMsg.type === 'codex-session-started') {
        if (initTimerRef.current) { clearTimeout(initTimerRef.current); initTimerRef.current = null; }
        if (lastMsg.sessionId) {
          // Real session start with ID
          setSessionId(lastMsg.sessionId);
          // Replace synthetic id if any
          if (clientSessionId) setClientSessionId(null);
          if (lastMsg.rolloutPath) setResumeRolloutPath(lastMsg.rolloutPath);
          try { saveLastSession(projectPath || process.cwd(), { sessionId: lastMsg.sessionId, rolloutPath: lastMsg.rolloutPath || null }); setHasSavedSession(true);} catch {}
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
        setSessionId(null);
        setClientSessionId(null);
        addMessage({ type: 'system', text: 'Session closed' });
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

      // Normalize Codex events
      const normalized = normalizeCodexEvent(lastMsg) || [];
      if (normalized.length) {
        // Preserve typing indicator during streaming; only clear on complete/idle/error
        normalized.forEach((m) => addMessage({ type: m.type, text: m.text }));
        return;
      }
      // Fallbacks for start/complete/tool notices
      if (lastMsg.type === 'codex-start' || lastMsg.type === 'task_started') {
        if (!isSessionInitializing) {
          setIsTyping(true);
          setTypingStatus({ mode: 'thinking', label: 'Thinking' });
          setTypingStart(Date.now());
          setElapsedSec(0);
        }
        setActivityLock(true);
        return;
      }
      if (lastMsg.type === 'codex-complete') {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setTypingStart(null);
        setElapsedSec(0);
        setActivityLock(false);
        return;
      }
      if (lastMsg.type === 'codex-error') {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setTypingStart(null);
        setElapsedSec(0);
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
          setElapsedSec(0);
          setActivityLock(true);
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
        setActivityLock(true);
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
        setActivityLock(false);
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
        setActivityLock(true);
        return;
      }
      if (lastMsg.type === 'codex-busy') {
        const q = (typeof lastMsg.queueLength === 'number') ? lastMsg.queueLength : 0;
        setIsTyping(true);
        setTypingStatus({ mode: 'busy', label: q > 0 ? `Busy • queue ${q}` : 'Busy' });
        setQueueLength(q);
        setActivityLock(true);
        return;
      }
      if (lastMsg.type === 'codex-idle') {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setQueueLength(0);
        setActivityLock(false);
        return;
      }
      if (lastMsg.type === 'codex-aborted') {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setQueueLength(0);
        addMessage({ type: 'system', text: 'Aborted and cleared queue' });
        setActivityLock(false);
        return;
      }
      if (lastMsg.type === 'codex-connector' && lastMsg.mode) {
        setConnectorMode(lastMsg.mode);
        // refresh details
        (async () => {
          try {
            const token = localStorage.getItem('auth-token');
            if (!token) return;
            const res = await fetch('/api/codex/connector', { headers: { 'Authorization': `Bearer ${token}` } });
            if (res.ok) { const data = await res.json(); if (typeof data.hasKey === 'boolean') setConnectorHasKey(!!data.hasKey); }
          } catch {}
        })();
        return;
      }
    }
  }, [wsMessages, addMessage]);

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

  // Shared chat panel content (can render inline or into a portal)
  const renderPanelContent = () => (
    <div className={`${embedded ? 'w-full h-full flex flex-col bg-background' : themeCodex ? 'w-full max-h-[70vh] bg-zinc-900 dark:bg-black rounded-2xl flex flex-col overflow-hidden border border-zinc-700 dark:border-zinc-900' : 'w-full max-h-[70vh] chat-glass border border-border/40 rounded-2xl flex flex-col overflow-hidden shadow-2xl'}`}>
      {!embedded && (
      <div className={`${themeCodex ? 'px-3 py-2' : 'px-4 py-3'} border-b border-border/30 flex items-center justify-between ${themeCodex ? 'bg-zinc-900 dark:bg-black text-zinc-900 dark:text-white' : 'bg-muted/50 backdrop-blur-sm'}`}>
        <div className="flex items-center gap-2">
          <div className={`text-sm tracking-widest font-extrabold ${themeCodex ? 'text-zinc-400' : ''}`}>CODEX</div>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
          {/* session chip hidden to keep header clean */}
          {!sessionActive && isSessionInitializing && (
            <span className="ml-2 inline-flex items-center gap-2 text-xs opacity-80">
              <span className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin inline-block" />
              Starting…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {(sessionActive || (sessionId || clientSessionId)) && (
            <button
              onClick={() => { if (sessionActive) endSession(); setSessionId(null); setClientSessionId(null); setSessionStarted(false); clearLastSession(projectPath); setMessages([]); }}
              className="w-7 h-7 rounded-full border border-white/40 bg-white/10 shadow-sm flex items-center justify-center text-white hover:bg-white/20 transition"
              title="End session"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
            </button>
          )}
          <button
            onClick={() => { try { if (sessionActive) endSession(); } catch {}; try { clearLastSession(projectPath); } catch {}; setMessages([]); startSession(); }}
            className="w-7 h-7 rounded-full border border-white/40 bg-white/10 shadow-sm flex items-center justify-center text-white hover:bg-white/20 transition"
            title="New session"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>
          </button>
        </div>
      </div>
      )}
      <div ref={messagesScrollRef} className={`${embedded ? 'flex-1 overflow-y-auto px-3 py-2 space-y-2 pb-20' : 'overflow-y-auto px-4 py-3 space-y-2 bg-transparent max-h-[50vh] pb-20'} relative`} style={{ scrollBehavior: 'auto', overflowAnchor: 'none' }}>
        {codexLimitStatus && (
          <div className="mb-2 px-3 py-2 rounded-md border border-border/40 bg-muted/40 text-[11px] text-muted-foreground">
            Limits: {codexLimitStatus.remaining != null ? codexLimitStatus.remaining : '?'} remaining{codexLimitStatus.resetAt ? `, reset ${codexLimitStatus.resetAt}` : ''}
          </div>
        )}
        {/* session chip removed per design */}
        {/* Minimal empty state when no messages */}
        {messages.length === 0 && !isTyping && !sessionActive && !isSessionInitializing && (
          <EmptyStateCodex
            isStarting={isSessionInitializing}
            isConnected={isConnected}
            onStart={() => { setDangerousMode(true); startSession(); }}
          />
        )}
        <MessageList messages={messages} markdownComponents={markdownComponents} />
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-muted-foreground">
            <span className="w-4 h-4 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin inline-block" />
            <span className="text-[12px]">
              {typingStatus.mode === 'tool' && typingStatus.label
                ? `${getToolIcon(typingStatus.label)} Using ${typingStatus.label} — ${elapsedSec}s`
                : typingStatus.label ? `${typingStatus.label} — ${elapsedSec}s` : `Running… ${elapsedSec}s`}
            </span>
            <button
              onClick={() => sendMessage({ type: 'codex-abort' })}
              className="text-[11px] px-2 py-1 rounded border border-border/50 hover:bg-white/5"
              title="Abort current task and clear queue"
            >
              Abort
            </button>
          </motion.div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className={`${embedded ? 'px-2 py-1.5' : 'p-3'} relative ios-bottom-safe chat-input-mobile`}>
        
        {/* Image preview area */}
        <ImagePreviewList images={imageAttachments} onRemove={removeImageAttachment} />
        
        {/* Project path header and status strip - exactly like Claude */}
        {/* Unified glass wrapper */}
        <div className="rounded-2xl overflow-hidden bg-white/[0.04] backdrop-blur-md border border-white/12 shadow-[0_4px_14px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between text-muted-foreground text-[11px] px-3 py-1 min-h-[36px] mb-0 overflow-hidden flex-wrap gap-2 bg-white/8">
          <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
            <StatusStrip
              projectPath={projectPath}
              plannerMode={plannerMode}
              onPlannerChange={(m) => { setPlannerMode(m); savePlannerMode(m); }}
              modelLabel={modelLabel}
              onModelChange={(m) => { setModelLabel(m); saveModelLabel(m); }}
              working={{
                active: (activityLock || isSessionInitializing || isTyping || ['queued','busy','thinking','tool'].includes(typingStatus.mode)),
                label: (
                  isSessionInitializing ? 'Starting…' :
                  (typingStatus.mode === 'tool' && typingStatus.label) ? `Using ${typingStatus.label}…` :
                  typingStatus.mode === 'queued' ? (typingStatus.label || 'Queued…') :
                  typingStatus.mode === 'busy' ? (typingStatus.label || 'Busy…') :
                  'Working…'
                ),
                elapsedSec
              }}
            />
          </div>
        </div>
        
        {/* Input container - transparent with divider */}
        <div className="space-y-4 bg-transparent border-t border-white/10 py-6 px-6">
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 bg-primary/10 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
              <div className="text-primary font-medium">Drop images here</div>
            </div>
          )}
          
          {/* Input area */}
          <div className="flex items-center gap-3" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
              {/* plus */}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={onFileInputChange} />
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent flex items-center justify-center transition-all" 
                title="Attach"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14"/>
                </svg>
              </button>
              
              {/* textarea */}
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={onPasteImages}
                placeholder=""
                className="flex-1 text-[15px] leading-relaxed bg-transparent outline-none text-foreground placeholder:text-[#999999] resize-none py-1"
                disabled={!isConnected || (isSessionInitializing && !sessionActive)}
                rows={1}
                style={{ minHeight: '60px', maxHeight: '280px', height: 'auto', overflowY: input.split('\n').length > 4 ? 'auto' : 'hidden' }}
              />
              
              {/* send */}
              <button
                onClick={handleSend}
                title="Send"
                className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-40"
                disabled={!isConnected || (isSessionInitializing && !sessionActive) || (!input.trim() && attachments.length === 0 && imageAttachments.length === 0)}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
                {queueLength > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] leading-4 text-center">
                    {queueLength}
                  </span>
                )}
              </button>
            </div>
            
          {/* Attachments preview */}
          {attachments.length > 0 && (
            <div className={`mt-3 ${themeCodex ? 'text-zinc-300' : ''}`}>
              <AttachmentsChips attachments={attachments} />
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );

  // Image uploads handled by useImageUploads hook

  // Send message to backend (either Vibe Kanban or Node.js)
  const handleSend = async () => {
    const message = input.trim();
    if (!message && imageAttachments.length === 0) return;
    
    // Build message with images if present
    let displayMessage = message;
    if (imageAttachments.length > 0) {
      const imageNames = imageAttachments.map(img => img.name).join(', ');
      displayMessage = `${message}${message ? '\n\n' : ''}📎 Attached: ${imageNames}`;
    }
    
    // Mirror CLI defaults: send exactly the user's message
    const fullMessage = message;
    
    // Show typing indicator
    setIsTyping(true);
    
    // Display user message with timestamp for Codex
    addMessage({ type: 'user', text: displayMessage, images: imageAttachments });
    
    // Use WebSocket for Codex
    if (!isConnected) {
      setIsTyping(false);
      addMessage({ type: 'error', text: 'WebSocket not connected' });
      return;
    }
    
    // Upload images to backend to obtain file paths
    let uploadedPaths = [];
    if (imageAttachments.length > 0 && ws && ws.readyState === WebSocket.OPEN) {
      const uploadOne = (img) => new Promise((resolve) => {
        const timeout = setTimeout(() => { try { ws.removeEventListener('message', onMsg); } catch {}; resolve(null); }, 8000);
        const onMsg = (ev) => { try { const payload = JSON.parse(ev.data); if (payload.type === 'image-uploaded' && payload.fileName === img.name) { clearTimeout(timeout); ws.removeEventListener('message', onMsg); resolve(payload.path); } else if (payload.type === 'image-upload-error') { clearTimeout(timeout); ws.removeEventListener('message', onMsg); resolve(null); } } catch {} };
        try { ws.addEventListener('message', onMsg); } catch {}
        sendMessage({ type: 'upload-image', imageData: img.dataUrl, fileName: img.name });
      });
      for (const img of imageAttachments) {
        const p = await uploadOne(img);
        if (p) uploadedPaths.push(p);
      }
    }

    // If há sessão salva e nenhuma ativa, auto-prime resume do Codex
    if (!sessionActive && !primedResumeRef.current) {
      try {
        const s = loadLastSession(projectPath || process.cwd());
        if (s?.rolloutPath) primedResumeRef.current = s.rolloutPath;
      } catch {}
    }

    const options = {
      projectPath: projectPath || process.cwd(),
      cwd: projectPath || process.cwd(),
      dangerous: dangerousMode,
      plannerMode,
      modelLabel,
      images: uploadedPaths,
      resumeRolloutPath: (!sessionActive && primedResumeRef.current) ? primedResumeRef.current : undefined
    };
    
    // For Codex, include image paths in the message for visibility
    const withPaths = (uploadedPaths && uploadedPaths.length)
      ? `${fullMessage}\n\nAttached images (paths):\n${uploadedPaths.join('\n')}`
      : fullMessage;
    setActivityLock(true);
    // Unified WS expects 'codex-message' with 'message' field
    sendMessage({ type: 'codex-message', message: withPaths, options });
    // Clear one-shot resume after use
    primedResumeRef.current = null;
    
    setAttachments([]);
    clearImages();
    setInput('');
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
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
        reconnect?.();
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [reconnect]);

  // Load connector mode on mount when auth is ready
  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('auth-token');
        if (!token) return;
        const res = await fetch('/api/codex/connector', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.mode) setConnectorMode(data.mode);
          if (typeof data.hasKey === 'boolean') setConnectorHasKey(!!data.hasKey);
        }
      } catch {}
    };
    if (authReady) load();
  }, [authReady]);


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

  // Custom components for ReactMarkdown (extracted)
  const markdownComponents = createMarkdownComponents();

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
      

      {/* Persistent Open Button */}
      <div className="absolute right-4 bottom-4 z-40 flex items-center gap-2">
        {!sessionActive ? (
          <CtaButton
            onClick={() => {
              // Start session before opening the panel
              startSession();
              if (onBeforeOpen) onBeforeOpen();
              setOpen(true);
            }}
            title={`Start Codex session for ${getHost()}`}
            disabled={isSessionInitializing || !isConnected}
          >
            {isSessionInitializing ? 'Starting…' : 'Start Codex Session'}
          </CtaButton>
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
              <button
                onClick={() => { if (onBeforeOpen) onBeforeOpen(); setOpen(true); }}
                className="px-3 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors text-xs"
              >
                Open Chat
              </button>
            )}
          </>
        )}
        {/* Resume chip REMOVIDO no Codex fora do painel */}
        {false && !open && hasSavedSession && (
          <button
            onClick={() => { primeResumeFromSaved(); startSession(); restoreLastChat(); }}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 hover:bg-accent/40 transition-all text-muted-foreground hover:text-foreground text-xs border border-border/30 backdrop-blur-sm"
            title="Resume last chat session for this project"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span className="font-medium">
              {(() => {
                try {
                  const s = loadLastSession(projectPath || process.cwd());
                  const label = s?.rolloutPath ? s.rolloutPath.split('/').pop() : (s?.sessionId ? String(s.sessionId).slice(0, 8) : 'Resume');
                  return label;
                } catch { return 'Resume'; }
              })()}
            </span>
          </button>
        )}
      </div>
    </>
  );
});

export default OverlayChat;
