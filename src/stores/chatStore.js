import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { createLogger } from '../utils/logger';

const log = createLogger('ChatStore');

/**
 * Global chat store - consolidates all chat state to eliminate duplication
 * Uses Zustand with persistence and immer for immutable updates
 */
export const useChatStore = create()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        // Connection state (single source of truth)
        connection: {
          isConnected: false,
          status: 'disconnected', // 'connecting' | 'connected' | 'disconnected' | 'reconnecting' | 'failed'
          lastError: null,
          reconnectAttempts: 0,
          lastActivity: null
        },

        // Session management (consolidated from multiple contexts)
        sessions: {
          claude: {
            sessionId: null,
            active: false,
            messages: [],
            lastActivity: null,
            contextInfo: {
              num_turns: 0,
              duration_ms: 0,
              estimated_tokens: 0,
              max_context: 200000
            }
          },
          codex: {
            sessionId: null,
            active: false,
            messages: [],
            lastActivity: null,
            contextInfo: {
              num_turns: 0,
              duration_ms: 0,
              estimated_tokens: 0,
              max_context: 400000
            }
          }
        },

        // UI state (centralized from multiple components)
        ui: {
          activeProvider: 'claude',
          isTyping: false,
          typingStatus: { mode: 'idle', label: '' },
          activityLock: false,
          currentInput: '',
          attachments: [],
          imageAttachments: [],
          showSlashMenu: false,
          slashFilter: '',
          selectedCommandIndex: 0
        },

        // Project context
        project: {
          currentPath: null,
          availableProjects: [],
          selectedSession: null
        },

        // Actions for connection management
        setConnectionState: (updates) => set((state) => {
          Object.assign(state.connection, updates);
          if (updates.isConnected !== undefined) {
            log.debug('Connection state updated:', updates);
          }
        }),

        updateConnectionActivity: () => set((state) => {
          state.connection.lastActivity = Date.now();
        }),

        // Actions for session management
        setSessionState: (provider, updates) => set((state) => {
          if (!state.sessions[provider]) {
            state.sessions[provider] = {
              sessionId: null,
              active: false,
              messages: [],
              lastActivity: null,
              contextInfo: {
                num_turns: 0,
                duration_ms: 0,
                estimated_tokens: 0,
                max_context: provider === 'claude' ? 200000 : 400000
              }
            };
          }
          Object.assign(state.sessions[provider], updates);
          if (updates.active !== undefined || updates.sessionId !== undefined) {
            log.debug(`Session ${provider} updated:`, updates);
          }
        }),

        addMessage: (provider, message) => set((state) => {
          const session = state.sessions[provider];
          if (session) {
            const newMessage = {
              ...message,
              id: message.id || Date.now() + Math.random(),
              timestamp: message.timestamp || new Date().toISOString()
            };
            session.messages.push(newMessage);
            session.lastActivity = Date.now();
            log.debug(`Message added to ${provider}:`, newMessage.type);
          }
        }),

        updateMessage: (provider, messageId, updates) => set((state) => {
          const session = state.sessions[provider];
          if (session) {
            const messageIndex = session.messages.findIndex(m => m.id === messageId);
            if (messageIndex !== -1) {
              Object.assign(state.sessions[provider].messages[messageIndex], updates);
            }
          }
        }),

        clearMessages: (provider) => set((state) => {
          const session = state.sessions[provider];
          if (session) {
            session.messages = [];
            log.debug(`Messages cleared for ${provider}`);
          }
        }),

        resetSession: (provider) => set((state) => {
          const session = state.sessions[provider];
          if (session) {
            session.sessionId = null;
            session.active = false;
            session.messages = [];
            session.lastActivity = null;
            session.contextInfo = {
              num_turns: 0,
              duration_ms: 0,
              estimated_tokens: 0,
              max_context: provider === 'claude' ? 200000 : 400000
            };
            log.info(`Session ${provider} reset`);
          }
        }),

        updateContextInfo: (provider, updates) => set((state) => {
          const session = state.sessions[provider];
          if (session) {
            Object.assign(session.contextInfo, updates);
          }
        }),

        // Actions for UI state management
        setUIState: (updates) => set((state) => {
          Object.assign(state.ui, updates);
        }),

        switchProvider: (provider) => set((state) => {
          if (state.ui.activeProvider !== provider) {
            state.ui.activeProvider = provider;
            // Reset typing states when switching
            state.ui.isTyping = false;
            state.ui.activityLock = false;
            state.ui.typingStatus = { mode: 'idle', label: '' };
            log.info(`Switched to provider: ${provider}`);
          }
        }),

        setInput: (text) => set((state) => {
          state.ui.currentInput = text;
        }),

        addAttachment: (attachment) => set((state) => {
          state.ui.attachments.push(attachment);
        }),

        removeAttachment: (index) => set((state) => {
          state.ui.attachments.splice(index, 1);
        }),

        addImageAttachment: (image) => set((state) => {
          state.ui.imageAttachments.push(image);
        }),

        removeImageAttachment: (id) => set((state) => {
          state.ui.imageAttachments = state.ui.imageAttachments.filter(img => img.id !== id);
        }),

        clearAttachments: () => set((state) => {
          state.ui.attachments = [];
          state.ui.imageAttachments = [];
        }),

        // Actions for project management
        setProjectState: (updates) => set((state) => {
          Object.assign(state.project, updates);
        }),

        setCurrentProject: (projectPath) => set((state) => {
          state.project.currentPath = projectPath;
          log.debug('Current project set:', projectPath);
        }),

        // Computed selectors (getters)
        getCurrentSession: () => {
          const { ui, sessions } = get();
          return sessions[ui.activeProvider];
        },

        getCurrentMessages: () => {
          const { ui, sessions } = get();
          return sessions[ui.activeProvider]?.messages || [];
        },

        getSessionById: (sessionId) => {
          const { sessions } = get();
          for (const [provider, session] of Object.entries(sessions)) {
            if (session.sessionId === sessionId) {
              return { provider, session };
            }
          }
          return null;
        },

        isAnySessionActive: () => {
          const { sessions } = get();
          return Object.values(sessions).some(session => session.active);
        },

        hasMessages: (provider = null) => {
          const { ui, sessions } = get();
          const targetProvider = provider || ui.activeProvider;
          return sessions[targetProvider]?.messages.length > 0;
        },

        // Bulk actions for performance
        bulkUpdateMessages: (provider, messageUpdates) => set((state) => {
          const session = state.sessions[provider];
          if (session && Array.isArray(messageUpdates)) {
            messageUpdates.forEach(({ messageId, updates }) => {
              const messageIndex = session.messages.findIndex(m => m.id === messageId);
              if (messageIndex !== -1) {
                Object.assign(session.messages[messageIndex], updates);
              }
            });
          }
        }),

        // Debug actions
        getStateSnapshot: () => {
          const state = get();
          return {
            connection: state.connection,
            sessionsCount: Object.keys(state.sessions).length,
            messagesCount: Object.values(state.sessions).reduce(
              (total, session) => total + session.messages.length, 
              0
            ),
            activeProvider: state.ui.activeProvider,
            currentProject: state.project.currentPath
          };
        },

        // Cleanup action
        cleanup: () => set((state) => {
          // Reset to initial state but preserve project info
          const currentProject = state.project.currentPath;
          const availableProjects = state.project.availableProjects;
          
          // Reset connection
          state.connection = {
            isConnected: false,
            status: 'disconnected',
            lastError: null,
            reconnectAttempts: 0,
            lastActivity: null
          };
          
          // Reset sessions but keep structure
          Object.keys(state.sessions).forEach(provider => {
            state.sessions[provider] = {
              sessionId: null,
              active: false,
              messages: [],
              lastActivity: null,
              contextInfo: {
                num_turns: 0,
                duration_ms: 0,
                estimated_tokens: 0,
                max_context: provider === 'claude' ? 200000 : 400000
              }
            };
          });
          
          // Reset UI
          state.ui = {
            activeProvider: 'claude',
            isTyping: false,
            typingStatus: { mode: 'idle', label: '' },
            activityLock: false,
            currentInput: '',
            attachments: [],
            imageAttachments: [],
            showSlashMenu: false,
            slashFilter: '',
            selectedCommandIndex: 0
          };
          
          // Preserve project info
          state.project = {
            currentPath: currentProject,
            availableProjects: availableProjects,
            selectedSession: null
          };
          
          log.info('Chat store cleaned up');
        })
      })),
      {
        name: 'chat-store', // localStorage key
        partialize: (state) => ({
          // Only persist essential state, not transient UI state
          sessions: {
            claude: {
              sessionId: state.sessions.claude.sessionId,
              messages: state.sessions.claude.messages.slice(-50), // Keep last 50 messages
              contextInfo: state.sessions.claude.contextInfo
            },
            codex: {
              sessionId: state.sessions.codex.sessionId,
              messages: state.sessions.codex.messages.slice(-50), // Keep last 50 messages
              contextInfo: state.sessions.codex.contextInfo
            }
          },
          ui: {
            activeProvider: state.ui.activeProvider
          },
          project: {
            currentPath: state.project.currentPath
          }
        }),
        version: 1, // For future migrations
      }
    )
  )
);

// Subscription for debugging
if (process.env.NODE_ENV === 'development') {
  useChatStore.subscribe(
    (state) => state.connection.isConnected,
    (isConnected, prevIsConnected) => {
      if (isConnected !== prevIsConnected) {
        log.debug('Connection state changed:', { isConnected, prev: prevIsConnected });
      }
    }
  );

  useChatStore.subscribe(
    (state) => state.ui.activeProvider,
    (provider, prevProvider) => {
      if (provider !== prevProvider) {
        log.debug('Active provider changed:', { provider, prev: prevProvider });
      }
    }
  );
}

// Export selectors for better performance
export const chatSelectors = {
  connection: (state) => state.connection,
  currentSession: (state) => state.sessions[state.ui.activeProvider],
  currentMessages: (state) => state.sessions[state.ui.activeProvider]?.messages || [],
  ui: (state) => state.ui,
  project: (state) => state.project,
  isConnected: (state) => state.connection.isConnected,
  activeProvider: (state) => state.ui.activeProvider,
  currentInput: (state) => state.ui.currentInput,
  attachments: (state) => ({
    html: state.ui.attachments,
    images: state.ui.imageAttachments
  })
};
