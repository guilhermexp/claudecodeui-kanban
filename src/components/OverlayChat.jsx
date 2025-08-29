import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { useWebSocket } from '../utils/websocket';
import { useAuth } from '../contexts/AuthContext';
import { normalizeCodexEvent } from '../utils/codex-normalizer';
import { loadPlannerMode, savePlannerMode, loadModelLabel, saveModelLabel } from '../utils/chat-prefs';
import { hasChatHistory, loadChatHistory, saveChatHistory } from '../utils/chat-history';
import { hasLastSession, loadLastSession, saveLastSession, clearLastSession } from '../utils/chat-session';

// Overlay Chat com formatação bonita usando ReactMarkdown
// Usa NOSSO backend interno (porta 7347) - sem servidores externos!
const OverlayChat = React.memo(function OverlayChat({ projectPath, previewUrl, embedded = false, disableInlinePanel = false, useSidebarWhenOpen = false, sidebarContainerRef = null, onBeforeOpen, onPanelClosed }) {
  // Debug props - only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('🎯 OverlayChat mounted with:', { 
      projectPath, 
      embedded,
      disableInlinePanel,
      useSidebarWhenOpen 
    });
  }
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatus, setTypingStatus] = useState({ mode: 'idle', label: '' });
  const [typingStart, setTypingStart] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [selectedElement, setSelectedElement] = useState(null);
  const [attachments, setAttachments] = useState([]); // chips like "div", "span" etc
  const [imageAttachments, setImageAttachments] = useState([]); // Array of image data URLs
  const [isDragging, setIsDragging] = useState(false);
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
  const { ws, sendMessage, messages: wsMessages, isConnected, reconnect } = useWebSocket(authReady);
  const [sessionId, setSessionId] = useState(null);
  const [clientSessionId, setClientSessionId] = useState(null); // synthetic id when real id is not yet available
  const [resumeRolloutPath, setResumeRolloutPath] = useState(null);
  const sessionActive = !!sessionId;
  
  // Debug sessionId changes
  useEffect(() => {
    console.log('🔍 Session ID changed:', sessionId);
    console.log('🔍 Session Active:', sessionActive);
  }, [sessionId, sessionActive]);
  const [isSessionInitializing, setIsSessionInitializing] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false); // Track if user started a session
  const initTimerRef = useRef(null);
  // Carregar/sincronizar toggle perigoso quando o projeto mudar
  useEffect(() => {
    try {
      if (projectPath) {
        const v = localStorage.getItem(`codex-dangerous-${projectPath}`) === '1';
        setDangerousMode(v);
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
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const primedResumeRef = useRef(null);
  const [codexLimitStatus, setCodexLimitStatus] = useState(null); // { remaining, resetAt, raw }
  const themeCodex = true; // enable Codex-like UI theme

  // Detect saved history for this project
  useEffect(() => {
    try {
      if (projectPath) {
        const hasHistory = hasChatHistory(projectPath);
        const hasSession = hasLastSession(projectPath);
        
        // Debug logging
        console.log('🔍 Checking saved data for project:', projectPath);
        console.log('  - Has chat history:', hasHistory);
        console.log('  - Has last session:', hasSession);
        
        // Check overlayChatSessions directly for debugging
        const overlaySessions = localStorage.getItem('overlayChatSessions');
        if (overlaySessions) {
          try {
            const data = JSON.parse(overlaySessions);
            console.log('  - overlayChatSessions data:', data[projectPath]);
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
        console.log('💾 Saving session for project:', projectPath, { sessionId, rolloutPath: resumeRolloutPath });
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
      sendMessage({ type: 'codex-start-session', options });
      setIsSessionInitializing(true);
      setSessionStarted(true); // Mark that user started a session
      // Fallback timeout: stop spinner if backend didn't confirm
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
      initTimerRef.current = setTimeout(() => {
        setIsSessionInitializing(false);
        addMessage({ type: 'system', text: 'Session start timeout. You can retry or continue without session.' });
      }, 8000);
    }
  }, [isConnected, sendMessage, projectPath]); // Remove addMessage from deps - it's defined after

  const endSession = useCallback(() => {
    if (isConnected) {
      sendMessage({ type: 'codex-end-session' });
    }
  }, [isConnected, sendMessage]);

  const restartSession = useCallback(() => {
    endSession();
    // Small delay to allow server to clear state
    setTimeout(() => startSession(), 200);
  }, [endSession, startSession]);

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
    if (isTyping && (typingStatus.mode === 'thinking' || typingStatus.mode === 'tool')) {
      const start = Date.now();
      setTypingStart(start);
      setElapsedSec(0);
      const id = setInterval(() => {
        setElapsedSec(Math.max(0, Math.floor((Date.now() - start) / 1000)));
      }, 1000);
      return () => clearInterval(id);
    } else {
      setTypingStart(null);
      setElapsedSec(0);
    }
  }, [isTyping, typingStatus.mode]);

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

  const execStreamsRef = useRef(new Map()); // callId -> { id, buffer, lastTs }
  
  // Process messages from WebSocket with cleaner formatting
  useEffect(() => {
    if (wsMessages && wsMessages.length > 0) {
      const lastMsg = wsMessages[wsMessages.length - 1];
      
      // Normalize Codex events (ported from Vibe Kanban patterns)
      if (lastMsg.type === 'codex-session-started') {
        console.log('🚀 Received codex-session-started event:', lastMsg);
        if (initTimerRef.current) { clearTimeout(initTimerRef.current); initTimerRef.current = null; }
        if (lastMsg.sessionId) {
          // Real session start with ID
          console.log('📍 Setting session ID:', lastMsg.sessionId);
          setSessionId(lastMsg.sessionId);
          // Replace synthetic id if any
          if (clientSessionId) setClientSessionId(null);
          if (lastMsg.rolloutPath) setResumeRolloutPath(lastMsg.rolloutPath);
          try { saveLastSession(projectPath || process.cwd(), { sessionId: lastMsg.sessionId, rolloutPath: lastMsg.rolloutPath || null }); setHasSavedSession(true);} catch {}
          addMessage({ type: 'system', text: `Session started (${lastMsg.sessionId.slice(0, 8)}…)` });
          setIsSessionInitializing(false);
        } else {
          // Just an acknowledgment, keep waiting for real session
          console.log('⏳ Received acknowledgment, waiting for real session ID...');
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
            console.log('⌛ Timeout reached, enabling input anyway');
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

      const normalized = normalizeCodexEvent(lastMsg) || [];
      if (normalized.length) {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
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
        return;
      }
      if (lastMsg.type === 'codex-complete') {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setTypingStart(null);
        setElapsedSec(0);
        return;
      }
      if (lastMsg.type === 'codex-error') {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setTypingStart(null);
        setElapsedSec(0);
        addMessage({ type: 'error', text: lastMsg.error });
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
    <div className={`${embedded ? 'w-full h-full flex flex-col bg-background' : themeCodex ? 'w-full max-h-[70vh] bg-black rounded-2xl flex flex-col overflow-hidden border border-zinc-900' : 'w-full max-h-[70vh] chat-glass border border-border/40 rounded-2xl flex flex-col overflow-hidden shadow-2xl'}`}>
      {/* Show minimal session info even in embedded mode */}
      {embedded && sessionActive && sessionId && (
        <div className="px-3 py-1 border-b border-border/20 bg-muted/30">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground/60 font-mono">
              Session: {sessionId.slice(0, 8)}
            </span>
          </div>
        </div>
      )}
      {!embedded && (
      <div className={`${themeCodex ? 'px-3 py-2' : 'px-4 py-3'} border-b border-border/30 flex items-center justify-between ${themeCodex ? 'bg-black text-white' : 'bg-muted/50 backdrop-blur-sm'}`}>
        <div className="flex items-center gap-2">
          <div className={`text-sm tracking-widest font-extrabold ${themeCodex ? 'text-zinc-400' : ''}`}>CODEX</div>
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
          {(sessionActive && sessionId) || clientSessionId ? (
            <span className="text-[10px] text-muted-foreground/60 font-mono" title={`Session: ${(sessionId || clientSessionId)}`}>
              {(sessionId || clientSessionId).slice(0, 8)}
            </span>
          ) : null}
          {!sessionActive && isSessionInitializing && (
            <span className="ml-2 inline-flex items-center gap-2 text-xs opacity-80">
              <span className="w-3 h-3 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin inline-block" />
              Starting…
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { startSession(); }}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10"
            title="New"
          >
            <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/><path d="M14.06 4.94l3.75 3.75"/></svg>
          </button>
          <button
            onClick={restartSession}
            disabled={!isConnected}
            className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-50"
            title="Restart"
          >
            <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 4v8h8"/></svg>
          </button>
          {/* Settings removed: functionality moved to bottom segmented controls */}
        </div>
      </div>
      )}
      <div ref={messagesScrollRef} className={`${embedded ? 'flex-1 overflow-y-auto px-3 py-2 space-y-2 pb-20' : 'overflow-y-auto px-4 py-3 space-y-2 bg-transparent max-h-[50vh] pb-20'} relative`} style={{ scrollBehavior: 'auto', overflowAnchor: 'none' }}>
        {dangerousMode && (
          <div className="mb-2 px-3 py-2 rounded-md border border-destructive/40 bg-destructive/10 text-[11px] text-destructive">
            Dangerous mode ON: commands may modify your real project.
          </div>
        )}
        {codexLimitStatus && (
          <div className="mb-2 px-3 py-2 rounded-md border border-border/40 bg-muted/40 text-[11px] text-muted-foreground">
            Limits: {codexLimitStatus.remaining != null ? codexLimitStatus.remaining : '?'} remaining{codexLimitStatus.resetAt ? `, reset ${codexLimitStatus.resetAt}` : ''}
          </div>
        )}
        {/* Floating session info and End button at top of chat */}
        {(messages.length > 0 || (!isSessionInitializing && hasSavedSession)) && (
            <div className="absolute top-2 right-2 z-50 flex items-center gap-1.5">
            {(sessionId || clientSessionId || messages.length > 0) && (
              <span className="inline-flex items-center h-6 px-2 rounded-full bg-background/80 text-[10px] text-muted-foreground/70 font-mono border border-border/30 backdrop-blur-sm">
                {sessionId || clientSessionId ? `Session: ${(sessionId || clientSessionId).slice(0, 8)}` : 'Active Session'}
              </span>
            )}
            <button
              onClick={() => {
                // End current session if active
                if (sessionActive) {
                  endSession();
                }
                // Clear session state
                setSessionId(null);
                setClientSessionId(null);
                setSessionStarted(false);
                clearLastSession(projectPath);
                // Add goodbye message
                addMessage({ type: 'system', text: '👋 Session ended' });
                // Clear session after a delay to show the message
                setTimeout(() => {
                  setMessages([]);
                  // Clear chat history for this project
                  try {
                    if (projectPath) {
                      localStorage.removeItem(`codex-chat-history-${projectPath}`);
                    }
                  } catch {}
                }, 2000);
              }}
              className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-background/80 hover:bg-destructive/20 transition-all text-muted-foreground hover:text-destructive text-[10px] border border-border/30 backdrop-blur-sm"
              title="End session"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        )}
        {messages.length === 0 && !isTyping && !sessionStarted && (
          <div className={`flex items-center justify-center ${themeCodex ? 'h-[50vh] bg-black' : 'h-full min-h-[200px]'} `}>
            <div className="opacity-30">
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" className={`${themeCodex ? 'text-zinc-600' : 'text-foreground'}`}>
                <path strokeWidth="1.5" d="M12 3a9 9 0 100 18 9 9 0 000-18Zm0 4a5 5 0 100 10 5 5 0 000-10Z"/>
              </svg>
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {messages.map((m) => {
            const isUser = m.type === 'user';
            const isError = m.type === 'error';
            const isSystem = m.type === 'system';
            const containerClass = isUser
              ? 'text-foreground text-left px-3 py-2 rounded-lg bg-accent/20 border border-accent/30'
              : isError
              ? 'px-4 py-3 rounded-2xl shadow-sm bg-destructive/10 text-destructive border border-destructive/20'
              : isSystem
              ? 'text-muted-foreground italic'
              : 'text-foreground'; // assistant: no background/padding, plain text
            
            // Detect tool messages and extract inline command for copy
            const isToolMessage = !isError && isSystem && typeof m.text === 'string' && m.text.startsWith('🔧 ');
            const extractCommand = (txt) => {
              const match = /`([^`]+)`/.exec(txt || '');
              return match ? match[1] : '';
            };
            
            // Spec Card heuristic (Plan/Observations/Spec)
            const rawText = (m.text || '').trim();
            const firstLine = rawText.split('\n')[0] || '';
            const looksLikeSpec = !isUser && !isError && !isSystem && /^(plan|observations|spec|plano|observa|especifica)/i.test(firstLine);
            const specTitle = looksLikeSpec ? (firstLine.length > 2 ? firstLine : 'Plan Specification') : null;

            const SpecWrapper = ({ children }) => {
              if (!looksLikeSpec) return <>{children}</>;
              return (
                <div className="rounded-2xl border border-border/60 bg-muted/10 px-3 py-2 shadow-sm">
                  <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-600/80 text-white">✓</span>
                    <span>{specTitle}</span>
                  </div>
                  {children}
                </div>
              );
            };

            // ExpandableMessage removed – always show full content
            return (
              <motion.div key={m.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.25 }} className="w-full">
                <div className={`${containerClass} ${isUser ? 'ml-auto max-w-[85%]' : 'mr-auto max-w-[85%]'}`}>
                  {/^(Updated Todo List|Lista de tarefas atualizada|TODO List:|Todo List:)/i.test(m.text || '') ? (
                    <div>
                      <div className="text-sm font-semibold mb-1">{(m.text.split('\n')[0] || '').trim()}</div>
                      <ul className="space-y-1 ml-1">
                        {m.text.split('\n').slice(1).filter(line => line.trim()).slice(0, 30).map((line, idx) => {
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
                    (isUser || isError)
                      ? (
                        <SpecWrapper>
                        <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
                          <ReactMarkdown components={markdownComponents}>{m.text}</ReactMarkdown>
                        </div>
                        </SpecWrapper>
                      ) : isSystem ? (
                        <div className="relative">
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
                          <SpecWrapper>
                            <div className={`prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1 ${isSystem ? 'opacity-80' : ''}`}>
                              <ReactMarkdown components={markdownComponents}>{m.text}</ReactMarkdown>
                            </div>
                          </SpecWrapper>
                        </div>
                      ) : (
                        <SpecWrapper>
                          <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed prose-p:my-1 prose-li:my-1">
                            <ReactMarkdown components={markdownComponents}>{m.text}</ReactMarkdown>
                          </div>
                        </SpecWrapper>
                      )
                  )}
                  {/* timestamps hidden */}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-muted-foreground">
            <span className="w-4 h-4 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin inline-block" />
            <span className="text-[12px]">
              {typingStatus.mode === 'tool' && typingStatus.label
                ? `${getToolIcon(typingStatus.label)} Using ${typingStatus.label} — ${elapsedSec}s`
                : `Running… ${elapsedSec}s`}
            </span>
          </motion.div>
        )}
        <div ref={bottomRef} />
        {showJump && (
          <div className="absolute bottom-4 right-4 z-30">
            <button
              onClick={() => { const c = messagesScrollRef.current; if (c) c.scrollTop = c.scrollHeight; }}
              className="w-8 h-8 rounded-full border border-border/50 bg-background/95 shadow-lg flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
              title="Scroll to bottom"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      <div className={`${embedded ? 'px-2 py-1.5' : 'p-3'} relative`}>
        
        <div 
          className={`rounded-2xl border ${isDragging ? 'border-primary border-2' : themeCodex ? 'border-zinc-800 bg-zinc-900/90' : 'border-border/50 bg-muted/40 backdrop-blur-sm'} shadow-sm transition-all duration-200 focus-within:border-primary/50 relative`}
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
          {!themeCodex && projectPath && (
            <div className="px-3 pt-2 pb-1 border-b border-border/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="relative">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                    <span className={`absolute -right-1 -bottom-1 w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'}`} />
                  </div>
                  <span className="opacity-80 truncate flex-1">{projectPath}</span>
                </div>
              </div>
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
          {/* Resume last session button - hidden in Codex theme for minimal look */}
          {!themeCodex && hasLastSession(projectPath) && !sessionActive && messages.length === 0 && (
            <div className="px-4 pb-2">
              <button
                onClick={() => { 
                  primeResumeFromSaved(); 
                  startSession(); 
                  restoreLastChat(); 
                  addMessage({ type: 'system', text: 'Resuming previous session...' });
                }}
                className="w-full px-3 py-2 rounded-lg bg-muted/50 hover:bg-muted/70 transition-all text-left flex items-center gap-2 group"
                title="Resume last session"
              >
                <svg className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-foreground">Resume session:</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {(() => {
                      try {
                        const history = loadChatHistory(projectPath);
                        if (history?.messages?.length > 0) {
                          // Get first user message for preview
                          const firstUserMsg = history.messages.find(m => m.type === 'user');
                          if (firstUserMsg?.text) {
                            return firstUserMsg.text.slice(0, 50) + (firstUserMsg.text.length > 50 ? '...' : '');
                          }
                        }
                        const s = loadLastSession(projectPath);
                        return s?.sessionId ? `Session ${s.sessionId.slice(0, 8)}` : 'Previous session';
                      } catch { 
                        return 'Previous session'; 
                      }
                    })()}
                  </div>
                </div>
              </button>
            </div>
          )}
          <div className="p-4">
            {/* Composer bubble */}
            <div className={`flex items-center gap-2 px-3 ${themeCodex ? 'py-2.5' : 'py-2 bg-background/60 border border-border/50'} rounded-2xl`}>
              {/* plus */}
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleImageSelect(e.target.files)} />
              <button onClick={() => fileInputRef.current?.click()} className={`${themeCodex ? 'text-zinc-400 hover:text-white' : 'text-muted-foreground hover:text-foreground'} w-8 h-8 rounded-full flex items-center justify-center hover:bg-white/5`} title="Attach">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
              </button>
              {/* textarea */}
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={embedded ? 'Ask anything...' : 'Ask Codex to do anything'}
                className={`flex-1 text-[15px] leading-relaxed bg-transparent outline-none ${themeCodex ? 'text-zinc-200 placeholder:text-zinc-500' : 'text-foreground placeholder:text-muted-foreground'} resize-none`}
                disabled={!isConnected || (isSessionInitializing && !sessionActive)}
                rows={1}
                style={{ minHeight: '32px', maxHeight: '150px', height: 'auto', overflowY: input.split('\n').length > 5 ? 'auto' : 'hidden' }}
              />
              {/* send */}
              <button
                onClick={handleSend}
                title="Send"
                className={`w-9 h-9 rounded-full flex items-center justify-center ${themeCodex ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white' : 'bg-accent text-foreground hover:bg-primary/20 hover:text-primary'} transition-all disabled:opacity-40`}
                disabled={!isConnected || (isSessionInitializing && !sessionActive) || (!input.trim() && attachments.length === 0 && imageAttachments.length === 0)}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M13 5l7 7-7 7"/></svg>
              </button>
            </div>
            {/* Segmented controls row */}
            <div className={`mt-2 flex items-center gap-6 ${themeCodex ? 'text-zinc-400' : 'text-muted-foreground'}`}>
              <div className="flex items-center gap-1 text-sm cursor-pointer select-none">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 5h18v14H3z"/><path d="M8 21h8"/></svg>
                <span>Local</span>
              </div>
              <div className="relative">
                <button onClick={() => { setShowModeMenu(v => !v); setShowModelMenu(false); }} className="flex items-center gap-1 text-sm hover:text-white/90">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 12a5 5 0 1 0-5-5"/><path d="M2 22a8 8 0 0 1 20 0"/></svg>
                  <span>Agent</span>
                </button>
                {showModeMenu && (
                  <div className="absolute z-50 bottom-full mb-1 w-28 rounded-md border border-zinc-700 bg-zinc-900 shadow-xl">
                    {['Auto','Planer','Chat'].map(m => (
                      <button key={m} onClick={() => { setPlannerMode(m); savePlannerMode(m); setShowModeMenu(false); }} className={`w-full text-left px-2 py-1.5 text-[12px] hover:bg-zinc-800 ${m===plannerMode?'text-white':'text-zinc-400'}`}>{m}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => { setShowModelMenu(v => !v); setShowModeMenu(false); }} className="flex items-center gap-1 text-sm hover:text-white/90">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M2 12h20"/></svg>
                  <span>Medium</span>
                </button>
                {showModelMenu && (
                  <div className="absolute z-50 bottom-full mb-1 w-32 rounded-md border border-zinc-700 bg-zinc-900 shadow-xl">
                    {['gpt-5','gpt-4o','gpt-4o-mini'].map(m => (
                      <button key={m} onClick={() => { setModelLabel(m); saveModelLabel(m); setShowModelMenu(false); }} className={`w-full text-left px-2 py-1.5 text-[12px] hover:bg-zinc-800 ${m===modelLabel?'text-white':'text-zinc-400'}`}>{m}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Handle image file selection
  const handleImageSelect = (files) => {
    const validImages = Array.from(files).filter(file => 
      file.type.startsWith('image/')
    ).slice(0, 5); // Limit to 5 images
    
    validImages.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        setImageAttachments(prev => [...prev, {
          id: `img-${Date.now()}-${Math.random()}`,
          dataUrl: e.target.result,
          name: file.name,
          size: file.size
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

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
    if (!message && imageAttachments.length === 0) return;
    
    // Build message with images if present
    let displayMessage = message;
    if (imageAttachments.length > 0) {
      const imageNames = imageAttachments.map(img => img.name).join(', ');
      displayMessage = `${message}${message ? '\n\n' : ''}📎 Attached: ${imageNames}`;
    }
    
    // Display user message with timestamp
    addMessage({ type: 'user', text: displayMessage, images: imageAttachments });
    
    // Build final content: attachments as code blocks + images + user text
    let prefix = '';
    if (attachments.length > 0) {
      const blocks = attachments.map((att, idx) => `Selected ${att.tag} (${idx + 1}):\n\n\u0060\u0060\u0060html\n${att.html}\n\u0060\u0060\u0060`).join('\n\n');
      prefix = blocks + '\n\n';
    }
    // Add image data to the message
    if (imageAttachments.length > 0) {
      const imageInfo = imageAttachments.map((img, idx) => 
        `Image ${idx + 1}: ${img.name} (${Math.round(img.size / 1024)}KB)\n[Image data URL provided]`
      ).join('\n');
      prefix += `Attached images:\n${imageInfo}\n\n`;
    }
    // Apply planner/model hints to steer the assistant without changing backend args
    let controlPrefix = '';
    if (plannerMode === 'Planer') {
      controlPrefix = 'You are in Planner mode. First, outline a short plan (bulleted), then execute only what is necessary. Keep outputs concise.\n\n';
    } else if (plannerMode === 'Auto') {
      controlPrefix = 'You may decide between planning or direct answer depending on user input.\n\n';
    }
    const modelHint = modelLabel ? `(model: ${modelLabel})\n\n` : '';
    const fullMessage = controlPrefix + modelHint + prefix + message;
    
    // Show typing indicator
    setIsTyping(true);
    
    // Always use Node.js WebSocket path
    if (!isConnected) {
      setIsTyping(false);
      addMessage({ type: 'error', text: 'WebSocket not connected' });
      return;
    }
      
      const options = {
        projectPath: projectPath || process.cwd(),
        cwd: projectPath || process.cwd(),
        dangerous: dangerousMode,
        plannerMode,
        modelLabel,
        resumeRolloutPath: (!sessionActive && primedResumeRef.current) ? primedResumeRef.current : undefined
      };
      
    sendMessage({ type: 'codex-command', command: fullMessage, options });
    // Clear one-shot resume after use
    primedResumeRef.current = null;
    
    setAttachments([]);
    setImageAttachments([]);
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
  const markdownComponents = {
    code({ node, inline, className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      if (!inline && language) {
        const CodeWithCopy = ({ text }) => {
          const [copied, setCopied] = useState(false);
          const [collapsed, setCollapsed] = useState(true); // Start collapsed
          const handleCopy = async () => {
            try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {}
          };
          
          // Count lines for preview
          const lines = String(text).split('\n');
          const lineCount = lines.length;
          const preview = lines.slice(0, 3).join('\n');
          
          return (
            <div className="relative group w-full">
              <div className="flex items-center justify-between mb-2 px-3 py-2 bg-muted/30 rounded-t-lg border border-border/50">
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg 
                    className={`w-4 h-4 transition-transform ${collapsed ? '' : 'rotate-90'}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="font-mono text-xs">
                    {language} • {lineCount} lines {collapsed ? '(click to expand)' : ''}
                  </span>
                </button>
                <button 
                  onClick={handleCopy} 
                  className="px-2 py-1 text-[11px] rounded-md bg-background/80 border border-border hover:bg-accent"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              
              {collapsed ? (
                <div className="px-3 py-2 bg-muted/10 rounded-b-lg border-x border-b border-border/50">
                  <pre className="text-xs font-mono text-muted-foreground overflow-hidden">
                    <code>{preview}{lineCount > 3 ? '\n...' : ''}</code>
                  </pre>
                </div>
              ) : (
                <SyntaxHighlighter
                  style={vscDarkPlus}
                  language={language}
                  PreTag="div"
                  customStyle={{ 
                    margin: '0', 
                    borderRadius: '0 0 0.5rem 0.5rem',
                    fontSize: '0.875rem',
                    width: '100%',
                    overflowX: 'auto'
                  }}
                  {...props}
                >
                  {String(text).replace(/\n$/, '')}
                </SyntaxHighlighter>
              )}
            </div>
          );
        };
        return <CodeWithCopy text={String(children)} />;
      }
      
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
      const renderBadges = (content) => {
        try {
          const text = String(content || '');
          const pieces = [];
          let rest = text;
          const badge = (cls, label) => <span className={`badge ${cls}`}>{label}</span>;
          // Leading language/file-kind badges
          if (/^(JS|TS|MD|JSON)\s+/.test(rest)) {
            const m = /^(JS|TS|MD|JSON)\s+/.exec(rest);
            const kind = m[1];
            pieces.push(badge(`badge-${kind.toLowerCase()}`, kind));
            rest = rest.slice(m[0].length);
          }
          // Trailing MODIFY badge
          if (/\sMODIFY\b/.test(rest)) {
            const idx = rest.lastIndexOf(' MODIFY');
            const before = rest.slice(0, idx);
            const after = rest.slice(idx + 1); // 'MODIFY' plus maybe punctuation
            pieces.push(<span key="before"> {before} </span>);
            pieces.push(badge('badge-modify', 'MODIFY'));
            const tail = after.replace(/^MODIFY\b\s*/, '');
            if (tail) pieces.push(<span key="tail"> {tail} </span>);
            return pieces;
          }
          // References standalone
          if (/^References\b/.test(rest)) {
            pieces.push(badge('badge-ref', 'References'));
            const tail = rest.replace(/^References\b\s*/, '');
            if (tail) pieces.push(<span key="tail"> {tail} </span>);
            return pieces;
          }
          return text;
        } catch { return children; }
      };
      // Only transform simple text paragraphs
      if (typeof children === 'string') {
        return <p className="my-1" {...props}>{renderBadges(children)}</p>;
      }
      if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
        return <p className="my-1" {...props}>{renderBadges(children[0])}</p>;
      }
      return <p className="my-1" {...props}>{children}</p>;
    },
    // Basic task list support: - [ ] / - [x]
    li({ children, ...props }) {
      const raw = String(children && children[0] ? (children[0].props ? children[0].props.children : children[0]) : '');
      const renderBadges = (text) => {
        const parts = [];
        const badge = (cls, label) => <span className={`badge ${cls}`}>{label}</span>;
        let rest = text;
        if (/^(JS|TS|MD|JSON)\s+/.test(rest)) {
          const m = /^(JS|TS|MD|JSON)\s+/.exec(rest);
          const kind = m[1];
          parts.push(badge(`badge-${kind.toLowerCase()}`, kind));
          rest = rest.slice(m[0].length);
        }
        if (/^References\b/.test(rest)) {
          parts.push(badge('badge-ref', 'References'));
          rest = rest.replace(/^References\b\s*/, '');
        }
        if (/\sMODIFY\b/.test(rest)) {
          const idx = rest.lastIndexOf(' MODIFY');
          const before = rest.slice(0, idx);
          parts.push(<span key="before"> {before} </span>);
          parts.push(badge('badge-modify', 'MODIFY'));
          const tail = rest.slice(idx + ' MODIFY'.length);
          if (tail) parts.push(<span key="tail">{tail}</span>);
          return parts;
        }
        parts.push(rest);
        return parts;
      };
      const unchecked = raw.startsWith('[ ] ') || raw.startsWith('[  ] ');
      const checked = raw.startsWith('[x] ') || raw.startsWith('[X] ');
      if (unchecked || checked) {
        const label = raw.replace(/^\[[xX\s]\]\s+/, '');
        return (
          <li className="list-none my-1">
            <label className="inline-flex items-start gap-2">
              <input type="checkbox" disabled checked={checked} className="mt-1 rounded" />
              <span>{renderBadges(label)}</span>
            </label>
          </li>
        );
      }
      if (typeof children === 'string') {
        return <li className="my-1" {...props}>{renderBadges(children)}</li>;
      }
      if (Array.isArray(children) && children.length === 1 && typeof children[0] === 'string') {
        return <li className="my-1" {...props}>{renderBadges(children[0])}</li>;
      }
      return <li className="my-1" {...props}>{children}</li>;
    }
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
      

      {/* Persistent Open Button */}
      <div className="absolute right-4 bottom-4 z-40 flex items-center gap-2">
        {!sessionActive ? (
          <button
            onClick={() => {
              // Start Codex session before opening the panel
              startSession();
              if (onBeforeOpen) onBeforeOpen();
              setOpen(true);
            }}
            className="px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60"
            title={`Start Codex session for ${getHost()}`}
            disabled={isSessionInitializing || !isConnected}
          >
            {isSessionInitializing ? 'Starting…' : 'Start Codex Session'}
          </button>
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
        {/* Resume last session chip (outside panel) */}
        {!open && hasSavedSession && (
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
