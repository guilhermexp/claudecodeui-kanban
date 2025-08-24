/*
 * App.jsx - Main Application Component with Session Protection System
 * 
 * SESSION PROTECTION SYSTEM OVERVIEW:
 * ===================================
 * 
 * Problem: Automatic project updates from WebSocket would refresh the sidebar and clear chat messages
 * during active conversations, creating a poor user experience.
 * 
 * Solution: Track "active sessions" and pause project updates during conversations.
 * 
 * How it works:
 * 1. When user sends message → session marked as "active" 
 * 2. Project updates are skipped while session is active
 * 3. When conversation completes/aborts → session marked as "inactive"
 * 4. Project updates resume normally
 * 
 * Handles both existing sessions (with real IDs) and new sessions (with temporary IDs).
 */

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import MobileNav from './components/MobileNav';
import ToolsSettings from './components/ToolsSettings';
import VibeKanbanApp from './components/VibeKanbanApp';
import SessionKeepAlive from './components/SessionKeepAlive';
import { FloatingMicMenu } from './components/FloatingMicMenu';

import { useWebSocket } from './utils/websocket';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { api } from './utils/api';
import { authPersistence } from './utils/auth-persistence';
import { appStatePersistence } from './utils/app-state-persistence';

// Main App component with routing
function AppContent() {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  
  // Load persisted state on mount
  const loadPersistedState = () => {
    const savedState = appStatePersistence.loadState();
    // Check if we have recent chat state (within 30 minutes)
    const chatState = savedState[appStatePersistence.KEYS.CHAT_MESSAGES];
    const shouldRestoreSession = chatState && 
      chatState.timestamp && 
      (Date.now() - chatState.timestamp < 30 * 60 * 1000); // 30 minutes
    
    // Smart sidebar initial state based on screen size
    const isMobileScreen = window.innerWidth < 768;
    let sidebarOpenDefault = !isMobileScreen; // Open on desktop, closed on mobile
    
    // If we have a saved state, use it only for desktop
    // Mobile should always start closed to avoid overlay issues
    if (savedState[appStatePersistence.KEYS.SIDEBAR_OPEN] !== undefined) {
      sidebarOpenDefault = isMobileScreen ? false : savedState[appStatePersistence.KEYS.SIDEBAR_OPEN];
    }
    
    return {
      selectedProject: shouldRestoreSession ? savedState[appStatePersistence.KEYS.SELECTED_PROJECT] : null,
      selectedSession: shouldRestoreSession ? savedState[appStatePersistence.KEYS.SELECTED_SESSION] : null,
      activeTab: savedState[appStatePersistence.KEYS.ACTIVE_TAB] === 'shell' || 
                  savedState[appStatePersistence.KEYS.ACTIVE_TAB] === 'files' || 
                  savedState[appStatePersistence.KEYS.ACTIVE_TAB] === 'git'
        ? savedState[appStatePersistence.KEYS.ACTIVE_TAB]
        : 'shell',
      sidebarOpen: sidebarOpenDefault,
    };
  };

  const persistedState = loadPersistedState();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(persistedState.selectedProject);
  const [selectedSession, setSelectedSession] = useState(persistedState.selectedSession);
  const [activeTab, setActiveTab] = useState(persistedState.activeTab); // 'shell', 'files', 'git'
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(persistedState.sidebarOpen);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isShellConnected, setIsShellConnected] = useState(false);
  const [showToolsSettings, setShowToolsSettings] = useState(false);
  // Track active side panels to determine sidebar behavior (integrated vs overlay)
  const [activeSidePanel, setActiveSidePanel] = useState(null);
  // Shell session protection - tracks when Claude is actively working
  const [shellHasActiveSession, setShellHasActiveSession] = useState(false);
  // Session Protection System: Track sessions with active conversations to prevent
  // automatic project updates from interrupting ongoing chats. When a user sends
  // a message, the session is marked as "active" and project updates are paused
  // until the conversation completes or is aborted.
  const [activeSessions, setActiveSessions] = useState(new Set()); // Track sessions with active conversations
  
  // Sidebar resizing states
  const [isResizing, setIsResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    // Load saved width from localStorage or use default
    const saved = localStorage.getItem('sidebar-width');
    return saved ? parseInt(saved, 10) : 280;
  });
  
  // Get auth context to know when auth is ready
  const { isLoading: authLoading, user } = useAuth();
  const authReady = !authLoading && !!user;
  
  const { ws, sendMessage, messages, reconnect } = useWebSocket(authReady);

  // Determine if sidebar should use overlay mode (when side panels are active)
  const shouldUseSidebarOverlay = !isMobile && activeSidePanel !== null;

  // Monitor authentication changes and reconnect WebSocket
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'auth-token') {
        if (e.newValue) {
          // Token was added, reconnect WebSocket
          reconnect();
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [reconnect]);

  // Persist state changes
  useEffect(() => {
    // Only save sidebar state for desktop to avoid mobile overlay issues
    const stateToSave = {
      [appStatePersistence.KEYS.SELECTED_PROJECT]: selectedProject,
      [appStatePersistence.KEYS.SELECTED_SESSION]: selectedSession,
      [appStatePersistence.KEYS.ACTIVE_TAB]: activeTab,
      [appStatePersistence.KEYS.SIDEBAR_OPEN]: !isMobile ? sidebarOpen : true, // Always save 'true' for desktop default
    };
    appStatePersistence.saveState(stateToSave);
  }, [selectedProject, selectedSession, activeTab, sidebarOpen, isMobile]);
  
  // Handle sidebar resizing
  useEffect(() => {
    if (!isResizing) return;
    
    const handleMouseMove = (e) => {
      const newWidth = e.clientX;
      // Set min and max width limits
      const minWidth = 200; // Minimum 200px
      const maxWidth = 500; // Maximum 500px
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setSidebarWidth(newWidth);
      }
    };
    
    const handleMouseUp = () => {
      setIsResizing(false);
      // Save to localStorage when resize ends
      localStorage.setItem('sidebar-width', sidebarWidth.toString());
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, sidebarWidth]);

  // Save navigation context when navigating away
  useEffect(() => {
    const handleBeforeUnload = () => {
      appStatePersistence.saveNavigationContext({
        project: selectedProject,
        session: selectedSession,
        tab: activeTab,
        route: window.location.pathname,
      });
    };

    // Save context when clicking on links that navigate away
    const handleClick = (e) => {
      const link = e.target.closest('a');
      if (link && link.href && !link.href.includes(window.location.origin + '/chat')) {
        appStatePersistence.saveNavigationContext({
          project: selectedProject,
          session: selectedSession,
          tab: activeTab,
          route: window.location.pathname,
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick);
    };
  }, [selectedProject, selectedSession, activeTab]);

  useEffect(() => {
    let previousWidth = window.innerWidth;
    let resizeTimeout = null;
    
    const handleResize = () => {
      // Clear existing timeout
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      
      // Debounce resize handling
      resizeTimeout = setTimeout(() => {
        const currentWidth = window.innerWidth;
        const wasMobile = previousWidth < 768;
        const nowMobile = currentWidth < 768;
        
        setIsMobile(nowMobile);
        
        // Smart sidebar management on screen size change
        if (wasMobile !== nowMobile) {
          if (nowMobile) {
            // Switching to mobile: close sidebar to avoid overlay
            setSidebarOpen(false);
          } else {
            // Switching to desktop: open sidebar for better UX
            setSidebarOpen(true);
          }
        }
        
        previousWidth = currentWidth;
      }, 150); // 150ms debounce
    };
    
    // Initial check
    const initialCheck = () => {
      const nowMobile = window.innerWidth < 768;
      setIsMobile(nowMobile);
      previousWidth = window.innerWidth;
    };
    
    initialCheck();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
    };
  }, []);

  useEffect(() => {
    // Clear any invalid persisted state on mount to ensure clean start
    appStatePersistence.clearState();
    
    // Also clear any saved chat messages that might be causing resume issues
    const chatMessagesKeys = Object.keys(localStorage).filter(key => 
      key.startsWith('chat_messages_') || key.includes('session')
    );
    chatMessagesKeys.forEach(key => localStorage.removeItem(key));
    
    // Fetch projects on component mount
    fetchProjects();
  }, []);

  // Helper function to determine if an update is purely additive (new sessions/projects)
  // vs modifying existing selected items that would interfere with active conversations
  const isUpdateAdditive = (currentProjects, updatedProjects, selectedProject, selectedSession) => {
    if (!selectedProject || !selectedSession) {
      // No active session to protect, allow all updates
      return true;
    }

    // Find the selected project in both current and updated data
    const currentSelectedProject = currentProjects?.find(p => p.name === selectedProject.name);
    const updatedSelectedProject = updatedProjects?.find(p => p.name === selectedProject.name);

    if (!currentSelectedProject || !updatedSelectedProject) {
      // Project structure changed significantly, not purely additive
      return false;
    }

    // Find the selected session in both current and updated project data
    const currentSelectedSession = currentSelectedProject.sessions?.find(s => s.id === selectedSession.id);
    const updatedSelectedSession = updatedSelectedProject.sessions?.find(s => s.id === selectedSession.id);

    if (!currentSelectedSession || !updatedSelectedSession) {
      // Selected session was deleted or significantly changed, not purely additive
      return false;
    }

    // Check if the selected session's content has changed (modification vs addition)
    // Compare key fields that would affect the loaded chat interface
    const sessionUnchanged = 
      currentSelectedSession.id === updatedSelectedSession.id &&
      currentSelectedSession.title === updatedSelectedSession.title &&
      currentSelectedSession.created_at === updatedSelectedSession.created_at &&
      currentSelectedSession.updated_at === updatedSelectedSession.updated_at;

    // This is considered additive if the selected session is unchanged
    // (new sessions may have been added elsewhere, but active session is protected)
    return sessionUnchanged;
  };

  // Handle WebSocket messages for real-time project updates
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      
      // Handle session not found error (when resuming external Claude CLI sessions)
      if (latestMessage.type === 'session-not-found') {
        // Session not found in Claude CLI, will create new session
        
        // Show a user-friendly notification
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 bg-yellow-500 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-pulse';
        notification.textContent = 'Session not found. Starting a new session...';
        document.body.appendChild(notification);
        
        setTimeout(() => {
          notification.remove();
        }, 3000);
        
        // The backend will automatically create a new session
        // No need to do anything else here
        return;
      }
      
      if (latestMessage.type === 'projects_updated') {
        
        // Session Protection Logic: Allow additions but prevent changes during active conversations
        // This allows new sessions/projects to appear in sidebar while protecting active chat messages
        // We check for two types of active sessions:
        // 1. Existing sessions: selectedSession.id exists in activeSessions
        // 2. New sessions: temporary "new-session-*" identifiers in activeSessions (before real session ID is received)
        const hasActiveSession = (selectedSession && activeSessions.has(selectedSession.id)) ||
                                 (activeSessions.size > 0 && Array.from(activeSessions).some(id => id.startsWith('new-session-')));
        
        if (hasActiveSession) {
          // Allow updates but be selective: permit additions, prevent changes to existing items
          const updatedProjects = latestMessage.projects;
          const currentProjects = projects;
          
          // Check if this is purely additive (new sessions/projects) vs modification of existing ones
          const isAdditiveUpdate = isUpdateAdditive(currentProjects, updatedProjects, selectedProject, selectedSession);
          
          if (!isAdditiveUpdate) {
            // Skip updates that would modify existing selected session/project
            return;
          }
          // Continue with additive updates below
        }
        
        // Update projects state with the new data from WebSocket
        const updatedProjects = latestMessage.projects;
        setProjects(updatedProjects);
        
        // Update selected project if it exists in the updated projects
        if (selectedProject) {
          const updatedSelectedProject = updatedProjects.find(p => p.name === selectedProject.name);
          if (updatedSelectedProject) {
            setSelectedProject(updatedSelectedProject);
            
            // Update selected session only if it was deleted - avoid unnecessary reloads
            if (selectedSession) {
              const updatedSelectedSession = updatedSelectedProject.sessions?.find(s => s.id === selectedSession.id);
              if (!updatedSelectedSession) {
                // Session was deleted
                setSelectedSession(null);
              }
              // Don't update if session still exists with same ID - prevents reload
            }
          }
        }
      }
    }
  }, [messages, selectedProject, selectedSession, activeSessions]);

  const fetchProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const response = await api.projects();
      const data = await response.json();
      
      // Optimize to preserve object references when data hasn't changed
      setProjects(prevProjects => {
        // If no previous projects, just set the new data
        if (prevProjects.length === 0) {
          return data;
        }
        
        // Check if the projects data has actually changed
        const hasChanges = data.some((newProject, index) => {
          const prevProject = prevProjects[index];
          if (!prevProject) return true;
          
          // Compare key properties that would affect UI
          return (
            newProject.name !== prevProject.name ||
            newProject.displayName !== prevProject.displayName ||
            newProject.fullPath !== prevProject.fullPath ||
            JSON.stringify(newProject.sessionMeta) !== JSON.stringify(prevProject.sessionMeta) ||
            JSON.stringify(newProject.sessions) !== JSON.stringify(prevProject.sessions)
          );
        }) || data.length !== prevProjects.length;
        
        // Only update if there are actual changes
        return hasChanges ? data : prevProjects;
      });
      
      // Don't auto-select any project - user should choose manually
    } catch (error) {
      // Error: 'Error fetching projects:', error
    } finally {
      setIsLoadingProjects(false);
    }
  };

  // Expose fetchProjects globally for component access
  window.refreshProjects = fetchProjects;

  // Handle URL-based session loading
  useEffect(() => {
    if (sessionId && projects.length > 0) {
      // Only switch tabs on initial load, not on every project update
      const shouldSwitchTab = !selectedSession || selectedSession.id !== sessionId;
      // Find the session across all projects
      for (const project of projects) {
        const session = project.sessions?.find(s => s.id === sessionId);
        if (session) {
          setSelectedProject(project);
          setSelectedSession(session);
          // Keep current tab when loading sessions
          return;
        }
      }
      
      // If session not found, it might be a newly created session
      // Just navigate to it and it will be found when the sidebar refreshes
      // Don't redirect to home, let the session load naturally
    }
  }, [sessionId, projects, navigate]);

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    navigate('/');
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleSessionSelect = (session) => {
    setSelectedSession(session);
    // Only switch to chat tab when user explicitly selects a session
    // Keep current tab when navigating to sessions
    if (isMobile) {
      setSidebarOpen(false);
    }
    navigate(`/session/${session.id}`);
  };

  const handleNewSession = (project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    setActiveTab('shell'); // Switch to shell tab for new session
    navigate('/');
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  const handleSessionDelete = (sessionId) => {
    // If the deleted session was currently selected, clear it
    if (selectedSession?.id === sessionId) {
      setSelectedSession(null);
      navigate('/');
    }
    
    // Update projects state locally instead of full refresh
    setProjects(prevProjects => 
      prevProjects.map(project => ({
        ...project,
        sessions: project.sessions?.filter(session => session.id !== sessionId) || [],
        sessionMeta: {
          ...project.sessionMeta,
          total: Math.max(0, (project.sessionMeta?.total || 0) - 1)
        }
      }))
    );
  };

  const handleSidebarRefresh = async () => {
    // Refresh only the sessions for all projects, don't change selected state
    try {
      const response = await api.projects();
      const freshProjects = await response.json();
      
      // Optimize to preserve object references and minimize re-renders
      setProjects(prevProjects => {
        // Check if projects data has actually changed
        const hasChanges = freshProjects.some((newProject, index) => {
          const prevProject = prevProjects[index];
          if (!prevProject) return true;
          
          return (
            newProject.name !== prevProject.name ||
            newProject.displayName !== prevProject.displayName ||
            newProject.fullPath !== prevProject.fullPath ||
            JSON.stringify(newProject.sessionMeta) !== JSON.stringify(prevProject.sessionMeta) ||
            JSON.stringify(newProject.sessions) !== JSON.stringify(prevProject.sessions)
          );
        }) || freshProjects.length !== prevProjects.length;
        
        return hasChanges ? freshProjects : prevProjects;
      });
      
      // If we have a selected project, make sure it's still selected after refresh
      if (selectedProject) {
        const refreshedProject = freshProjects.find(p => p.name === selectedProject.name);
        if (refreshedProject) {
          // Only update selected project if it actually changed
          if (JSON.stringify(refreshedProject) !== JSON.stringify(selectedProject)) {
            setSelectedProject(refreshedProject);
          }
          
          // If we have a selected session, try to find it in the refreshed project
          if (selectedSession) {
            const refreshedSession = refreshedProject.sessions?.find(s => s.id === selectedSession.id);
            if (refreshedSession && JSON.stringify(refreshedSession) !== JSON.stringify(selectedSession)) {
              setSelectedSession(refreshedSession);
            }
          }
        }
      }
    } catch (error) {
      // Error: 'Error refreshing sidebar:', error
    }
  };

  const handleProjectDelete = (projectName) => {
    // If the deleted project was currently selected, clear it
    if (selectedProject?.name === projectName) {
      setSelectedProject(null);
      setSelectedSession(null);
      navigate('/');
    }
    
    // Update projects state locally instead of full refresh
    setProjects(prevProjects => 
      prevProjects.filter(project => project.name !== projectName)
    );
  };

  // Session Protection Functions: Manage the lifecycle of active sessions
  
  // markSessionAsActive: Called when user sends a message to mark session as protected
  // This includes both real session IDs and temporary "new-session-*" identifiers
  const markSessionAsActive = (sessionId) => {
    if (sessionId) {
      setActiveSessions(prev => new Set([...prev, sessionId]));
    }
  };

  // markSessionAsInactive: Called when conversation completes/aborts to re-enable project updates
  const markSessionAsInactive = (sessionId) => {
    if (sessionId) {
      setActiveSessions(prev => {
        const newSet = new Set(prev);
        newSet.delete(sessionId);
        return newSet;
      });
    }
  };

  // replaceTemporarySession: Called when WebSocket provides real session ID for new sessions
  // Removes temporary "new-session-*" identifiers and adds the real session ID
  // This maintains protection continuity during the transition from temporary to real session
  const replaceTemporarySession = (realSessionId) => {
    if (realSessionId) {
      setActiveSessions(prev => {
        const newSet = new Set();
        // Keep all non-temporary sessions and add the real session ID
        for (const sessionId of prev) {
          if (!sessionId.startsWith('new-session-')) {
            newSet.add(sessionId);
          }
        }
        newSet.add(realSessionId);
        return newSet;
      });
    }
  };

  // Version Upgrade Modal removed along with version checking

  return (
    <div 
      className="fixed inset-x-0 top-0 bottom-0 flex bg-background" 
      style={{ 
        height: '100%',
        cursor: isResizing ? 'col-resize' : 'default'
      }}
    >
      {/* Desktop Sidebar - Integrated Mode (no side panels active) */}
      {!isMobile && (sidebarOpen || showToolsSettings) && !shouldUseSidebarOverlay && (
        <div 
          className="flex-shrink-0 border-r border-border bg-card relative"
          style={{ width: `${sidebarWidth}px` }}
        >
          <div className="h-full overflow-y-auto">
            <Sidebar
              projects={projects}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              onProjectSelect={handleProjectSelect}
              onSessionSelect={handleSessionSelect}
              onNewSession={handleNewSession}
              onSessionDelete={handleSessionDelete}
              onProjectDelete={handleProjectDelete}
              isLoading={isLoadingProjects}
              onRefresh={handleSidebarRefresh}
              onShowSettings={() => setShowToolsSettings(true)}
              onSidebarClose={() => setSidebarOpen(false)}
            />
          </div>
          
          {/* Resize Handle */}
          <div
            className="absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-primary/20 active:bg-primary/30 transition-colors group"
            onMouseDown={(e) => {
              e.preventDefault();
              setIsResizing(true);
            }}
          >
            <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/10" />
          </div>
        </div>
      )}

      {/* Desktop Sidebar - Overlay Mode (when side panels are active) */}
      {!isMobile && (sidebarOpen || showToolsSettings) && shouldUseSidebarOverlay && (
        <div className="fixed inset-0 z-[60] flex">
          <div 
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div 
            className="relative bg-card border-r border-border h-full shadow-xl"
            style={{ width: `${sidebarWidth}px` }}
          >
            <div className="h-full overflow-y-auto">
              <Sidebar
                projects={projects}
                selectedProject={selectedProject}
                selectedSession={selectedSession}
                onProjectSelect={handleProjectSelect}
                onSessionSelect={handleSessionSelect}
                onNewSession={handleNewSession}
                onSessionDelete={handleSessionDelete}
                onProjectDelete={handleProjectDelete}
                isLoading={isLoadingProjects}
                onRefresh={handleSidebarRefresh}
                onShowSettings={() => setShowToolsSettings(true)}
                onSidebarClose={() => setSidebarOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobile && (
        <div className={`fixed inset-0 z-[60] flex transition-all duration-150 ease-out ${
          sidebarOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
        }`}>
          <div 
            className="fixed inset-0 bg-background transition-opacity duration-150 ease-out"
            onClick={(e) => {
              e.stopPropagation();
              setSidebarOpen(false);
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setSidebarOpen(false);
            }}
          />
          <div 
            className={`relative w-[85vw] max-w-sm sm:w-80 bg-card border-r border-border h-full transform transition-transform duration-150 ease-out ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <Sidebar
              projects={projects}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              onProjectSelect={handleProjectSelect}
              onSessionSelect={handleSessionSelect}
              onNewSession={handleNewSession}
              onSessionDelete={handleSessionDelete}
              onProjectDelete={handleProjectDelete}
              isLoading={isLoadingProjects}
              onRefresh={handleSidebarRefresh}
              onShowSettings={() => setShowToolsSettings(true)}
              onSidebarClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Content Area - Flexible */}
      <div className={`flex-1 flex flex-col min-w-0 relative ${isMobile ? 'pb-14' : ''}`}>
        <MainContent
          selectedProject={selectedProject}
          selectedSession={selectedSession}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          ws={ws}
          sendMessage={sendMessage}
          messages={messages}
          isMobile={isMobile}
          onMenuClick={() => setSidebarOpen(true)}
          onSidebarOpen={() => setSidebarOpen(!sidebarOpen)}
          sidebarOpen={sidebarOpen}
          onActiveSidePanelChange={setActiveSidePanel}
          isLoading={isLoadingProjects}
          onInputFocusChange={setIsInputFocused}
          onSessionActive={markSessionAsActive}
          onSessionInactive={markSessionAsInactive}
          onReplaceTemporarySession={replaceTemporarySession}
          onNavigateToSession={(sessionId) => navigate(`/session/${sessionId}`)}
          onShowSettings={() => setShowToolsSettings(true)}
          onShellConnectionChange={setIsShellConnected}
          shellHasActiveSession={shellHasActiveSession}
          onShellSessionStateChange={setShellHasActiveSession}
        />
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <MobileNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isInputFocused={isInputFocused}
          isShellConnected={isShellConnected}
          shellHasActiveSession={shellHasActiveSession}
        />
      )}
      
      {/* Floating Mic Menu for Mobile Shell */}
      {isMobile && activeTab === 'shell' && !isInputFocused && (
        <div className="fixed bottom-20 right-4 z-50">
          <FloatingMicMenu 
            onTranscript={(text) => {
              // Send the transcribed text to the terminal via the global handler
              if (window.sendToActiveTerminal && typeof window.sendToActiveTerminal === 'function') {
                // Add a small delay to ensure the terminal is ready to receive input
                // This helps prevent the issue where text creates new input lines on mobile
                setTimeout(() => {
                  window.sendToActiveTerminal(text);
                }, 100);
              }
            }}
          />
        </div>
      )}

      {/* Tools Settings Modal */}
      <ToolsSettings
        isOpen={showToolsSettings}
        onClose={() => setShowToolsSettings(false)}
      />
      

      {/* Session Keep Alive Component */}
      <SessionKeepAlive />
    </div>
  );
}

// Root App component with router
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ProtectedRoute>
          <Router future={{ 
            v7_startTransition: true,
            v7_relativeSplatPath: true
          }}>
            <Routes>
              <Route path="/" element={<AppContent />} />
              <Route path="/session/:sessionId" element={<AppContent />} />
              <Route path="/vibe-kanban/*" element={<VibeKanbanApp />} />
            </Routes>
          </Router>
        </ProtectedRoute>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;