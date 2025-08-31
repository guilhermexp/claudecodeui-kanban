import { useState, useEffect, useCallback, useRef } from 'react';
import { useClaudeWebSocket } from '../contexts/ClaudeWebSocketContext';

/**
 * Hook to manage Claude sessions (shell or chat)
 * Provides a simpler interface for components to interact with Claude
 */
export function useClaudeSession(type = 'chat', options = {}) {
  const {
    isConnected,
    isConnecting,
    sendMessage: wsSendMessage,
    registerMessageHandler,
    registerConnectionHandler,
    initSession,
    endSession,
    sessions
  } = useClaudeWebSocket();
  
  const [messages, setMessages] = useState([]);
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messageHandlerId = useRef(`${type}-${Date.now()}`);
  
  // Handle incoming messages
  useEffect(() => {
    const handleMessage = (data) => {
      // Filter messages based on type
      if (type === 'shell') {
        // Shell-specific message handling
        if (data.type === 'output' || data.type === 'error' || data.type === 'exit') {
          setMessages(prev => [...prev, data]);
        }
        if (data.type === 'session-created') {
          setSessionId(data.sessionId);
          setSessionActive(true);
        }
      } else if (type === 'chat') {
        // Chat-specific message handling for Claude
        if (data.type === 'claude-message' || 
            data.type === 'claude-session-started' ||
            data.type === 'claude-session-closed' ||
            data.type === 'error') {
          setMessages(prev => [...prev, data]);
        }
        if (data.type === 'claude-session-started') {
          setSessionId(data.sessionId);
          setSessionActive(true);
        }
        if (data.type === 'claude-session-closed') {
          setSessionActive(false);
        }
      } else if (type === 'codex') {
        // Codex-specific message handling
        if (data.type === 'codex-message' || 
            data.type === 'codex-session-started' ||
            data.type === 'codex-session-closed' ||
            data.type === 'codex-event' ||
            data.type === 'error') {
          setMessages(prev => [...prev, data]);
        }
        if (data.type === 'codex-session-started') {
          setSessionActive(true);
        }
        if (data.type === 'codex-session-closed') {
          setSessionActive(false);
        }
      }
    };
    
    return registerMessageHandler(messageHandlerId.current, handleMessage);
  }, [type, registerMessageHandler]);
  
  // Handle connection status changes
  useEffect(() => {
    const handleConnection = ({ isConnected, isConnecting }) => {
      if (!isConnected && sessionActive) {
        // Connection lost while session was active
        setSessionActive(false);
      }
    };
    
    return registerConnectionHandler(messageHandlerId.current, handleConnection);
  }, [sessionActive, registerConnectionHandler]);
  
  // Start session
  const startSession = useCallback((sessionOptions = {}) => {
    const mergedOptions = { ...options, ...sessionOptions };
    
    if (type === 'shell') {
      // Shell-specific initialization
      return initSession('shell', {
        projectPath: mergedOptions.projectPath,
        sessionId: mergedOptions.sessionId,
        cols: mergedOptions.cols || 80,
        rows: mergedOptions.rows || 24,
        bypassPermissions: mergedOptions.bypassPermissions
      });
    } else if (type === 'chat') {
      // Claude chat initialization
      return initSession('claude', {
        projectPath: mergedOptions.projectPath,
        sessionId: mergedOptions.sessionId
      });
    } else if (type === 'codex') {
      // Codex initialization
      return initSession('codex', {
        projectPath: mergedOptions.projectPath,
        cwd: mergedOptions.projectPath
      });
    }
  }, [type, options, initSession]);
  
  // End session
  const stopSession = useCallback(() => {
    const typeMap = {
      'shell': 'shell',
      'chat': 'claude',
      'codex': 'codex'
    };
    return endSession(typeMap[type]);
  }, [type, endSession]);
  
  // Send message
  const sendMessage = useCallback((message) => {
    if (type === 'shell') {
      // Shell input
      return wsSendMessage({
        type: 'input',
        data: message
      });
    } else if (type === 'chat') {
      // Claude chat message
      return wsSendMessage({
        type: 'claude-message',
        message: message,
        sessionId: sessionId
      });
    } else if (type === 'codex') {
      // Codex message
      return wsSendMessage({
        type: 'codex-message',
        message: message
      });
    }
  }, [type, sessionId, wsSendMessage]);
  
  // Send resize (shell only)
  const sendResize = useCallback((cols, rows) => {
    if (type === 'shell') {
      return wsSendMessage({
        type: 'resize',
        cols,
        rows
      });
    }
  }, [type, wsSendMessage]);
  
  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  return {
    // Connection status
    isConnected,
    isConnecting,
    
    // Session management
    sessionActive,
    sessionId,
    startSession,
    stopSession,
    
    // Messaging
    messages,
    sendMessage,
    clearMessages,
    
    // Shell-specific
    ...(type === 'shell' ? { sendResize } : {})
  };
}