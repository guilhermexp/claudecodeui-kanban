import { useState, useCallback, useEffect, useRef } from 'react';
import {
  processMessage,
  filterExpiredMessages,
  createTemporaryMessage,
  createLoadingMessage,
  replaceLoadingMessage,
  deduplicateMessages,
  createStatusMessage
} from '../utils/message-feedback';

/**
 * Custom hook for intelligent message feedback management
 */
export function useMessageFeedback(initialMessages = []) {
  const [messages, setMessages] = useState(initialMessages);
  const [statusMessage, setStatusMessage] = useState(null);
  const timersRef = useRef(new Map());
  const loadingMessagesRef = useRef(new Map());

  // Clean up expired messages periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages(prev => {
        const filtered = filterExpiredMessages(prev);
        if (filtered.length !== prev.length) {
          console.log(`🧹 Cleaned ${prev.length - filtered.length} expired messages`);
        }
        return filtered;
      });
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, []);

  // Add a message with processing
  const addMessage = useCallback((message) => {
    const processed = processMessage(message);
    
    setMessages(prev => {
      // Remove duplicates within a 1-second window
      const withNew = [...prev, processed];
      return deduplicateMessages(withNew, 1000);
    });

    // Set up auto-dismiss timer if needed
    if (processed.temporary && processed.dismissTimeout) {
      const timerId = setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== processed.id));
        timersRef.current.delete(processed.id);
        console.log(`🗑️ Auto-dismissed: ${processed.text.substring(0, 30)}...`);
      }, processed.dismissTimeout);
      
      timersRef.current.set(processed.id, timerId);
    }

    return processed.id;
  }, []);

  // Add a temporary message
  const addTemporary = useCallback((text, type = 'system', timeout = null) => {
    const message = createTemporaryMessage(text, type, timeout);
    return addMessage(message);
  }, [addMessage]);

  // Start a loading operation
  const startLoading = useCallback((operation) => {
    const message = createLoadingMessage(operation);
    loadingMessagesRef.current.set(operation, message.id);
    addMessage(message);
    return message.id;
  }, [addMessage]);

  // Complete a loading operation
  const completeLoading = useCallback((operation, resultText, success = true) => {
    const loadingId = loadingMessagesRef.current.get(operation);
    if (loadingId) {
      const resultMessage = {
        type: success ? 'success' : 'error',
        text: resultText,
        timestamp: Date.now(),
        temporary: true,
        dismissTimeout: 2000
      };
      
      setMessages(prev => replaceLoadingMessage(prev, loadingId, resultMessage));
      loadingMessagesRef.current.delete(operation);
      
      // Auto-dismiss after timeout
      setTimeout(() => {
        setMessages(prev => prev.filter(m => m.id !== loadingId));
      }, resultMessage.dismissTimeout);
    }
  }, []);

  // Update status bar
  const updateStatus = useCallback((operation, progress = null) => {
    const status = createStatusMessage(operation, progress);
    setStatusMessage(status);
    
    // Auto-clear status after 3 seconds of no updates
    setTimeout(() => {
      setStatusMessage(prev => prev?.id === status.id ? null : prev);
    }, 3000);
  }, []);

  // Clear all temporary messages
  const clearTemporary = useCallback(() => {
    // Clear all timers
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
    
    // Remove temporary messages
    setMessages(prev => prev.filter(m => !m.temporary));
    console.log('🧹 Cleared all temporary messages');
  }, []);

  // Clear all messages
  const clearAll = useCallback(() => {
    // Clear all timers
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
    loadingMessagesRef.current.clear();
    
    setMessages([]);
    setStatusMessage(null);
    console.log('🗑️ Cleared all messages');
  }, []);

  // Remove a specific message
  const removeMessage = useCallback((id) => {
    // Clear timer if exists
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    
    setMessages(prev => prev.filter(m => m.id !== id));
  }, []);

  // Update a message
  const updateMessage = useCallback((id, updates) => {
    setMessages(prev => prev.map(m => 
      m.id === id ? { ...m, ...updates } : m
    ));
  }, []);

  // Clean up timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, []);

  return {
    messages,
    statusMessage,
    addMessage,
    addTemporary,
    startLoading,
    completeLoading,
    updateStatus,
    clearTemporary,
    clearAll,
    removeMessage,
    updateMessage,
    setMessages // For bulk operations
  };
}