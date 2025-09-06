import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Context
const TabManagerContext = createContext();

// Custom hook
export const useTabManager = () => {
  const context = useContext(TabManagerContext);
  if (!context) {
    throw new Error('useTabManager must be used within a TabManager');
  }
  return context;
};

// Manager component
export const TabManager = ({ children, initialTab = 'shell', isMobile = false }) => {
  const [activeTab, setActiveTabState] = useState(initialTab);

  // Actions
  const setActiveTab = useCallback((tab) => {
    setActiveTabState(tab);
  }, []);

  // Tab configurations
  const availableTabs = [
    {
      id: 'shell',
      label: 'Shell',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18v12H3zM7 20h10M9 8l2 2-2 2m4 0h4" />
        </svg>
      ),
      disabled: false,
    },
    {
      id: 'files',
      label: 'Files',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
        </svg>
      ),
      disabled: false,
      mobileOnly: true,
    },
    {
      id: 'git',
      label: 'Git',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      ),
      disabled: false,
      mobileOnly: true,
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      ),
      disabled: false,
      mobileOnly: true,
    },
  ];

  // Filter tabs based on mobile/desktop
  const getAvailableTabs = useCallback(() => {
    return availableTabs.filter(tab => {
      if (isMobile) {
        // Mobile shows all tabs
        return true;
      } else {
        // Desktop only shows non-mobile-only tabs
        return !tab.mobileOnly;
      }
    });
  }, [isMobile]);

  // Setup global tab switching
  useEffect(() => {
    const switchToTab = (tab) => {
      setActiveTab(tab);
    };

    window.switchToTab = switchToTab;
    
    return () => {
      try {
        delete window.switchToTab;
      } catch {}
    };
  }, [setActiveTab]);

  // Context value
  const value = {
    // State
    activeTab,
    availableTabs: getAvailableTabs(),
    
    // Actions
    setActiveTab,
    
    // Mobile support
    isMobile,
    
    // Computed
    isTabActive: (tabId) => activeTab === tabId,
    getTabConfig: (tabId) => availableTabs.find(tab => tab.id === tabId),
    
    // Navigation helpers
    canNavigateToTab: (tabId) => {
      const tab = availableTabs.find(t => t.id === tabId);
      return tab && !tab.disabled;
    },
    
    getNextTab: () => {
      const tabs = getAvailableTabs();
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
      const nextIndex = (currentIndex + 1) % tabs.length;
      return tabs[nextIndex]?.id || 'shell';
    },
    
    getPreviousTab: () => {
      const tabs = getAvailableTabs();
      const currentIndex = tabs.findIndex(tab => tab.id === activeTab);
      const prevIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1;
      return tabs[prevIndex]?.id || 'shell';
    },
  };

  return (
    <TabManagerContext.Provider value={value}>
      {children}
    </TabManagerContext.Provider>
  );
};

export default TabManager;
