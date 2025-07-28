/**
 * React hook for shell session management
 */

import { useState, useEffect, useCallback } from 'react';
import shellSessionManager from '../lib/shellSessionManager';

export function useShellSessions() {
  const [sessions, setSessions] = useState([]);
  const [activeSessionKey, setActiveSessionKey] = useState(null);

  // Update sessions when they change
  useEffect(() => {
    const handleSessionsChanged = (updatedSessions) => {
      setSessions(updatedSessions);
    };

    const handleActiveSessionChanged = (key) => {
      setActiveSessionKey(key);
    };

    // Subscribe to events
    shellSessionManager.on('sessionsChanged', handleSessionsChanged);
    shellSessionManager.on('activeSessionChanged', handleActiveSessionChanged);

    // Load initial state
    setSessions(shellSessionManager.getAllSessions());
    setActiveSessionKey(shellSessionManager.activeSessionKey);

    // Cleanup
    return () => {
      shellSessionManager.off('sessionsChanged', handleSessionsChanged);
      shellSessionManager.off('activeSessionChanged', handleActiveSessionChanged);
    };
  }, []);

  // Session management methods
  const createSession = useCallback((project, session = null, forceNew = false) => {
    const key = shellSessionManager.generateSessionKey(project, session, forceNew);
    return key;
  }, []);

  const updateSession = useCallback((key, data) => {
    return shellSessionManager.setSession(key, data);
  }, []);

  const removeSession = useCallback((key) => {
    shellSessionManager.removeSession(key);
  }, []);

  const setActiveSession = useCallback((key) => {
    shellSessionManager.setActiveSession(key);
  }, []);

  const getSession = useCallback((key) => {
    return shellSessionManager.getSession(key);
  }, []);

  const getActiveSession = useCallback(() => {
    return shellSessionManager.getActiveSession();
  }, []);

  const getConnectedSessions = useCallback(() => {
    return shellSessionManager.getConnectedSessions();
  }, []);

  const getSessionDisplayInfo = useCallback((key) => {
    return shellSessionManager.getSessionDisplayInfo(key);
  }, []);

  return {
    sessions,
    activeSessionKey,
    createSession,
    updateSession,
    removeSession,
    setActiveSession,
    getSession,
    getActiveSession,
    getConnectedSessions,
    getSessionDisplayInfo
  };
}