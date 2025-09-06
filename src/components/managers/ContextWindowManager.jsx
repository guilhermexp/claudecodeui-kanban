import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useClaudeWebSocket } from '../../contexts/ClaudeWebSocketContext';

// Context
const ContextWindowManagerContext = createContext();

// Custom hook
export const useContextWindowManager = () => {
  const context = useContext(ContextWindowManagerContext);
  if (!context) {
    throw new Error('useContextWindowManager must be used within a ContextWindowManager');
  }
  return context;
};

// Manager component
export const ContextWindowManager = ({ children }) => {
  const [contextUsage, setContextUsage] = useState({ claude: 0, codex: 0 });
  const [contextLimits, setContextLimits] = useState({ claude: 200000, codex: 200000 });
  const [contextPercentage, setContextPercentage] = useState(0);
  const { registerMessageHandler } = useClaudeWebSocket();

  // Actions
  const resetContext = useCallback((provider) => {
    setContextUsage(prev => ({ ...prev, [provider]: 0 }));
    if (provider === 'claude' || provider === 'codex') {
      setContextPercentage(0);
    }
  }, []);

  const updateUsage = useCallback((provider, used) => {
    const usedIncrement = Number(used || 0);
    
    setContextUsage((prev) => {
      const next = { ...prev };
      if (!Number.isFinite(next[provider])) next[provider] = 0;
      next[provider] += usedIncrement;
      
      // Compute limit based on provider
      let limit = contextLimits[provider] || 200000;
      if (provider === 'codex') {
        try {
          const label = (localStorage.getItem('codex-model-label') || '').toLowerCase();
          limit = label === 'gpt-high' ? 400000 : 200000;
          setContextLimits(prev => ({ ...prev, codex: limit }));
        } catch {}
      }
      
      const pct = Math.max(0, Math.min(100, Math.round((next[provider] / Math.max(1, limit)) * 100)));
      setContextPercentage(pct);
      
      return next;
    });
  }, [contextLimits]);

  // WebSocket message handlers
  useEffect(() => {
    const unsubContextWindow = registerMessageHandler('ctx-window', (msg) => {
      try {
        if (!msg || msg.type !== 'context-usage') return;
        
        // Server may send percentage directly. Prefer it if present.
        if (typeof msg.percentage === 'number') {
          setContextPercentage(Math.max(0, Math.min(100, Math.round(msg.percentage))));
          return;
        }
        
        // Otherwise compute locally using provider defaults and accumulated usage.
        const provider = (msg.provider || 'claude').toLowerCase();
        const used = msg.used || 0;
        updateUsage(provider, used);
      } catch (error) {
        console.error('Error handling context window message:', error);
      }
    });

    return () => { 
      try { 
        unsubContextWindow && unsubContextWindow(); 
      } catch {} 
    };
  }, [registerMessageHandler, updateUsage]);

  // Reset context usage counters when new sessions start
  useEffect(() => {
    const unsubContextReset = registerMessageHandler('ctx-reset', (msg) => {
      try {
        if (!msg) return;
        if (msg.type === 'claude-session-started') {
          resetContext('claude');
        } else if (msg.type === 'codex-session-started') {
          resetContext('codex');
        }
      } catch (error) {
        console.error('Error handling context reset message:', error);
      }
    });

    return () => { 
      try { 
        unsubContextReset && unsubContextReset(); 
      } catch {} 
    };
  }, [registerMessageHandler, resetContext]);

  // Context value
  const value = {
    // State
    contextUsage,
    contextLimits,
    contextPercentage,
    
    // Actions
    resetContext,
    updateUsage,
    
    // WebSocket integration (derived from useClaudeWebSocket)
    isConnected: true, // TODO: Get from WebSocket context
    connectionState: 'connected', // TODO: Get from WebSocket context
    
    // Computed
    getUsagePercentage: (provider) => {
      const used = contextUsage[provider] || 0;
      const limit = contextLimits[provider] || 200000;
      return Math.max(0, Math.min(100, Math.round((used / Math.max(1, limit)) * 100)));
    },
    
    isNearLimit: (provider, threshold = 80) => {
      const percentage = value.getUsagePercentage ? value.getUsagePercentage(provider) : 0;
      return percentage >= threshold;
    },
  };

  // Fix the computed functions to avoid circular reference
  value.getUsagePercentage = (provider) => {
    const used = contextUsage[provider] || 0;
    const limit = contextLimits[provider] || 200000;
    return Math.max(0, Math.min(100, Math.round((used / Math.max(1, limit)) * 100)));
  };

  value.isNearLimit = (provider, threshold = 80) => {
    const percentage = value.getUsagePercentage(provider);
    return percentage >= threshold;
  };

  return (
    <ContextWindowManagerContext.Provider value={value}>
      {children}
    </ContextWindowManagerContext.Provider>
  );
};

export default ContextWindowManager;
