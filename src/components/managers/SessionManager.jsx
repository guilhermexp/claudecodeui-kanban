import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createLogger } from '../../utils/logger';

// Context
const SessionManagerContext = createContext();

// Custom hook
export const useSessionManager = () => {
  const context = useContext(SessionManagerContext);
  if (!context) {
    throw new Error('useSessionManager must be used within a SessionManager');
  }
  return context;
};

// Manager component
export const SessionManager = ({ 
  children, 
  onSessionActive,
  onSessionInactive,
  onReplaceTemporarySession,
  onNavigateToSession
}) => {
  const [sessions, setSessions] = useState({
    claude: {
      id: null,
      controls: null,
      isActive: false,
    },
    codex: {
      controls: null,
      isActive: false,
    },
  });
  const [chatActivity, setChatActivity] = useState(false);
  const logger = createLogger('SessionManager');

  // Actions
  const setSessionId = useCallback((provider, id) => {
    setSessions(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        id,
      }
    }));
    
    if (provider === 'claude' && id) {
      logger.debug(`Claude session ID set: ${id}`);
    }
  }, [logger]);

  const setSessionControls = useCallback((provider, controls) => {
    setSessions(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        controls,
      }
    }));
    
    logger.debug(`${provider} controls updated:`, {
      hasEnd: typeof controls?.end === 'function',
      hasNew: typeof controls?.new === 'function',
      hasInsert: typeof controls?.insert === 'function',
      hasSend: typeof controls?.send === 'function',
    });
  }, [logger]);

  const setProviderActive = useCallback((provider, isActive) => {
    setSessions(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        isActive,
      }
    }));
    
    // Notify parent callbacks
    if (isActive && onSessionActive) {
      onSessionActive();
    } else if (!isActive && onSessionInactive) {
      onSessionInactive();
    }
  }, [onSessionActive, onSessionInactive]);

  const setChatActivityState = useCallback((active) => {
    setChatActivity(active);
    
    // If any provider becomes active, mark chat as active
    if (active) {
      setSessions(prev => {
        const hasActiveProvider = Object.values(prev).some(session => session.isActive);
        if (!hasActiveProvider) {
          // Mark claude as active by default when chat activity starts
          return {
            ...prev,
            claude: { ...prev.claude, isActive: true }
          };
        }
        return prev;
      });
      
      if (onSessionActive) {
        onSessionActive();
      }
    } else {
      // Mark all providers as inactive
      setSessions(prev => 
        Object.keys(prev).reduce((acc, provider) => ({
          ...acc,
          [provider]: { ...prev[provider], isActive: false }
        }), {})
      );
      
      if (onSessionInactive) {
        onSessionInactive();
      }
    }
  }, [onSessionActive, onSessionInactive]);

  const ensureProviderReady = useCallback(async (provider, { timeout = 2000, interval = 50 } = {}) => {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const session = sessions[provider];
        if (session?.controls && typeof session.controls.insert === 'function') {
          return resolve(true);
        }
        if (Date.now() - start >= timeout) {
          return resolve(false);
        }
        setTimeout(check, interval);
      };
      check();
    });
  }, [sessions]);

  const replaceTemporarySession = useCallback((oldId, newId) => {
    if (onReplaceTemporarySession) {
      onReplaceTemporarySession(oldId, newId);
    }
    
    // Update claude session ID if it matches the old temporary ID
    if (sessions.claude.id === oldId) {
      setSessionId('claude', newId);
    }
  }, [onReplaceTemporarySession, sessions.claude.id, setSessionId]);

  const navigateToSession = useCallback((sessionId) => {
    if (onNavigateToSession) {
      onNavigateToSession(sessionId);
    }
  }, [onNavigateToSession]);

  // Setup global prompt enhancer
  useEffect(() => {
    const openPromptEnhancer = () => {
      // This will be handled by ModalManager
      if (window.openPromptEnhancer) {
        window.openPromptEnhancer();
      }
    };
    
    window.openPromptEnhancer = openPromptEnhancer;
    
    return () => {
      try {
        delete window.openPromptEnhancer;
      } catch {}
    };
  }, []);

  // Context value
  const value = {
    // State
    sessions,
    chatActivity,
    
    // Actions
    setSessionId,
    setSessionControls,
    setProviderActive,
    setChatActivity: setChatActivityState,
    
    // Utilities
    ensureProviderReady,
    replaceTemporarySession,
    navigateToSession,
    
    // Computed
    hasActiveSession: Object.values(sessions).some(session => session.isActive),
    getSessionControls: (provider) => sessions[provider]?.controls,
    getSessionId: (provider) => sessions[provider]?.id,
    isProviderActive: (provider) => sessions[provider]?.isActive || false,
    
    // Claude-specific helpers
    claudeSessionId: sessions.claude.id,
    claudeControls: sessions.claude.controls,
    isClaudeActive: sessions.claude.isActive,
    
    // Codex-specific helpers  
    codexControls: sessions.codex.controls,
    isCodexActive: sessions.codex.isActive,
  };

  return (
    <SessionManagerContext.Provider value={value}>
      {children}
    </SessionManagerContext.Provider>
  );
};

export default SessionManager;
