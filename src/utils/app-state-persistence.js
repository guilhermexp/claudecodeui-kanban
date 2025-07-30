// App State Persistence - Maintains application state across navigation
export const appStatePersistence = {
  // Keys for different state components
  KEYS: {
    SELECTED_PROJECT: 'app-selected-project',
    SELECTED_SESSION: 'app-selected-session',
    ACTIVE_TAB: 'app-active-tab',
    SIDEBAR_OPEN: 'app-sidebar-open',
    CHAT_MESSAGES: 'app-chat-messages',
    CHAT_INPUT: 'app-chat-input',
    SESSION_CONTEXT: 'app-session-context',
    NAVIGATION_STACK: 'app-navigation-stack',
  },

  // Save state
  saveState: (state) => {
    try {
      Object.entries(state).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          localStorage.setItem(key, JSON.stringify(value));
        }
      });
    } catch (error) {
      // Error: 'Failed to save app state:', error
    }
  },

  // Load state
  loadState: () => {
    const state = {};
    try {
      Object.values(appStatePersistence.KEYS).forEach(key => {
        const saved = localStorage.getItem(key);
        if (saved) {
          state[key] = JSON.parse(saved);
        }
      });
    } catch (error) {
      // Error: 'Failed to load app state:', error
    }
    return state;
  },

  // Clear specific state
  clearState: (keys = []) => {
    if (keys.length === 0) {
      // Clear all app state
      Object.values(appStatePersistence.KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } else {
      // Clear specific keys
      keys.forEach(key => {
        localStorage.removeItem(key);
      });
    }
  },

  // Save navigation context
  saveNavigationContext: (context) => {
    try {
      const stack = JSON.parse(localStorage.getItem(appStatePersistence.KEYS.NAVIGATION_STACK) || '[]');
      stack.push({
        ...context,
        timestamp: Date.now()
      });
      // Keep only last 10 navigation entries
      if (stack.length > 10) {
        stack.shift();
      }
      localStorage.setItem(appStatePersistence.KEYS.NAVIGATION_STACK, JSON.stringify(stack));
    } catch (error) {
      // Error: 'Failed to save navigation context:', error
    }
  },

  // Get last navigation context
  getLastNavigationContext: () => {
    try {
      const stack = JSON.parse(localStorage.getItem(appStatePersistence.KEYS.NAVIGATION_STACK) || '[]');
      return stack[stack.length - 1] || null;
    } catch (error) {
      // Error: 'Failed to get navigation context:', error
      return null;
    }
  },

  // Save chat state
  saveChatState: (sessionId, messages, inputValue, scrollPosition = null) => {
    try {
      const chatState = {
        sessionId,
        messages,
        inputValue,
        scrollPosition,
        timestamp: Date.now()
      };
      localStorage.setItem(appStatePersistence.KEYS.CHAT_MESSAGES, JSON.stringify(chatState));
    } catch (error) {
      // Error: 'Failed to save chat state:', error
    }
  },

  // Load chat state
  loadChatState: (sessionId) => {
    try {
      const saved = localStorage.getItem(appStatePersistence.KEYS.CHAT_MESSAGES);
      if (saved) {
        const chatState = JSON.parse(saved);
        // Only return if it's for the same session and less than 30 minutes old
        if (chatState.sessionId === sessionId && 
            Date.now() - chatState.timestamp < 30 * 60 * 1000) {
          return chatState;
        }
      }
    } catch (error) {
      // Error: 'Failed to load chat state:', error
    }
    return null;
  }
};