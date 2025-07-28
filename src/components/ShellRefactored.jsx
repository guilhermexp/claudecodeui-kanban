import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import { ClipboardAddon } from '@xterm/addon-clipboard';
import 'xterm/css/xterm.css';
import { useShellSessions } from '../hooks/useShellSessions';
import ShellTerminal from './ShellTerminal';
import ShellHeader from './ShellHeader';
import ShellTabs from './ShellTabs';

/**
 * Refactored Shell Component
 * Uses centralized session management for better state handling
 */
function ShellRefactored({ 
  selectedProject, 
  selectedSession, 
  isActive, 
  onSessionCountChange, 
  onTerminalsChange, 
  onActiveTerminalChange, 
  onConnectionChange 
}) {
  const {
    sessions,
    activeSessionKey,
    createSession,
    updateSession,
    removeSession,
    setActiveSession,
    getSession,
    getConnectedSessions
  } = useShellSessions();

  const [isInitializing, setIsInitializing] = useState(false);
  const terminalRefs = useRef(new Map());

  // Create or switch to appropriate session when project/session changes
  useEffect(() => {
    if (!selectedProject) return;

    // Determine the session key
    let sessionKey;
    
    if (selectedSession?.id) {
      // Existing session
      sessionKey = selectedSession.id;
    } else {
      // Check if we already have a session for this project
      const existingProjectSession = sessions.find(s => 
        s.projectName === selectedProject.name && 
        !s.sessionId
      );
      
      if (existingProjectSession) {
        sessionKey = existingProjectSession.key;
      } else {
        // Create new session
        sessionKey = createSession(selectedProject, selectedSession, !selectedSession);
        
        // Initialize session data
        updateSession(sessionKey, {
          projectName: selectedProject.name,
          projectDisplayName: selectedProject.displayName || selectedProject.name,
          projectPath: selectedProject.fullPath || selectedProject.path,
          sessionId: selectedSession?.id,
          sessionSummary: selectedSession?.summary || 'New Session',
          isConnected: false,
          isBypassingPermissions: false
        });
      }
    }

    // Set as active session
    setActiveSession(sessionKey);
  }, [selectedProject, selectedSession, sessions, createSession, updateSession, setActiveSession]);

  // Update parent component with session information
  useEffect(() => {
    const connectedSessions = getConnectedSessions();
    
    if (onSessionCountChange) {
      onSessionCountChange(connectedSessions.length);
    }
    
    if (onTerminalsChange) {
      onTerminalsChange(connectedSessions.map(s => ({
        key: s.key,
        projectName: s.projectName,
        projectDisplayName: s.projectDisplayName,
        sessionId: s.sessionId,
        sessionSummary: s.sessionSummary,
        isConnected: s.isConnected
      })));
    }
  }, [sessions, getConnectedSessions, onSessionCountChange, onTerminalsChange]);

  // Update active terminal
  useEffect(() => {
    if (onActiveTerminalChange) {
      onActiveTerminalChange(activeSessionKey);
    }
  }, [activeSessionKey, onActiveTerminalChange]);

  // Handle terminal switching
  const handleSwitchTerminal = useCallback((sessionKey) => {
    setActiveSession(sessionKey);
  }, [setActiveSession]);

  // Handle terminal close
  const handleCloseTerminal = useCallback((sessionKey) => {
    removeSession(sessionKey);
  }, [removeSession]);

  // Handle connection state change
  const handleConnectionChange = useCallback((sessionKey, isConnected) => {
    updateSession(sessionKey, { isConnected });
    
    // Notify parent if this is the active session
    if (sessionKey === activeSessionKey && onConnectionChange) {
      onConnectionChange(isConnected);
    }
  }, [activeSessionKey, updateSession, onConnectionChange]);

  // Get current active session
  const activeSession = sessions.find(s => s.key === activeSessionKey);

  if (!selectedProject) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold mb-2">Select a Project</h3>
          <p>Choose a project to open an interactive shell in that directory</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900 w-full">
      {/* Shell Tabs */}
      <ShellTabs
        sessions={getConnectedSessions()}
        activeSessionKey={activeSessionKey}
        onSwitchTerminal={handleSwitchTerminal}
        onCloseTerminal={handleCloseTerminal}
      />
      
      {/* Active Terminal */}
      {activeSession && (
        <ShellTerminal
          key={activeSession.key}
          session={activeSession}
          isActive={isActive}
          onConnectionChange={(isConnected) => handleConnectionChange(activeSession.key, isConnected)}
          onSessionUpdate={(data) => updateSession(activeSession.key, data)}
        />
      )}
    </div>
  );
}

// Set up global functions for compatibility
if (typeof window !== 'undefined') {
  window.switchToShellTerminal = (key) => {
    const event = new CustomEvent('switchShellTerminal', { detail: { key } });
    window.dispatchEvent(event);
  };
  
  window.closeShellTerminal = (key) => {
    const event = new CustomEvent('closeShellTerminal', { detail: { key } });
    window.dispatchEvent(event);
  };
  
  window.sendToActiveTerminal = (text) => {
    const event = new CustomEvent('sendToActiveTerminal', { detail: { text } });
    window.dispatchEvent(event);
  };
}

export default ShellRefactored;