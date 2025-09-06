import { useState, useCallback, useRef } from 'react';
import { loadChatHistory, saveChatHistory } from '../../utils/chat-history';
import { loadLastSession, saveLastSession, clearLastSession } from '../../utils/chat-session';
import { loadCliProvider, saveCliProvider } from '../../utils/chat-prefs';

/**
 * Centralized chat state management hook
 * Replaces the 50+ useState calls in OverlayChatClaude
 */
export function useChatState(chatId = 'default', cliProviderFixed = null) {
  // Provider state - fixed if passed via props, otherwise from localStorage
  const [cliProvider, setCliProvider] = useState(() => cliProviderFixed || loadCliProvider());
  
  // Messages for each provider (separate histories)
  const [codexMessages, setCodexMessages] = useState([]);
  const [claudeMessages, setClaudeMessages] = useState([]);
  
  // Session states
  const [codexSessionId, setCodexSessionId] = useState(null);
  const [claudeSessionId, setClaudeSessionId] = useState(null);
  const [codexSessionActive, setCodexSessionActive] = useState(false);
  const [claudeSessionActive, setClaudeSessionActive] = useState(false);
  
  // UI states
  const [isTyping, setIsTyping] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [typingStatus, setTypingStatus] = useState({ mode: 'idle', label: '' });
  const [activityLock, setActivityLock] = useState(false);
  
  // Input and attachments
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [imageAttachments, setImageAttachments] = useState([]);
  
  // Modal and UI states
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  
  // Context and project states
  const [contextInfo, setContextInfo] = useState({
    num_turns: 0,
    duration_ms: 0,
    estimated_tokens: 0,
    max_context: 200000
  });
  
  // Refs for DOM elements and state
  const trayInputRef = useRef(null);
  const messagesScrollRef = useRef(null);
  const autoGreetSentRef = useRef(false);
  
  // Computed values based on current provider
  const currentMessages = cliProvider === 'codex' ? codexMessages : claudeMessages;
  const setCurrentMessages = cliProvider === 'codex' ? setCodexMessages : setClaudeMessages;
  const currentSessionId = cliProvider === 'codex' ? codexSessionId : claudeSessionId;
  const setCurrentSessionId = cliProvider === 'codex' ? setCodexSessionId : setClaudeSessionId;
  const currentSessionActive = cliProvider === 'codex' ? codexSessionActive : claudeSessionActive;
  const setCurrentSessionActive = cliProvider === 'codex' ? setCodexSessionActive : setClaudeSessionActive;
  
  // Actions
  const addMessage = useCallback((message) => {
    setCurrentMessages(prev => [...prev, {
      ...message,
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString()
    }]);
  }, [setCurrentMessages]);
  
  const updateMessage = useCallback((messageId, updates) => {
    setCurrentMessages(prev => prev.map(msg => 
      msg.id === messageId ? { ...msg, ...updates } : msg
    ));
  }, [setCurrentMessages]);
  
  const clearMessages = useCallback(() => {
    setCurrentMessages([]);
  }, [setCurrentMessages]);
  
  const switchProvider = useCallback((newProvider) => {
    if (newProvider !== cliProvider) {
      setCliProvider(newProvider);
      saveCliProvider(newProvider);
      
      // Reset typing states when switching
      setIsTyping(false);
      setActivityLock(false);
      setTypingStatus({ mode: 'idle', label: '' });
    }
  }, [cliProvider]);
  
  const resetCurrentSession = useCallback(() => {
    setCurrentSessionId(null);
    setCurrentSessionActive(false);
    clearMessages();
    setActivityLock(false);
    setIsTyping(false);
    setTypingStatus({ mode: 'idle', label: '' });
    autoGreetSentRef.current = false;
  }, [setCurrentSessionId, setCurrentSessionActive, clearMessages]);
  
  const resetTypingState = useCallback(() => {
    setIsTyping(false);
    setActivityLock(false);
    setTypingStatus({ mode: 'idle', label: '' });
  }, []);
  
  // Save/load chat history
  const saveChatHistoryToStorage = useCallback((projectPath) => {
    if (projectPath && currentMessages.length > 0) {
      saveChatHistory(projectPath, {
        messages: currentMessages,
        provider: cliProvider,
        sessionId: currentSessionId,
        timestamp: Date.now()
      });
    }
  }, [currentMessages, cliProvider, currentSessionId]);
  
  const loadChatHistoryFromStorage = useCallback((projectPath) => {
    if (projectPath) {
      const history = loadChatHistory(projectPath);
      if (history && history.messages) {
        if (history.provider === 'codex') {
          setCodexMessages(history.messages);
          setCodexSessionId(history.sessionId);
        } else {
          setClaudeMessages(history.messages);
          setClaudeSessionId(history.sessionId);
        }
        
        if (history.provider === cliProvider) {
          // Switch to the loaded provider if different
          setCliProvider(history.provider);
        }
      }
    }
  }, [cliProvider]);
  
  return {
    // Provider state
    cliProvider,
    switchProvider,
    
    // Current provider states (computed)
    messages: currentMessages,
    setMessages: setCurrentMessages,
    sessionId: currentSessionId,
    setSessionId: setCurrentSessionId,
    sessionActive: currentSessionActive,
    setSessionActive: setCurrentSessionActive,
    
    // Provider-specific states
    codexMessages,
    setCodexMessages,
    claudeMessages,
    setClaudeMessages,
    codexSessionId,
    setCodexSessionId,
    claudeSessionId,
    setClaudeSessionId,
    codexSessionActive,
    setCodexSessionActive,
    claudeSessionActive,
    setClaudeSessionActive,
    
    // UI states
    isTyping,
    setIsTyping,
    isEnding,
    setIsEnding,
    typingStatus,
    setTypingStatus,
    activityLock,
    setActivityLock,
    
    // Input states
    input,
    setInput,
    attachments,
    setAttachments,
    imageAttachments,
    setImageAttachments,
    
    // Slash menu states
    showSlashMenu,
    setShowSlashMenu,
    slashFilter,
    setSlashFilter,
    selectedCommandIndex,
    setSelectedCommandIndex,
    
    // Context info
    contextInfo,
    setContextInfo,
    
    // Refs
    trayInputRef,
    messagesScrollRef,
    autoGreetSentRef,
    
    // Actions
    addMessage,
    updateMessage,
    clearMessages,
    resetCurrentSession,
    resetTypingState,
    saveChatHistoryToStorage,
    loadChatHistoryFromStorage
  };
}
