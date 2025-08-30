import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useWebSocket } from '../utils/websocket';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { normalizeCodexEvent } from '../utils/codex-normalizer';
import { loadPlannerMode, savePlannerMode } from '../utils/chat-prefs';
import { hasChatHistory, loadChatHistory, saveChatHistory } from '../utils/chat-history';
import { hasLastSession, loadLastSession, saveLastSession, clearLastSession } from '../utils/chat-session';
import { MessageRenderer } from './chat/shared/MessageRenderer';
import { ChatInputArea } from './chat/shared/ChatInputArea';
import { createMarkdownComponents } from './chat/shared/MarkdownComponents';

// Cleaned Overlay Chat - Codex-specific with shared UI components
const OverlayChatClean = React.memo(function OverlayChatClean({ 
  projectPath, 
  previewUrl, 
  embedded = false, 
  disableInlinePanel = false, 
  useSidebarWhenOpen = false, 
  sidebarContainerRef = null, 
  onBeforeOpen, 
  chatId = 'default' 
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatus, setTypingStatus] = useState({ mode: 'idle', label: '' });
  const [elapsedSec, setElapsedSec] = useState(0);
  const [attachments, setAttachments] = useState([]);
  const [imageAttachments, setImageAttachments] = useState([]);
  const [hasSaved, setHasSaved] = useState(false);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [plannerMode, setPlannerMode] = useState(() => loadPlannerMode());
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [isSessionInitializing, setIsSessionInitializing] = useState(false);
  const [clientSessionId, setClientSessionId] = useState(null);
  const [resumeRolloutPath, setResumeRolloutPath] = useState(null);
  
  const messagesScrollRef = useRef(null);
  const restoredRef = useRef(false);
  const primedResumeRef = useRef(null);
  const initTimerRef = useRef(null);
  const execStreamsRef = useRef(new Map());
  
  const { theme } = useTheme();
  const themeCodex = theme === 'dark';
  const { isLoading: authLoading, token } = useAuth();
  const authReady = !!token && !authLoading;
  const { ws, sendMessage, messages: wsMessages, isConnected, reconnect } = useWebSocket(authReady);
  
  const markdownComponents = createMarkdownComponents();
  
  // Detect saved history
  useEffect(() => {
    try {
      if (projectPath) {
        const hasHistory = hasChatHistory(projectPath);
        const hasSession = hasLastSession(projectPath);
        setHasSaved(hasHistory);
        setHasSavedSession(hasSession);
      }
    } catch (e) {
      console.error('Error checking saved data:', e);
    }
  }, [projectPath]);
  
  // Persist messages
  useEffect(() => {
    try {
      if (projectPath && messages && messages.length) {
        saveChatHistory(projectPath, messages);
        setHasSaved(true);
      }
    } catch {}
  }, [projectPath, messages]);
  
  // Persist session metadata
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
      sendMessage({ type: 'codex-start-session', options });
      setIsSessionInitializing(true);
      setSessionActive(true);
      
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
      initTimerRef.current = setTimeout(() => {
        setIsSessionInitializing(false);
        addMessage({ type: 'system', text: 'Session start timeout. You can retry or continue without session.' });
      }, 8000);
    }
  }, [isConnected, sendMessage, projectPath]);
  
  const endSession = useCallback(() => {
    if (isConnected) {
      sendMessage({ type: 'codex-end-session' });
      setSessionActive(false);
      setSessionId(null);
      setMessages([]);
    }
  }, [isConnected, sendMessage]);
  
  const restartSession = useCallback(() => {
    endSession();
    setTimeout(() => startSession(), 200);
  }, [endSession, startSession]);
  
  // Message handling
  const addMessage = useCallback((newMessage) => {
    setMessages(prev => {
      const timestamp = new Date().toISOString();
      const messageWithMeta = {
        ...newMessage,
        timestamp,
        id: `msg-${Date.now()}-${Math.random()}`
      };
      return [...prev, messageWithMeta];
    });
  }, []);
  
  const addMessageAndGetId = useCallback((newMessage) => {
    const timestamp = new Date().toISOString();
    const id = `msg-${Date.now()}-${Math.random()}`;
    const messageWithMeta = { ...newMessage, timestamp, id };
    setMessages(prev => [...prev, messageWithMeta]);
    return id;
  }, []);
  
  const updateMessageById = useCallback((id, updater) => {
    setMessages(prev => prev.map(m => m.id === id ? updater(m) : m));
    
    const c = messagesScrollRef.current;
    if (c && isTyping) {
      c.scrollTop = c.scrollHeight;
    }
  }, [isTyping]);
  
  // Restore last chat
  const restoreLastChat = useCallback(() => {
    try {
      if (!projectPath) return;
      const entry = loadChatHistory(projectPath);
      if (entry && Array.isArray(entry.messages) && entry.messages.length) {
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
  
  const primeResumeFromSaved = useCallback(() => {
    if (!projectPath) return;
    try {
      const s = loadLastSession(projectPath);
      if (s && (s.rolloutPath || s.sessionId)) {
        primedResumeRef.current = s.rolloutPath || null;
      }
    } catch {}
  }, [projectPath]);
  
  // Process WebSocket messages
  useEffect(() => {
    if (wsMessages && wsMessages.length > 0) {
      const lastMsg = wsMessages[wsMessages.length - 1];
      
      if (lastMsg.type === 'codex-session-started') {
        if (initTimerRef.current) { 
          clearTimeout(initTimerRef.current); 
          initTimerRef.current = null; 
        }
        if (lastMsg.sessionId) {
          setSessionId(lastMsg.sessionId);
          if (clientSessionId) setClientSessionId(null);
          if (lastMsg.rolloutPath) setResumeRolloutPath(lastMsg.rolloutPath);
          try { 
            saveLastSession(projectPath || process.cwd(), { 
              sessionId: lastMsg.sessionId, 
              rolloutPath: lastMsg.rolloutPath || null 
            }); 
            setHasSavedSession(true);
          } catch {}
          addMessage({ type: 'system', text: `Session started (${lastMsg.sessionId.slice(0, 8)}…)` });
          setIsSessionInitializing(false);
        } else {
          if (!clientSessionId) {
            try {
              const tmp = (typeof crypto !== 'undefined' && crypto.randomUUID) 
                ? crypto.randomUUID() 
                : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              setClientSessionId(tmp);
            } catch {
              const tmp = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
              setClientSessionId(tmp);
            }
          }
          setTimeout(() => setIsSessionInitializing(false), 2000);
        }
        setIsTyping(false);
        return;
      }
      
      if (lastMsg.type === 'codex-session-closed') {
        if (initTimerRef.current) { 
          clearTimeout(initTimerRef.current); 
          initTimerRef.current = null; 
        }
        setSessionId(null);
        setClientSessionId(null);
        addMessage({ type: 'system', text: 'Session closed' });
        setIsSessionInitializing(false);
        setIsTyping(false);
        return;
      }
      
      if (lastMsg.type === 'codex-error' && isSessionInitializing) {
        if (initTimerRef.current) { 
          clearTimeout(initTimerRef.current); 
          initTimerRef.current = null; 
        }
        setIsSessionInitializing(false);
      }
      
      // Normalize Codex events
      const normalized = normalizeCodexEvent(lastMsg) || [];
      if (normalized.length) {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        normalized.forEach((m) => addMessage({ type: m.type, text: m.text }));
        return;
      }
      
      // Handle typing states
      if (lastMsg.type === 'codex-start' || lastMsg.type === 'task_started') {
        if (!isSessionInitializing) {
          setIsTyping(true);
          setTypingStatus({ mode: 'thinking', label: 'Thinking' });
          setElapsedSec(0);
        }
        return;
      }
      
      if (lastMsg.type === 'codex-complete') {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setElapsedSec(0);
        return;
      }
      
      if (lastMsg.type === 'codex-error') {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setElapsedSec(0);
        addMessage({ type: 'error', text: lastMsg.error });
        return;
      }
      
      if (lastMsg.type === 'codex-tool') {
        const toolData = lastMsg.data;
        if (toolData && toolData.name && !['reasoning', 'thinking'].includes(toolData.name.toLowerCase())) {
          setIsTyping(true);
          setTypingStatus({ mode: 'tool', label: toolData.name });
          const getToolIcon = (name) => {
            const n = String(name || '').toLowerCase();
            if (n.includes('bash') || n.includes('shell')) return '💻';
            if (n.includes('edit') || n.includes('patch')) return '✏️';
            if (n.includes('git')) return '🌿';
            return '🔧';
          };
          addMessage({ type: 'system', text: `${getToolIcon(toolData.name)} ${toolData.name}` });
          setElapsedSec(0);
        }
        return;
      }
      
      // Handle streaming exec
      if (lastMsg.type === 'codex-exec-begin') {
        const { callId, command } = lastMsg;
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
          if (now - (stream.lastTs || 0) > 120) {
            stream.lastTs = now;
            const fenced = '```bash\n' + stream.buffer.replace(/```/g, '\u0060\u0060\u0060') + '\n```';
            updateMessageById(stream.id, (m) => ({ 
              ...m, 
              text: m.text.split('\n\n')[0] + '\n\n' + fenced 
            }));
          }
        }
        return;
      }
      
      if (lastMsg.type === 'codex-exec-end') {
        const { callId, exit_code } = lastMsg;
        const stream = execStreamsRef.current.get(callId);
        if (stream) {
          const fenced = '```bash\n' + stream.buffer.replace(/```/g, '\u0060\u0060\u0060') + '\n```';
          updateMessageById(stream.id, (m) => ({ 
            ...m, 
            text: m.text.split('\n\n')[0] + '\n\n' + fenced + `\n\nExit code: ${exit_code}` 
          }));
          execStreamsRef.current.delete(callId);
        }
        setIsTyping(false);
        return;
      }
      
      // Queue states
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
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setQueueLength(0);
        return;
      }
      
      if (lastMsg.type === 'codex-aborted') {
        setIsTyping(false);
        setTypingStatus({ mode: 'idle', label: '' });
        setQueueLength(0);
        addMessage({ type: 'system', text: 'Aborted and cleared queue' });
        return;
      }
    }
  }, [wsMessages, addMessage, addMessageAndGetId, updateMessageById, isSessionInitializing, 
      projectPath, clientSessionId]);
  
  // Elapsed time tracking
  useEffect(() => {
    if (isTyping && (typingStatus.mode === 'thinking' || typingStatus.mode === 'tool')) {
      const id = setInterval(() => {
        setElapsedSec(prev => prev + 1);
      }, 1000);
      return () => clearInterval(id);
    } else {
      setElapsedSec(0);
    }
  }, [isTyping, typingStatus.mode]);
  
  // Send message
  const handleSend = async () => {
    const message = input.trim();
    if (!message && imageAttachments.length === 0) return;
    
    let displayMessage = message;
    if (imageAttachments.length > 0) {
      const imageNames = imageAttachments.map(img => img.name).join(', ');
      displayMessage = `${message}${message ? '\n\n' : ''}📎 Attached: ${imageNames}`;
    }
    
    setIsTyping(true);
    addMessage({ type: 'user', text: displayMessage, images: imageAttachments });
    
    if (!isConnected) {
      setIsTyping(false);
      addMessage({ type: 'error', text: 'WebSocket not connected' });
      return;
    }
    
    const options = {
      projectPath: projectPath || process.cwd(),
      cwd: projectPath || process.cwd(),
      plannerMode,
      resumeRolloutPath: (!sessionActive && primedResumeRef.current) ? primedResumeRef.current : undefined
    };
    
    sendMessage({ type: 'codex-command', command: message, options });
    primedResumeRef.current = null;
    
    setAttachments([]);
    setImageAttachments([]);
    setInput('');
  };
  
  // Auto-scroll
  useEffect(() => {
    const c = messagesScrollRef.current;
    if (!c) return;
    
    if (isTyping) {
      c.scrollTop = c.scrollHeight;
      return;
    }
    
    const isNear = (c.scrollHeight - c.scrollTop - c.clientHeight) < 200;
    if (isNear && messages.length > 0) {
      c.scrollTop = c.scrollHeight;
    }
  }, [messages.length, isTyping]);
  
  // Track scroll for jump button
  useEffect(() => {
    const c = messagesScrollRef.current;
    if (!c) return;
    
    let scrollTimeout;
    const onScroll = () => {
      if (scrollTimeout) clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        const isNear = (c.scrollHeight - c.scrollTop - c.clientHeight) < 200;
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
  
  // Resolve sidebar element
  const [resolvedSidebarEl, setResolvedSidebarEl] = useState(null);
  useEffect(() => {
    if (useSidebarWhenOpen && open) {
      const tryResolve = () => {
        const el = sidebarContainerRef?.current || null;
        if (el) {
          setResolvedSidebarEl(el);
        } else {
          requestAnimationFrame(tryResolve);
        }
      };
      tryResolve();
    } else {
      setResolvedSidebarEl(null);
    }
  }, [useSidebarWhenOpen, open, sidebarContainerRef]);
  
  const handleImageSelect = (image) => {
    setImageAttachments(prev => [...prev, image]);
  };
  
  const handleImageRemove = (id) => {
    setImageAttachments(prev => prev.filter(img => img.id !== id));
  };
  
  // Panel content
  const renderPanelContent = () => (
    <div className={`${embedded ? 'w-full h-full flex flex-col bg-background' : themeCodex ? 'w-full max-h-[70vh] bg-zinc-900 dark:bg-black rounded-2xl flex flex-col overflow-hidden border border-zinc-700 dark:border-zinc-900' : 'w-full max-h-[70vh] chat-glass border border-border/40 rounded-2xl flex flex-col overflow-hidden shadow-2xl'}`}>
      {!embedded && (
        <div className={`${themeCodex ? 'px-3 py-2' : 'px-4 py-3'} border-b border-border/30 flex items-center justify-between ${themeCodex ? 'bg-zinc-900 dark:bg-black text-zinc-900 dark:text-white' : 'bg-muted/50 backdrop-blur-sm'}`}>
          <div className="flex items-center gap-2">
            <div className={`text-sm tracking-widest font-extrabold ${themeCodex ? 'text-zinc-400' : ''}`}>CODEX</div>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-yellow-500'}`} />
            {(sessionActive && sessionId) || clientSessionId ? (
              <span className="text-[10px] text-muted-foreground/60 font-mono">
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
            <button onClick={startSession} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10" title="New">
              <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25z"/>
                <path d="M14.06 4.94l3.75 3.75"/>
              </svg>
            </button>
            <button onClick={restartSession} disabled={!isConnected} className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/10 disabled:opacity-50" title="Restart">
              <svg className="w-4 h-4 text-zinc-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 1 0 9-9"/>
                <path d="M3 4v8h8"/>
              </svg>
            </button>
          </div>
        </div>
      )}
      
      <div ref={messagesScrollRef} className={`${embedded ? 'flex-1 overflow-y-auto px-3 py-2 space-y-2 pb-20' : 'overflow-y-auto px-4 py-3 space-y-2 bg-transparent max-h-[50vh] pb-20'} relative`}>
        {messages.length === 0 && !isTyping && !sessionActive && (
          <div className={`flex flex-col items-center justify-center gap-4 ${themeCodex ? 'h-[50vh] bg-background dark:bg-black' : 'h-full min-h-[200px]'}`}>
            <button onClick={startSession} className={`px-4 py-2 rounded-full ${themeCodex ? 'bg-zinc-800 text-white hover:bg-zinc-700' : 'bg-primary text-primary-foreground hover:bg-primary/90'} transition-all text-sm font-medium disabled:opacity-50`} disabled={isSessionInitializing || !isConnected}>
              {isSessionInitializing ? 'Starting...' : 'Start Codex AI Session'}
            </button>
          </div>
        )}
        
        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <MessageRenderer key={m.id} message={m} markdownComponents={markdownComponents} />
          ))}
        </AnimatePresence>
        
        {isTyping && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-muted-foreground">
            <span className="w-4 h-4 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin inline-block" />
            <span className="text-[12px]">
              {typingStatus.label ? `${typingStatus.label} — ${elapsedSec}s` : `Running… ${elapsedSec}s`}
            </span>
            <button onClick={() => sendMessage({ type: 'codex-abort' })} className="text-[11px] px-2 py-1 rounded border border-border/50 hover:bg-white/5">
              Abort
            </button>
          </motion.div>
        )}
        
        {showJump && (
          <div className="absolute bottom-4 right-4 z-30">
            <button onClick={() => { const c = messagesScrollRef.current; if (c) c.scrollTop = c.scrollHeight; }} className="w-8 h-8 rounded-full border border-border/50 bg-background/95 shadow-lg flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3"/>
              </svg>
            </button>
          </div>
        )}
      </div>
      
      <div className={`${embedded ? 'px-2 py-1.5' : 'p-3'} relative`}>
        <div className="flex items-center justify-between text-muted-foreground text-xs px-2 mb-2">
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 hover:text-foreground transition-colors">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/>
              </svg>
              <span className="max-w-[200px] truncate">{projectPath ? projectPath.split('/').pop() : 'Local'}</span>
            </button>
            <div className="relative">
              <button onClick={() => setShowModeMenu(v => !v)} className="flex items-center gap-1 hover:text-foreground transition-colors">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8a4 4 0 100 8 4 4 0 000-8z"/>
                  <path d="M12 2v6m0 8v6m10-10h-6m-8 0H2"/>
                </svg>
                <span>{plannerMode === 'Planer' ? 'Planner' : plannerMode}</span>
              </button>
              {showModeMenu && (
                <div className="absolute z-50 bottom-full mb-1 left-0 w-24 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
                  {['Auto','Planer','Chat'].map(m => (
                    <button key={m} onClick={() => { setPlannerMode(m); savePlannerMode(m); setShowModeMenu(false); }} className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${m===plannerMode?'text-zinc-300 bg-zinc-800/50':'text-zinc-500'}`}>
                      {m === 'Planer' ? 'Planner' : m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        <ChatInputArea
          input={input}
          setInput={setInput}
          onSend={handleSend}
          disabled={!isConnected || (isSessionInitializing && !sessionActive)}
          attachments={attachments}
          imageAttachments={imageAttachments}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
        />
      </div>
    </div>
  );
  
  if (embedded) {
    return <div className="h-full w-full">{renderPanelContent()}</div>;
  }
  
  return (
    <>
      {open && !disableInlinePanel && !useSidebarWhenOpen && (
        <div className="absolute right-4 bottom-12 w-[min(360px,80vw)] z-50">
          {renderPanelContent()}
        </div>
      )}
      {open && useSidebarWhenOpen && resolvedSidebarEl && (
        ReactDOM.createPortal(renderPanelContent(), resolvedSidebarEl)
      )}
      
      <div className="absolute right-4 bottom-4 z-40 flex items-center gap-2">
        {!sessionActive ? (
          <button onClick={() => { startSession(); if (onBeforeOpen) onBeforeOpen(); setOpen(true); }} className="px-4 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors text-sm disabled:opacity-60" disabled={isSessionInitializing || !isConnected}>
            {isSessionInitializing ? 'Starting…' : 'Start Codex Session'}
          </button>
        ) : (
          <>
            <button onClick={endSession} className="px-3 py-2 rounded-full bg-destructive/80 text-destructive-foreground hover:bg-destructive transition-colors text-xs">
              End Session
            </button>
            {!open && (
              <button onClick={() => { if (onBeforeOpen) onBeforeOpen(); setOpen(true); }} className="px-3 py-2 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors text-xs">
                Open Chat
              </button>
            )}
          </>
        )}
        {!open && hasSavedSession && (
          <button onClick={() => { primeResumeFromSaved(); startSession(); restoreLastChat(); }} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-background/80 hover:bg-accent/40 transition-all text-muted-foreground hover:text-foreground text-xs border border-border/30 backdrop-blur-sm">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
            </svg>
            <span className="font-medium">Resume</span>
          </button>
        )}
      </div>
    </>
  );
});

export default OverlayChatClean;