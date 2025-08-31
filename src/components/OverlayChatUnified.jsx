import React, { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { motion, AnimatePresence } from 'framer-motion';
import { useClaudeSession } from '../hooks/useClaudeSession';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { normalizeCodexEvent } from '../utils/codex-normalizer';
import { loadPlannerMode, savePlannerMode, loadModelLabel } from '../utils/chat-prefs';
import { hasChatHistory, loadChatHistory, saveChatHistory } from '../utils/chat-history';
import { hasLastSession, loadLastSession, saveLastSession, clearLastSession } from '../utils/chat-session';
import CtaButton from './ui/CtaButton';

/**
 * Unified OverlayChat component that uses the new ClaudeWebSocket system
 * This version uses the same WebSocket connection as the Shell for better reliability
 */
const OverlayChatUnified = React.memo(function OverlayChatUnified({ 
  projectPath, 
  previewUrl, 
  embedded = false, 
  disableInlinePanel = false, 
  useSidebarWhenOpen = false, 
  sidebarContainerRef = null, 
  onBeforeOpen, 
  onPanelClosed, 
  chatId = 'default',
  mode = 'claude' // 'claude' or 'codex'
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [typingStatus, setTypingStatus] = useState({ mode: 'idle', label: '' });
  const [typingStart, setTypingStart] = useState(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [selectedElement, setSelectedElement] = useState(null);
  const [attachments, setAttachments] = useState([]);
  const [imageAttachments, setImageAttachments] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const trayInputRef = useRef(null);
  const bottomRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const [hasSaved, setHasSaved] = useState(false);
  const restoredRef = useRef(false);
  
  // Use unified Claude session
  const sessionType = mode === 'codex' ? 'codex' : 'chat';
  const {
    isConnected,
    isConnecting,
    sessionActive,
    sessionId,
    startSession,
    stopSession,
    messages: wsMessages,
    sendMessage: wsSendMessage,
    clearMessages
  } = useClaudeSession(sessionType, {
    projectPath: projectPath || process.cwd()
  });
  
  // Preferences
  const [hideThinking] = useState(() => {
    try { return localStorage.getItem('codex-hide-thinking') === '1'; } catch { return false; }
  });
  
  const [dangerousMode, setDangerousMode] = useState(() => {
    try {
      const key = projectPath ? `codex-dangerous-${projectPath}` : 'codex-dangerous-global';
      return localStorage.getItem(key) === '1';
    } catch { return false; }
  });
  
  const [nearBottom, setNearBottom] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const [plannerMode, setPlannerMode] = useState(() => loadPlannerMode());
  const [modelLabel, setModelLabel] = useState(() => loadModelLabel());
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [showModelMenu, setShowModelMenu] = useState(false);
  
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const primedResumeRef = useRef(null);
  const [codexLimitStatus, setCodexLimitStatus] = useState(null);
  const [queueLength, setQueueLength] = useState(0);
  const [connectorMode, setConnectorMode] = useState(null);
  const [connectorHasKey, setConnectorHasKey] = useState(null);
  const { theme } = useTheme();
  const themeCodex = theme === 'dark';
  
  // Auth
  const { isLoading: authLoading, token } = useAuth();
  const authReady = !!token && !authLoading;
  
  // Process WebSocket messages
  useEffect(() => {
    if (wsMessages && wsMessages.length > 0) {
      const lastMsg = wsMessages[wsMessages.length - 1];
      
      // Handle different message types
      if (mode === 'claude') {
        if (lastMsg.type === 'claude-message') {
          addMessage({
            type: 'assistant',
            text: lastMsg.content,
            id: lastMsg.id || Date.now()
          });
        } else if (lastMsg.type === 'claude-session-started') {
          setTypingStatus({ mode: 'idle', label: '' });
        } else if (lastMsg.type === 'claude-session-closed') {
          setTypingStatus({ mode: 'idle', label: 'Session ended' });
        }
      } else if (mode === 'codex') {
        // Handle Codex messages
        const normalized = normalizeCodexEvent(lastMsg);
        if (normalized) {
          if (normalized.type === 'message') {
            addMessage({
              type: 'assistant',
              text: normalized.content,
              id: normalized.id || Date.now()
            });
          } else if (normalized.type === 'status') {
            setTypingStatus({ 
              mode: normalized.status, 
              label: normalized.label 
            });
          }
        }
      }
      
      // Handle errors
      if (lastMsg.type === 'error') {
        addMessage({
          type: 'error',
          text: lastMsg.message || lastMsg.data,
          id: Date.now()
        });
        setIsTyping(false);
      }
    }
  }, [wsMessages, mode]);
  
  // Helper to add messages
  const addMessage = useCallback((msg) => {
    setMessages(prev => [...prev, msg]);
  }, []);
  
  // Send message
  const sendMessage = useCallback(async () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || !isConnected) return;
    
    // Add user message
    const userMessage = {
      type: 'user',
      text: trimmedInput,
      attachments: [...attachments],
      imageAttachments: [...imageAttachments],
      id: Date.now()
    };
    addMessage(userMessage);
    
    // Clear input
    setInput('');
    setAttachments([]);
    setImageAttachments([]);
    setIsTyping(true);
    setTypingStart(Date.now());
    
    // Start session if not active
    if (!sessionActive) {
      startSession();
    }
    
    // Send via unified WebSocket
    const options = {
      projectPath: projectPath || process.cwd(),
      attachments: attachments,
      imageAttachments: imageAttachments,
      plannerMode: plannerMode,
      model: modelLabel,
      dangerousMode: dangerousMode
    };
    
    if (mode === 'claude') {
      wsSendMessage({
        message: trimmedInput,
        ...options
      });
    } else if (mode === 'codex') {
      wsSendMessage({
        message: trimmedInput,
        ...options
      });
    }
  }, [
    input, 
    isConnected, 
    sessionActive, 
    startSession, 
    wsSendMessage, 
    attachments, 
    imageAttachments,
    projectPath,
    plannerMode,
    modelLabel,
    dangerousMode,
    mode,
    addMessage
  ]);
  
  // Handle enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };
  
  // Toggle chat open/close
  const toggleChat = useCallback(() => {
    if (!open && onBeforeOpen) {
      onBeforeOpen();
    }
    setOpen(prev => {
      const newOpen = !prev;
      if (!newOpen && onPanelClosed) {
        onPanelClosed();
      }
      return newOpen;
    });
  }, [open, onBeforeOpen, onPanelClosed]);
  
  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);
  
  // Auto-scroll when new messages
  useEffect(() => {
    if (nearBottom) {
      scrollToBottom();
    }
  }, [messages, nearBottom, scrollToBottom]);
  
  // Render message content with markdown
  const renderMessageContent = (text) => {
    return (
      <ReactMarkdown
        components={{
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }
        }}
      >
        {text}
      </ReactMarkdown>
    );
  };
  
  // Connection status indicator
  const getConnectionStatus = () => {
    if (isConnecting) return '🟡 Connecting...';
    if (isConnected) return '🟢 Connected';
    return '🔴 Disconnected';
  };
  
  // Render chat UI
  const chatContent = (
    <div className={`overlay-chat ${themeCodex ? 'codex-theme' : ''} ${open ? 'open' : ''}`}>
      <div className="chat-header">
        <div className="chat-title">
          {mode === 'codex' ? 'Codex Assistant' : 'Claude Assistant'}
        </div>
        <div className="chat-status">
          {getConnectionStatus()}
        </div>
        <button onClick={toggleChat} className="chat-close">
          ✕
        </button>
      </div>
      
      <div className="chat-messages" ref={messagesScrollRef}>
        {messages.map((msg, idx) => (
          <div key={msg.id || idx} className={`message message-${msg.type}`}>
            {msg.type === 'user' && (
              <div className="message-user">
                <div className="message-content">{msg.text}</div>
                {msg.attachments?.length > 0 && (
                  <div className="message-attachments">
                    {msg.attachments.map((att, i) => (
                      <span key={i} className="attachment-chip">{att}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
            {msg.type === 'assistant' && (
              <div className="message-assistant">
                <div className="message-content">
                  {renderMessageContent(msg.text)}
                </div>
              </div>
            )}
            {msg.type === 'error' && (
              <div className="message-error">
                <div className="message-content">{msg.text}</div>
              </div>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="message message-typing">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
            {typingStatus.label && (
              <span className="typing-label">{typingStatus.label}</span>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      
      <div className="chat-input-container">
        {attachments.length > 0 && (
          <div className="attachments-preview">
            {attachments.map((att, idx) => (
              <span key={idx} className="attachment-chip">
                {att}
                <button 
                  onClick={() => setAttachments(prev => prev.filter((_, i) => i !== idx))}
                  className="attachment-remove"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
        
        <div className="chat-input-wrapper">
          <textarea
            ref={trayInputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Ask ${mode === 'codex' ? 'Codex' : 'Claude'}...`}
            className="chat-input"
            disabled={!isConnected}
          />
          <button 
            onClick={sendMessage}
            disabled={!input.trim() || !isConnected}
            className="chat-send"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
  
  // Render button or embedded panel
  if (!open && !embedded) {
    return (
      <button 
        onClick={toggleChat}
        className="overlay-chat-button"
        title={`Open ${mode === 'codex' ? 'Codex' : 'Claude'} Chat`}
      >
        💬
      </button>
    );
  }
  
  // Portal for overlay or render inline
  if (embedded || (open && useSidebarWhenOpen && sidebarContainerRef?.current)) {
    return ReactDOM.createPortal(chatContent, sidebarContainerRef.current);
  }
  
  return ReactDOM.createPortal(chatContent, document.body);
});

export default OverlayChatUnified;