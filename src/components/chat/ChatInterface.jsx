import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChatState } from '../../hooks/chat/useChatState';
import { useWebSocketConnection } from '../../hooks/chat/useWebSocketConnection';
import { ChatInput } from './ChatInput';
import { MessageList } from './MessageList';
import { createLogger } from '../../utils/logger';

const log = createLogger('ChatInterface');

/**
 * Main chat interface component - replaces the 4,153-line OverlayChatClaude
 * Manages chat state, WebSocket connection, and message flow
 */
export function ChatInterface({
  projectPath,
  projects = [],
  previewUrl,
  embedded = false,
  disableInlinePanel = false,
  cliProviderFixed = null,
  chatId = 'default',
  onSessionIdChange = null,
  onBindControls = null,
  onActivityChange = null,
  tightEdgeLeft = false,
  className = ""
}) {
  
  // Use centralized state management
  const chatState = useChatState(chatId, cliProviderFixed);
  const websocket = useWebSocketConnection();
  
  // Destructure state for cleaner code
  const {
    cliProvider,
    switchProvider,
    messages,
    sessionId,
    sessionActive,
    setSessionActive,
    isTyping,
    setIsTyping,
    typingStatus,
    setTypingStatus,
    activityLock,
    setActivityLock,
    input,
    setInput,
    attachments,
    setAttachments,
    imageAttachments,
    setImageAttachments,
    showSlashMenu,
    setShowSlashMenu,
    slashFilter,
    setSlashFilter,
    selectedCommandIndex,
    setSelectedCommandIndex,
    contextInfo,
    setContextInfo,
    trayInputRef,
    messagesScrollRef,
    addMessage,
    updateMessage,
    clearMessages,
    resetCurrentSession,
    resetTypingState,
    saveChatHistoryToStorage,
    loadChatHistoryFromStorage
  } = chatState;

  // Slash commands configuration
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
    { command: '/theme', description: 'Toggle theme' }
  ].filter(cmd => 
    !slashFilter || cmd.command.toLowerCase().includes(slashFilter.toLowerCase())
  );

  // Expose controls to parent component
  useEffect(() => {
    if (onBindControls) {
      const controls = {
        // Message management
        insert: (text, options = {}) => {
          if (options.mode === 'replace') {
            setInput(text);
          } else {
            setInput(prev => prev + text);
          }
        },
        send: handleSendMessage,
        clear: clearMessages,
        focus: () => trayInputRef.current?.focus(),
        
        // Session management
        new: startNewSession,
        end: endCurrentSession,
        reset: resetCurrentSession,
        
        // Provider management
        switchProvider,
        
        // State getters
        getMessages: () => messages,
        getSessionId: () => sessionId,
        isActive: () => sessionActive
      };
      
      onBindControls(controls);
    }
  }, [onBindControls, messages, sessionId, sessionActive, switchProvider, resetCurrentSession]);

  // Report session ID changes
  useEffect(() => {
    if (onSessionIdChange) {
      onSessionIdChange(sessionId);
    }
  }, [sessionId, onSessionIdChange]);

  // Report activity changes  
  useEffect(() => {
    if (onActivityChange) {
      onActivityChange(activityLock || isTyping);
    }
  }, [activityLock, isTyping, onActivityChange]);

  // Load chat history on mount
  useEffect(() => {
    if (projectPath) {
      loadChatHistoryFromStorage(projectPath);
    }
  }, [projectPath, loadChatHistoryFromStorage]);

  // Save chat history periodically
  useEffect(() => {
    if (projectPath && messages.length > 0) {
      const timer = setTimeout(() => {
        saveChatHistoryToStorage(projectPath);
      }, 1000); // Debounce saves
      
      return () => clearTimeout(timer);
    }
  }, [projectPath, messages, saveChatHistoryToStorage]);

  // WebSocket message handling
  useEffect(() => {
    const unsubscribe = websocket.registerHandler('chat-interface', (message) => {
      log.debug('Received WebSocket message:', message.type);
      
      switch (message.type) {
        case 'claude-response':
        case 'codex-response':
          handleAssistantMessage(message.data);
          break;
          
        case 'claude-error':
        case 'codex-error':
          handleErrorMessage(message.error || message.data?.error);
          break;
          
        case 'claude-complete':
        case 'codex-complete':
          handleConversationComplete();
          break;
          
        case 'session-created':
          handleSessionCreated(message.sessionId);
          break;
          
        case 'context-usage':
          handleContextUpdate(message);
          break;
          
        default:
          log.debug('Unhandled message type:', message.type);
      }
    });

    return unsubscribe;
  }, [websocket.registerHandler]);

  // Message handlers
  const handleAssistantMessage = useCallback((data) => {
    if (!data) return;
    
    // Handle different message formats
    let messageText = '';
    if (typeof data === 'string') {
      messageText = data;
    } else if (data.content) {
      if (Array.isArray(data.content)) {
        messageText = data.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');
      } else {
        messageText = data.content;
      }
    } else if (data.text) {
      messageText = data.text;
    }
    
    if (messageText) {
      addMessage({
        type: 'assistant',
        text: messageText,
        model: data.model || cliProvider
      });
    }
    
    // Update typing state
    setIsTyping(false);
    resetTypingState();
  }, [addMessage, cliProvider, setIsTyping, resetTypingState]);

  const handleErrorMessage = useCallback((error) => {
    const errorText = typeof error === 'string' ? error : error?.message || 'Unknown error';
    
    addMessage({
      type: 'error',
      text: `❌ Error: ${errorText}`
    });
    
    resetTypingState();
    setActivityLock(false);
  }, [addMessage, resetTypingState, setActivityLock]);

  const handleConversationComplete = useCallback(() => {
    log.info('Conversation completed');
    resetTypingState();
    setActivityLock(false);
  }, [resetTypingState, setActivityLock]);

  const handleSessionCreated = useCallback((newSessionId) => {
    log.info('Session created:', newSessionId);
    // Session ID will be updated by the chat state hook
  }, []);

  const handleContextUpdate = useCallback((data) => {
    if (data.provider === cliProvider) {
      setContextInfo(prev => ({
        ...prev,
        estimated_tokens: prev.estimated_tokens + (data.used || 0)
      }));
    }
  }, [cliProvider, setContextInfo]);

  // Action handlers
  const handleSendMessage = useCallback(() => {
    if (!input.trim() || !websocket.isConnected || activityLock) {
      return;
    }

    const messageText = input.trim();
    setInput('');
    
    // Add user message
    addMessage({
      type: 'user',
      text: messageText
    });

    // Set activity states
    setIsTyping(true);
    setActivityLock(true);
    setTypingStatus({ mode: 'thinking', label: 'AI is thinking...' });

    // Send to WebSocket
    const success = websocket.sendMessage({
      type: `${cliProvider}-stream-message`,
      message: messageText,
      sessionId: sessionId,
      projectPath: projectPath,
      attachments: attachments,
      images: imageAttachments
    });

    if (!success) {
      handleErrorMessage('Failed to send message - WebSocket not connected');
      return;
    }

    // Clear attachments
    setAttachments([]);
    setImageAttachments([]);
    
    log.info('Message sent:', { provider: cliProvider, sessionId });
  }, [
    input, websocket, activityLock, addMessage, setInput, setIsTyping, 
    setActivityLock, setTypingStatus, cliProvider, sessionId, projectPath,
    attachments, imageAttachments, setAttachments, setImageAttachments
  ]);

  const startNewSession = useCallback(() => {
    log.info('Starting new session');
    resetCurrentSession();
    
    const success = websocket.sendMessage({
      type: `${cliProvider}-start-session`,
      options: {
        projectPath: projectPath,
        cwd: projectPath
      }
    });

    if (success) {
      setSessionActive(true);
      setIsTyping(true);
      setTypingStatus({ mode: 'initializing', label: 'Starting new session...' });
    } else {
      handleErrorMessage('Failed to start session - WebSocket not connected');
    }
  }, [resetCurrentSession, websocket, cliProvider, projectPath, setSessionActive, setIsTyping, setTypingStatus]);

  const endCurrentSession = useCallback(() => {
    log.info('Ending current session');
    
    if (sessionId) {
      websocket.sendMessage({
        type: `${cliProvider}-end-session`,
        sessionId: sessionId
      });
    }
    
    resetCurrentSession();
  }, [sessionId, websocket, cliProvider, resetCurrentSession]);

  // Slash command handler
  const handleSlashCommand = useCallback((command) => {
    if (!command || command === '') {
      setShowSlashMenu(false);
      return;
    }

    // Show menu if typing
    if (!command.startsWith('/')) {
      setSlashFilter(command);
      setShowSlashMenu(true);
      setSelectedCommandIndex(0);
      return;
    }

    // Execute command
    setShowSlashMenu(false);
    setInput('');
    
    switch (command) {
      case '/clear':
        clearMessages();
        break;
      case '/reset':
        resetCurrentSession();
        break;
      case '/help':
        addMessage({
          type: 'system',
          text: `Available commands:\n${slashCommands.map(cmd => `${cmd.command} - ${cmd.description}`).join('\n')}`
        });
        break;
      default:
        addMessage({
          type: 'system',
          text: `Unknown command: ${command}. Type /help for available commands.`
        });
    }
  }, [setShowSlashMenu, setInput, setSlashFilter, setSelectedCommandIndex, clearMessages, resetCurrentSession, addMessage, slashCommands]);

  // Attachment handlers
  const handleAttachmentRemove = useCallback((index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  }, [setAttachments]);

  const handleImageAttachmentRemove = useCallback((id) => {
    setImageAttachments(prev => prev.filter(img => img.id !== id));
  }, [setImageAttachments]);

  const handleSlashMenuSelect = useCallback((index) => {
    setSelectedCommandIndex(index);
  }, [setSelectedCommandIndex]);

  // Connection status indicator
  const renderConnectionStatus = () => {
    if (embedded) return null;
    
    const { connectionStatus, lastError } = websocket;
    
    if (connectionStatus === 'connected') return null;
    
    return (
      <div className={`px-3 py-2 text-sm border-b ${
        connectionStatus === 'failed' 
          ? 'bg-red-50 dark:bg-red-900/20 border-red-200 text-red-700 dark:text-red-300'
          : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 text-yellow-700 dark:text-yellow-300'
      }`}>
        <div className="flex items-center justify-between">
          <span>
            {connectionStatus === 'reconnecting' && '🔄 Reconnecting...'}
            {connectionStatus === 'failed' && '❌ Connection failed'}
            {connectionStatus === 'disconnected' && '⚡ Disconnected'}
          </span>
          {connectionStatus === 'failed' && (
            <button
              onClick={websocket.forceReconnect}
              className="text-xs underline hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
        {lastError && (
          <div className="text-xs mt-1 opacity-75">
            {lastError.message}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`${embedded 
      ? `w-full h-full flex flex-col bg-card ${tightEdgeLeft ? 'rounded-none border-none' : 'rounded-xl border border-border'}` 
      : 'w-full max-h-[70vh] bg-background rounded-2xl flex flex-col overflow-hidden border border-border shadow-2xl'
    } ${className}`}>
      
      {/* Connection status */}
      {renderConnectionStatus()}
      
      {/* Provider switcher (if not fixed) */}
      {!cliProviderFixed && (
        <div className="px-3 py-2 border-b border-border">
          <div className="flex gap-1">
            <button
              onClick={() => switchProvider('claude')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                cliProvider === 'claude' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Claude
            </button>
            <button
              onClick={() => switchProvider('codex')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                cliProvider === 'codex' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              Codex
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <MessageList
        messages={messages}
        isTyping={isTyping}
        typingStatus={typingStatus}
        contextInfo={contextInfo}
        messagesScrollRef={messagesScrollRef}
      />

      {/* Input */}
      <ChatInput
        input={input}
        setInput={setInput}
        onSend={handleSendMessage}
        onSlashCommand={handleSlashCommand}
        disabled={!websocket.isConnected || activityLock}
        placeholder={`Message ${cliProvider}...`}
        attachments={attachments}
        onAttachmentRemove={handleAttachmentRemove}
        imageAttachments={imageAttachments}
        onImageAttachmentRemove={handleImageAttachmentRemove}
        showSlashMenu={showSlashMenu}
        slashCommands={slashCommands}
        selectedCommandIndex={selectedCommandIndex}
        onSlashMenuSelect={handleSlashMenuSelect}
        trayInputRef={trayInputRef}
        className="border-t border-border"
      />
    </div>
  );
}
