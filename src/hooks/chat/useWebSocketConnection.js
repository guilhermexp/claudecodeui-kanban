import { useState, useEffect, useCallback, useRef } from 'react';
import { useClaudeWebSocket } from '../../contexts/ClaudeWebSocketContext';
import { useChatStore, chatSelectors } from '../../stores/chatStore';
import { createLogger } from '../../utils/logger';
import { useCleanup } from '../useCleanup';

const log = createLogger('WebSocketConnection');

// Global WebSocket manager singleton
class WebSocketManager {
  constructor() {
    this.connection = null;
    this.subscribers = new Set();
    this.messageHandlers = new Map();
    this.heartbeatInterval = null;
    this.reconnectTimeout = null;
    this.isReconnecting = false;
  }

  // Singleton pattern
  static getInstance() {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  // Subscribe to connection events
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  // Notify all subscribers
  notify(event) {
    this.subscribers.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        log.error('Error in WebSocket subscriber:', error);
      }
    });
  }

  // Start heartbeat to keep connection alive
  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (this.connection && this.connection.readyState === WebSocket.OPEN) {
        try {
          this.connection.send(JSON.stringify({ type: 'ping' }));
        } catch (error) {
          log.warn('Heartbeat ping failed:', error);
        }
      }
    }, 30000); // 30 seconds
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
  
  // Graceful shutdown with connection termination
  shutdown() {
    this.stopHeartbeat();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.connection && this.connection.readyState === WebSocket.OPEN) {
      this.connection.close(1000, 'WebSocket manager shutdown');
    }
    this.connection = null;
    this.subscribers.clear();
    this.messageHandlers.clear();
  }
}

const wsManager = WebSocketManager.getInstance();

/**
 * Centralized WebSocket connection hook with global state integration
 * Replaces multiple WebSocket connections with a single managed connection
 */
