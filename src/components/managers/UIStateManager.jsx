import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// Context
const UIStateManagerContext = createContext();

// Custom hook
export const useUIStateManager = () => {
  const context = useContext(UIStateManagerContext);
  if (!context) {
    throw new Error('useUIStateManager must be used within a UIStateManager');
  }
  return context;
};

// Manager component
export const UIStateManager = ({ children }) => {
  const [toast, setToastState] = useState(null);
  const [productivityMode, setProductivityModeState] = useState(false);
  const [shellResizeTrigger, setShellResizeTriggerState] = useState(0);
  const [hasPreviewOpen, setHasPreviewOpenState] = useState(false);
  const [shellVisible, setShellVisibleState] = useState(true);
  const toastTimeoutRef = useRef(null);

  // Toast actions
  const showToast = useCallback((message, type = 'info', duration = 2000) => {
    // Clear existing timeout
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToastState({ message, type });
    
    // Auto-hide after duration
    toastTimeoutRef.current = setTimeout(() => {
      setToastState(null);
      toastTimeoutRef.current = null;
    }, duration);
  }, []);

  const hideToast = useCallback(() => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
      toastTimeoutRef.current = null;
    }
    setToastState(null);
  }, []);

  // Productivity mode actions
  const toggleProductivityMode = useCallback(() => {
    setProductivityModeState(prev => !prev);
  }, []);

  const setProductivityMode = useCallback((enabled) => {
    setProductivityModeState(enabled);
  }, []);

  // Shell resize trigger
  const triggerShellResize = useCallback(() => {
    setShellResizeTriggerState(prev => prev + 1);
  }, []);

  // Preview state
  const setHasPreviewOpen = useCallback((isOpen) => {
    setHasPreviewOpenState(isOpen);
  }, []);

  // Shell visibility
  const setShellVisible = useCallback((visible) => {
    setShellVisibleState(visible);
  }, []);

  // Context value
  const value = {
    // Toast state
    toast,
    showToast,
    hideToast,
    hasToast: toast !== null,
    
    // Productivity mode
    productivityMode,
    toggleProductivityMode,
    setProductivityMode,
    
    // Shell state
    shellResizeTrigger,
    triggerShellResize,
    hasPreviewOpen,
    setHasPreviewOpen,
    shellVisible,
    setShellVisible,
    
    // Computed helpers
    shouldShowPreviewToggle: !productivityMode,
    isInProductivityLayout: productivityMode,
    
    // UI helpers for responsive design
    showMobileUI: false, // This would come from a media query hook
    showDesktopUI: true, // This would come from a media query hook
  };

  return (
    <UIStateManagerContext.Provider value={value}>
      {children}
    </UIStateManagerContext.Provider>
  );
};

export default UIStateManager;
