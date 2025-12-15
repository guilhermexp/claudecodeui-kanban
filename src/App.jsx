// App.jsx - Main Application Component with Session Protection System

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate, useParams } from 'react-router-dom';

// Lazy load heavy components for code splitting
const MainContent = lazy(() => import('./components/MainContent'));
const MobileNav = lazy(() => import('./components/MobileNav'));
const ToolsSettings = lazy(() => import('./components/ToolsSettings'));
const SessionKeepAlive = lazy(() => import('./components/SessionKeepAlive'));
const FloatingMicMenu = lazy(() => import('./components/FloatingMicMenu').then(module => ({ default: module.FloatingMicMenu })));
const SessionsView = lazy(() => import('./components/SessionsView'));

import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingFallback from './components/LoadingFallback';
import { api } from './utils/api';
import { authPersistence } from './utils/auth-persistence';
import { appStatePersistence } from './utils/app-state-persistence';
import { useCleanup, useLifecycleTracker } from './hooks/useCleanup';
import { createLogger } from './utils/logger';

const log = createLogger('App');

// Main App component with routing
function AppContent() {
  const navigate = useNavigate();
  const { sessionId, projectName } = useParams();
  
  // Load persisted state on mount
  const loadPersistedState = () => {
    const savedState = appStatePersistence.loadState();
    return {
      selectedProject: savedState[appStatePersistence.KEYS.SELECTED_PROJECT] || null,
      selectedSession: savedState[appStatePersistence.KEYS.SELECTED_SESSION] || null,
      activeTab: savedState[appStatePersistence.KEYS.ACTIVE_TAB] === 'shell' || 
                  savedState[appStatePersistence.KEYS.ACTIVE_TAB] === 'files' || 
                  savedState[appStatePersistence.KEYS.ACTIVE_TAB] === 'git'
        ? savedState[appStatePersistence.KEYS.ACTIVE_TAB]
        : 'shell'
    };
  };

  const persistedState = loadPersistedState();

  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(persistedState.selectedProject);
  const [selectedSession, setSelectedSession] = useState(persistedState.selectedSession);
  const [activeTab, setActiveTab] = useState(persistedState.activeTab);
  const [isMobile, setIsMobile] = useState(false);
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [isShellConnected, setIsShellConnected] = useState(false);
  const [showToolsSettings, setShowToolsSettings] = useState(false);
  const [shellHasActiveSession, setShellHasActiveSession] = useState(false);
  const [activeSessions, setActiveSessions] = useState(new Set());
  
  // Cleanup utilities
  const { onWindow, onDocument, setManagedTimeout } = useCleanup();
  
  // Lifecycle tracking for debugging
  useLifecycleTracker('App');

  const { isLoading: authLoading, user } = useAuth();
  const authReady = !authLoading && !!user;
  

  // Enable compact UI globally (minimal spacing/buttons)
  useEffect(() => {
    try {
      document.body.classList.add('compact-ui');
    } catch (error) {
      log.warn('Failed to add compact-ui class:', error);
    }
    return () => {
      try {
        document.body.classList.remove('compact-ui');
      } catch (error) {
        log.warn('Failed to remove compact-ui class:', error);
      }
    };
  }, []);

  // Persist state changes
  useEffect(() => {
    // Only save sidebar state for desktop to avoid mobile overlay issues
    const stateToSave = {
      [appStatePersistence.KEYS.SELECTED_PROJECT]: selectedProject,
      [appStatePersistence.KEYS.SELECTED_SESSION]: selectedSession,
      [appStatePersistence.KEYS.ACTIVE_TAB]: activeTab,
      // Sidebar open state removed
    };
    appStatePersistence.saveState(stateToSave);
  }, [selectedProject, selectedSession, activeTab, isMobile]);
  
  // Sidebar resizing removed - no longer needed

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

    const beforeUnloadListener = onWindow('beforeunload', handleBeforeUnload, false, 'app navigation context save');
    const documentClickListener = onDocument('click', handleClick, false, 'app link click save');

    return () => {
      try {
        beforeUnloadListener?.remove?.();
      } catch (error) {
        log.warn('Failed to remove beforeunload listener:', error);
      }
      try {
        documentClickListener?.remove?.();
      } catch (error) {
        log.warn('Failed to remove document click listener:', error);
      }
    };
  }, [selectedProject, selectedSession, activeTab, onWindow, onDocument]);

  useEffect(() => {
    let previousWidth = window.innerWidth;
    
    const handleResize = () => {
      // Debounce resize handling
      const { clear } = setManagedTimeout(() => {
        const currentWidth = window.innerWidth;
        const wasMobile = previousWidth < 768;
        const nowMobile = currentWidth < 768;
        
        setIsMobile(nowMobile);
        
        // Keep sidebar closed on screen size changes
        if (wasMobile !== nowMobile) {
          // Sidebar close removed
        }
        
        previousWidth = currentWidth;
      }, 150, 'resize debounce'); // 150ms debounce
    };
    
    // Initial check
    const initialCheck = () => {
      const nowMobile = window.innerWidth < 768;
      setIsMobile(nowMobile);
      previousWidth = window.innerWidth;
    };
    
    initialCheck();
    const resizeListener = onWindow('resize', handleResize, false, 'app resize detector');

    return () => {
      try {
        resizeListener?.remove?.();
      } catch (error) {
        log.warn('Failed to remove resize listener:', error);
      }
    };
  }, [onWindow, setManagedTimeout]);

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


  const fetchProjects = async () => {
    try {
      setIsLoadingProjects(true);
      const response = await api.projects();

      if (!response.ok) {
        setProjects([]);
        return;
      }

      let data;
      try {
        data = await response.json();
      } catch {
        data = [];
      }

      let normalized = Array.isArray(data)
        ? data
        : Array.isArray(data?.projects)
          ? data.projects
          : [];

      // Optimize to preserve object references when data hasn't changed
      setProjects(prevProjects => {
        const previous = Array.isArray(prevProjects) ? prevProjects : [];

        if (previous.length === 0) {
          return normalized;
        }

        // Shallow comparison - more efficient than JSON.stringify
        const hasChanges = normalized.length !== previous.length || normalized.some((newProject, index) => {
          const prevProject = previous[index];
          if (!prevProject) return true;

          // Basic field comparison
          if (
            newProject.name !== prevProject.name ||
            newProject.displayName !== prevProject.displayName ||
            newProject.fullPath !== prevProject.fullPath
          ) return true;

          // Compare session meta
          const prevMeta = prevProject.sessionMeta || {};
          const newMeta = newProject.sessionMeta || {};
          if (prevMeta.total !== newMeta.total) return true;

          // Compare sessions length (more efficient than deep comparison)
          const prevSessions = prevProject.sessions || [];
          const newSessions = newProject.sessions || [];
          if (prevSessions.length !== newSessions.length) return true;

          // Check if session IDs changed (lightweight comparison)
          return newSessions.some((s, i) => s.id !== prevSessions[i]?.id);
        });

        return hasChanges ? normalized : previous;
      });

      // Don't auto-select any project - user should choose manually
    } catch (error) {
      setProjects([]);
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
    // Always close sidebar when project is selected
    // Sidebar close removed
  };

  const handleSessionSelect = (session) => {
    setSelectedSession(session);
    // Only switch to chat tab when user explicitly selects a session
    // Keep current tab when navigating to sessions
    // Always close sidebar when session is selected
    // Sidebar close removed
    if (session && session.id) {
      navigate(`/session/${session.id}`);
    } else {
      navigate('/');
    }
  };

  const handleNewSession = (project) => {
    setSelectedProject(project);
    setSelectedSession(null);
    setActiveTab('shell'); // Switch to shell tab for new session
    navigate('/');
    // Always close sidebar when creating new session
    // Sidebar close removed
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

  const handleProjectDelete = async (projectName) => {
    try {
      // First try to delete as empty project
      let response = await api.deleteProject(projectName);

      // If it fails because project has sessions, ask user to confirm complete deletion
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.error && errorData.error.includes('sessions')) {
          if (confirm('This project has sessions. Do you want to delete it completely including all sessions?')) {
            // Force delete with all sessions
            response = await api.deleteProjectCompletely(projectName);
            if (!response.ok) {
              throw new Error('Failed to delete project completely');
            }
          } else {
            return; // User cancelled
          }
        } else {
          throw new Error(errorData.error || 'Failed to delete project');
        }
      }

      // If the deleted project was currently selected, clear it
      if (selectedProject?.name === projectName) {
        setSelectedProject(null);
        setSelectedSession(null);
        navigate('/');
      }

      // Update projects state locally
      setProjects(prevProjects =>
        prevProjects.filter(project => project.name !== projectName)
      );
    } catch (error) {
      log.error('Failed to delete project:', error);
      alert(`Failed to delete project: ${error.message}`);
    }
  };

  const handleSidebarRefresh = async () => {
    // Refresh only the sessions for all projects, don't change selected state
    try {
      const response = await api.projects();
      const freshProjects = await response.json();
      
      // Optimize to preserve object references and minimize re-renders
      setProjects(prevProjects => {
        // Efficient shallow comparison instead of JSON.stringify
        const hasChanges = freshProjects.length !== prevProjects.length || freshProjects.some((newProject, index) => {
          const prevProject = prevProjects[index];
          if (!prevProject) return true;

          // Basic fields
          if (
            newProject.name !== prevProject.name ||
            newProject.displayName !== prevProject.displayName ||
            newProject.fullPath !== prevProject.fullPath
          ) return true;

          // Session meta comparison
          const prevMeta = prevProject.sessionMeta || {};
          const newMeta = newProject.sessionMeta || {};
          if (prevMeta.total !== newMeta.total) return true;

          // Sessions comparison (lightweight)
          const prevSessions = prevProject.sessions || [];
          const newSessions = newProject.sessions || [];
          if (prevSessions.length !== newSessions.length) return true;

          return newSessions.some((s, i) => s.id !== prevSessions[i]?.id || s.updated_at !== prevSessions[i]?.updated_at);
        });

        return hasChanges ? freshProjects : prevProjects;
      });

      // If we have a selected project, make sure it's still selected after refresh
      if (selectedProject) {
        const refreshedProject = freshProjects.find(p => p.name === selectedProject.name);
        if (refreshedProject) {
          // Only update selected project if it actually changed (shallow comparison)
          const projectChanged = (
            refreshedProject.displayName !== selectedProject.displayName ||
            refreshedProject.fullPath !== selectedProject.fullPath ||
            (refreshedProject.sessions?.length || 0) !== (selectedProject.sessions?.length || 0)
          );

          if (projectChanged) {
            setSelectedProject(refreshedProject);
          }

          // If we have a selected session, try to find it in the refreshed project
          if (selectedSession) {
            const refreshedSession = refreshedProject.sessions?.find(s => s.id === selectedSession.id);
            if (refreshedSession && refreshedSession.updated_at !== selectedSession.updated_at) {
              setSelectedSession(refreshedSession);
            }
          }
        }
      }
    } catch (error) {
      log.error('Error refreshing sidebar:', error);
    }
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

  // handleStartStandaloneSession: Start fresh standalone session
  const handleStartStandaloneSession = () => {
    // Create a standalone project - no sessions, always fresh
    const standaloneProject = {
      name: 'standalone',
      displayName: 'Standalone',
      path: 'STANDALONE_MODE',
      fullPath: 'STANDALONE_MODE',
      isStandalone: true,
      sessions: [] // Always empty - never resume
    };
    
    setSelectedProject(standaloneProject);
    setSelectedSession(null); // Never select a session - always fresh
    setActiveTab('shell');
    navigate('/');
  };

  // Version Upgrade Modal removed along with version checking

  return (
    <div 
      className="fixed inset-x-0 top-0 bottom-0 flex bg-background" 
      style={{ 
        height: '100%'
      }}
    >
      {/* Desktop Sidebar removed - using ProjectsModal instead */}

      {/* Desktop Sidebar Overlay removed - using ProjectsModal instead */}

      {/* Mobile Sidebar removed - using ProjectsModal instead */}

      {/* Main Content Area - Now takes full width */}
      <div className={`flex-1 flex flex-col min-w-0 relative ${isMobile ? 'pb-14' : ''} bg-card overflow-hidden`}>
        <Suspense fallback={<LoadingFallback message="Loading content..." />}>
          {projectName ? (
            // Sessions view for specific project
            <SessionsView
            onSessionSelect={handleSessionSelect}
            onNewSession={handleNewSession}
            onSessionDelete={handleSessionDelete}
          />
        ) : (
          // Main content view
        <MainContent
          selectedProject={selectedProject}
          selectedSession={selectedSession}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isMobile={isMobile}
          isLoading={isLoadingProjects}
          onInputFocusChange={setIsInputFocused}
          // New props for ProjectsModal
          projects={projects}
          onProjectSelect={handleProjectSelect}
          onSessionSelect={handleSessionSelect}
          onNewSession={handleNewSession}
          onSessionDelete={handleSessionDelete}
          onProjectDelete={handleProjectDelete}
          onRefresh={handleSidebarRefresh}
          // Session protection props
          onSessionActive={markSessionAsActive}
          onSessionInactive={markSessionAsInactive}
          onReplaceTemporarySession={replaceTemporarySession}
          onNavigateToSession={(sessionId) => navigate(`/session/${sessionId}`)}
          onShowSettings={() => setShowToolsSettings(true)}
          onStartStandaloneSession={handleStartStandaloneSession}
          onShellConnectionChange={setIsShellConnected}
          shellHasActiveSession={shellHasActiveSession}
          onShellSessionStateChange={setShellHasActiveSession}
        />
          )}
        </Suspense>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Suspense fallback={null}>
          <MobileNav
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isInputFocused={isInputFocused}
          isShellConnected={isShellConnected}
          shellHasActiveSession={shellHasActiveSession}
        />
        </Suspense>
      )}

      {/* Floating Mic Menu for Mobile Shell */}
      {isMobile && activeTab === 'shell' && !isInputFocused && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}

      {/* Tools Settings Modal */}
      <Suspense fallback={null}>
        <ToolsSettings
        isOpen={showToolsSettings}
        onClose={() => setShowToolsSettings(false)}
      />
      </Suspense>

      {/* Session Keep Alive Component */}
      <Suspense fallback={null}>
        <SessionKeepAlive />
      </Suspense>
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
              <Route path="/project/:projectName/sessions" element={<AppContent />} />
              { /* Vibe Kanban pages removed */ }
            </Routes>
          </Router>
        </ProtectedRoute>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
