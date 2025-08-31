import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

const ClaudeWebSocketContext = createContext();

export const useClaudeWebSocket = () => {
  const context = useContext(ClaudeWebSocketContext);
  if (!context) {
    throw new Error('useClaudeWebSocket must be used within a ClaudeWebSocketProvider');
  }
  return context;
};

export const ClaudeWebSocketProvider = ({ children }) => {
  const { token, isLoading: authLoading } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const ws = useRef(null);
  const reconnectAttempts = useRef(0);
  const heartbeatInterval = useRef(null);
  const reconnectTimeout = useRef(null);
  const hasInitialized = useRef(false);
  
  // Message handlers for different consumers
  const messageHandlers = useRef(new Map());
  const connectionHandlers = useRef(new Map());
  
  // Session management
  const [sessions, setSessions] = useState({
    shell: null,
    chat: null,
    codex: null
  });

  // Register a handler for incoming messages
  const registerMessageHandler = useCallback((id, handler) => {
    messageHandlers.current.set(id, handler);
    return () => messageHandlers.current.delete(id);
  }, []);

  // Register a handler for connection events
  const registerConnectionHandler = useCallback((id, handler) => {
    connectionHandlers.current.set(id, handler);
    // Immediately call with current status
    handler({ isConnected, isConnecting });
    return () => connectionHandlers.current.delete(id);
  }, [isConnected, isConnecting]);

  // Send message through WebSocket
  const sendMessage = useCallback((message) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
      return true;
    }
    return false;
  }, []);

  // Initialize a session (shell, chat, or codex)
  const initSession = useCallback((type, options = {}) => {
    const message = {
      type: type === 'shell' ? 'init' : `${type}-start-session`,
      ...options
    };
    
    if (sendMessage(message)) {
      setSessions(prev => ({
        ...prev,
        [type]: { ...options, active: true }
      }));
      return true;
    }
    return false;
  }, [sendMessage]);

  // End a session
  const endSession = useCallback((type) => {
    const message = {
      type: type === 'shell' ? 'exit' : `${type}-end-session`
    };
    
    if (sendMessage(message)) {
      setSessions(prev => ({
        ...prev,
        [type]: null
      }));
      return true;
    }
    return false;
  }, [sendMessage]);

  // Connect to WebSocket
  const connect = useCallback(async () => {
    if (isConnecting || isConnected || !token) return;
    
    setIsConnecting(true);
    
    try {
      // Get server configuration
      let wsBaseUrl;
      try {
        const configResponse = await fetch('/api/config', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const config = await configResponse.json();
        wsBaseUrl = config.wsUrl;
        
        // Handle localhost vs network access
        if (wsBaseUrl.includes('localhost') && !window.location.hostname.includes('localhost')) {
          const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
          wsBaseUrl = `${protocol}//${window.location.host}`;
        }
      } catch (error) {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBaseUrl = `${protocol}//${window.location.host}`;
      }
      
      // Create WebSocket connection with token
      const wsUrl = `${wsBaseUrl}/claude?token=${encodeURIComponent(token)}`;
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        setIsConnected(true);
        setIsConnecting(false);
        reconnectAttempts.current = 0;
        hasInitialized.current = true;
        
        // Notify all connection handlers
        connectionHandlers.current.forEach(handler => {
          handler({ isConnected: true, isConnecting: false });
        });
        
        // Start heartbeat
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
        }
        heartbeatInterval.current = setInterval(() => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };
      
      ws.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Distribute message to all registered handlers
          messageHandlers.current.forEach(handler => {
            handler(data);
          });
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
      
      ws.current.onclose = () => {
        setIsConnected(false);
        setIsConnecting(false);
        ws.current = null;
        
        // Clear heartbeat
        if (heartbeatInterval.current) {
          clearInterval(heartbeatInterval.current);
          heartbeatInterval.current = null;
        }
        
        // Notify all connection handlers
        connectionHandlers.current.forEach(handler => {
          handler({ isConnected: false, isConnecting: false });
        });
        
        // Attempt reconnection if we still have a token
        if (token && reconnectAttempts.current < 5) {
          reconnectAttempts.current++;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 10000);
          
          reconnectTimeout.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };
      
      ws.current.onerror = (error) => {
        console.error('Claude WebSocket error:', error);
        setIsConnecting(false);
      };
      
    } catch (error) {
      console.error('Error creating Claude WebSocket connection:', error);
      setIsConnecting(false);
    }
  }, [token]);

  // Disconnect WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }
    
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
    
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
    
    setIsConnected(false);
    setIsConnecting(false);
    hasInitialized.current = false;
    reconnectAttempts.current = 0;
  }, []);

  // Auto-connect when token is available
  useEffect(() => {
    if (token && !authLoading && !isConnected && !isConnecting) {
      connect();
    }
    
    return () => {
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
      }
    };
  }, [token, authLoading, connect, isConnected, isConnecting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  const value = {
    isConnected,
    isConnecting,
    sendMessage,
    registerMessageHandler,
    registerConnectionHandler,
    initSession,
    endSession,
    sessions,
    connect,
    disconnect
  };

  return (
    <ClaudeWebSocketContext.Provider value={value}>
      {children}
    </ClaudeWebSocketContext.Provider>
  );
};