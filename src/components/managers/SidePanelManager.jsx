import React, { createContext, useContext, useState, useCallback } from 'react';

// Context
const SidePanelManagerContext = createContext();

// Custom hook
export const useSidePanelManager = () => {
  const context = useContext(SidePanelManagerContext);
  if (!context) {
    throw new Error('useSidePanelManager must be used within a SidePanelManager');
  }
  return context;
};

// Manager component
export const SidePanelManager = ({ children, onActiveSidePanelChange }) => {
  const [activeSidePanel, setActiveSidePanel] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [panelControls, setPanelControls] = useState({
    'claude-chat': null,
    'codex-chat': null,
  });
  const [panelSessionIds, setPanelSessionIds] = useState({
    'claude-chat': null,
    'codex-chat': null,
  });

  // Actions
  const openPanel = useCallback((panelType) => {
    setIsAnimating(true);
    setActiveSidePanel(panelType);
    
    // Notify parent
    if (onActiveSidePanelChange) {
      onActiveSidePanelChange(panelType);
    }

    // End animation after delay
    setTimeout(() => setIsAnimating(false), 300);
  }, [onActiveSidePanelChange]);

  const closePanel = useCallback((panelType = null) => {
    if (panelType === null || panelType === activeSidePanel) {
      setIsAnimating(true);
      setActiveSidePanel(null);
      
      // Notify parent
      if (onActiveSidePanelChange) {
        onActiveSidePanelChange(null);
      }

      setTimeout(() => setIsAnimating(false), 300);
    }
  }, [activeSidePanel, onActiveSidePanelChange]);

  const togglePanel = useCallback((panelType) => {
    if (activeSidePanel === panelType) {
      closePanel(panelType);
    } else {
      openPanel(panelType);
    }
  }, [activeSidePanel, openPanel, closePanel]);

  const setPanelControlsForType = useCallback((panelType, controls) => {
    setPanelControls(prev => ({ ...prev, [panelType]: controls }));
  }, []);

  const getPanelControls = useCallback((panelType) => {
    return panelControls[panelType];
  }, [panelControls]);

  const setSessionIdForPanel = useCallback((panelType, sessionId) => {
    setPanelSessionIds(prev => ({ ...prev, [panelType]: sessionId }));
  }, []);

  // Context value
  const value = {
    // State
    activeSidePanel,
    panels: {
      'claude-chat': {
        isOpen: activeSidePanel === 'claude-chat',
        sessionId: panelSessionIds['claude-chat'],
        controls: panelControls['claude-chat'],
      },
      'codex-chat': {
        isOpen: activeSidePanel === 'codex-chat',
        controls: panelControls['codex-chat'],
      },
    },
    
    // Actions
    openPanel,
    closePanel,
    togglePanel,
    
    // Panel controls
    setPanelControls: setPanelControlsForType,
    getPanelControls,
    
    // Session management
    setSessionIdForPanel,
    
    // Animation state
    isAnimating,
  };

  return (
    <SidePanelManagerContext.Provider value={value}>
      {children}
    </SidePanelManagerContext.Provider>
  );
};

export default SidePanelManager;