export function useWebSocketConnection() {
  const { isConnected, sendMessage, registerMessageHandler, connect, disconnect } = useClaudeWebSocket();
  
  // Use global store for connection state
  const connectionState = useChatStore(chatSelectors.connection);
  const setConnectionState = useChatStore(state => state.setConnectionState);
  const updateConnectionActivity = useChatStore(state => state.updateConnectionActivity);
  
  // Cleanup management for graceful teardown
  const { setManagedTimeout, addCleanupTask } = useCleanup();
  
  const messageHandlersRef = useRef(new Map());
  const reconnectTimeoutRef = useRef(null);
  
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 2000; // Start with 2 seconds
  
  // Update connection status based on isConnected
  useEffect(() => {
    if (isConnected) {
      setConnectionState({
        isConnected: true,
        status: 'connected',
        lastError: null,
        reconnectAttempts: 0,
        lastActivity: Date.now()
      });
      wsManager.startHeartbeat();
      log.info('WebSocket connected successfully');
    } else {
      setConnectionState({
        isConnected: false,
        status: 'disconnected'
      });
      wsManager.stopHeartbeat();
      log.warn('WebSocket disconnected');
    }
  }, [isConnected, setConnectionState]);
  
  // Auto-reconnection logic
  const attemptReconnection = useCallback(() => {
    if (connectionState.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      setConnectionState({
        status: 'failed',
        lastError: new Error('Max reconnection attempts reached')
      });
      log.error('WebSocket reconnection failed after max attempts');
      return;
    }
    
    const delay = RECONNECT_DELAY * Math.pow(2, connectionState.reconnectAttempts); // Exponential backoff
    const newAttempts = connectionState.reconnectAttempts + 1;
    
    log.info(`Attempting WebSocket reconnection ${newAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`);
    setConnectionState({
      status: 'reconnecting',
      reconnectAttempts: newAttempts
    });
    
    const { clear } = setManagedTimeout(() => {
      try {
        connect();
      } catch (error) {
        log.error('Reconnection attempt failed:', error);
        setConnectionState({ lastError: error });
        attemptReconnection(); // Try again
      }
    }, delay, `WebSocket reconnect attempt ${newAttempts}`);
    
    reconnectTimeoutRef.current = { clear };
  }, [connect, connectionState.reconnectAttempts, setConnectionState]);
  
  // Handle disconnections with auto-reconnect
  useEffect(() => {
    if (!isConnected && connectionState.status !== 'failed') {
      // Only attempt reconnection if we were previously connected
      if (connectionState.reconnectAttempts === 0 || connectionState.status === 'connected') {
        attemptReconnection();
      }
    }
    
    return () => {
      if (reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current.clear();
        reconnectTimeoutRef.current = null;
      }
    };
  }, [isConnected, connectionState.status, connectionState.reconnectAttempts, attemptReconnection]);
  
  // Cleanup on unmount
  useEffect(() => {
    // Register cleanup tasks for graceful shutdown
    addCleanupTask(() => {
      log.info('Shutting down WebSocket connection manager');
      
      // Cancel any pending reconnections
      if (reconnectTimeoutRef.current) {
        reconnectTimeoutRef.current.clear();
        reconnectTimeoutRef.current = null;
      }
      
      // Clear all message handlers
      messageHandlersRef.current.forEach((unsubscribe, key) => {
        try {
          unsubscribe();
          log.debug(`Cleaned up message handler: ${key}`);
        } catch (error) {
          log.warn(`Error cleaning up message handler ${key}:`, error);
        }
      });
      messageHandlersRef.current.clear();
      
      // Graceful disconnect
      try {
        disconnect();
      } catch (error) {
        log.warn('Error during graceful disconnect:', error);
      }
      
      // Shutdown WebSocket manager
      wsManager.shutdown();
    }, 'WebSocket connection cleanup');
  }, [addCleanupTask, disconnect]);
  
  // Enhanced send message with connection check
  const sendMessageSafe = useCallback((message) => {
    if (!isConnected) {
      log.warn('Attempted to send message while disconnected:', message.type);
      setConnectionState({ lastError: new Error('WebSocket not connected') });
      return false;
    }
    
    try {
      sendMessage(message);
      updateConnectionActivity();
      log.debug('Message sent successfully:', message.type);
      return true;
    } catch (error) {
      log.error('Failed to send WebSocket message:', error);
      setConnectionState({ lastError: error });
      return false;
    }
  }, [isConnected, sendMessage, setConnectionState, updateConnectionActivity]);
  
  // Enhanced message handler registration with cleanup
  const registerHandler = useCallback((key, handler) => {
    log.debug(`Registering message handler: ${key}`);
    
    // Unregister existing handler if any
    const existingUnsubscribe = messageHandlersRef.current.get(key);
    if (existingUnsubscribe) {
      existingUnsubscribe();
    }
    
    // Register new handler
    const unsubscribe = registerMessageHandler(key, (message) => {
      try {
        handler(message);
      } catch (error) {
        log.error(`Error in message handler ${key}:`, error);
        setLastError(error);
      }
    });
    
    // Store unsubscribe function
    messageHandlersRef.current.set(key, unsubscribe);
    
    // Return cleanup function
    return () => {
      log.debug(`Unregistering message handler: ${key}`);
      if (unsubscribe) {
        unsubscribe();
      }
      messageHandlersRef.current.delete(key);
    };
  }, [registerMessageHandler]);
  
  // Force reconnection
  const forceReconnect = useCallback(() => {
    log.info('Force reconnection requested');
    setConnectionState({
      reconnectAttempts: 0,
      lastError: null
    });
    
    if (reconnectTimeoutRef.current) {
      reconnectTimeoutRef.current.clear();
      reconnectTimeoutRef.current = null;
    }
    
    // Disconnect first, then reconnect
    try {
      disconnect();
    } catch (error) {
      log.warn('Error during disconnect:', error);
    }
    
    // Attempt immediate reconnection with managed timeout
    const { clear } = setManagedTimeout(() => {
      attemptReconnection();
    }, 100, 'force reconnect delay');
    
    reconnectTimeoutRef.current = { clear };
  }, [disconnect, attemptReconnection, setConnectionState]);
  
  // Manual connection control
  const connectManual = useCallback(() => {
    log.info('Manual connection requested');
    setConnectionState({
      reconnectAttempts: 0,
      lastError: null,
      status: 'connecting'
    });
    
    try {
      connect();
    } catch (error) {
      log.error('Manual connection failed:', error);
      setConnectionState({ 
        lastError: error,
        status: 'failed' 
      });
    }
  }, [connect, setConnectionState]);
  
  const disconnectManual = useCallback(() => {
    log.info('Manual disconnection requested');
    
    // Cancel any pending reconnection
    if (reconnectTimeoutRef.current) {
      reconnectTimeoutRef.current.clear();
      reconnectTimeoutRef.current = null;
    }
    
    // Set max attempts to prevent auto-reconnection
    setConnectionState({
      reconnectAttempts: MAX_RECONNECT_ATTEMPTS,
      status: 'disconnected'
    });
    
    try {
      disconnect();
    } catch (error) {
      log.error('Manual disconnection error:', error);
      setConnectionState({ lastError: error });
    }
  }, [disconnect, setConnectionState]);
  
  return {
    // Connection state from store
    ...connectionState,
    
    // Connection control
    connect: connectManual,
    disconnect: disconnectManual,
    forceReconnect,
    
    // Message handling
    sendMessage: sendMessageSafe,
    registerHandler,
    
    // Stats
    handlersCount: messageHandlersRef.current.size,
    maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS
  };
}
