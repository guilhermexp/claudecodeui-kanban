/*
 * MainContent.jsx - Main Content Area with Session Protection Props Passthrough
 * 
 * SESSION PROTECTION PASSTHROUGH:
 * ===============================
 * 
 * This component serves as a passthrough layer for Session Protection functions:
 * - Receives session management functions from App.jsx
 * - Passes them down to ChatInterface.jsx
 * 
 * No session protection logic is implemented here - it's purely a props bridge.
 */

import React, { useState, useEffect } from 'react';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import Shell from './Shell';
import GitPanel from './GitPanel';
import VibeTaskPanel from './VibeTaskPanel';
import Dashboard from './Dashboard';
import ErrorBoundary from './ErrorBoundary';

function MainContent({ 
  selectedProject, 
  selectedSession, 
  activeTab, 
  setActiveTab, 
  ws, 
  sendMessage, 
  messages,
  isMobile,
  onMenuClick,
  onSidebarOpen,          // Function to open sidebar (for desktop)
  sidebarOpen,            // Sidebar open state (for desktop)
  isLoading,
  onInputFocusChange,
  // Session Protection Props: Functions passed down from App.jsx to manage active session state
  // These functions control when project updates are paused during active conversations
  onSessionActive,        // Mark session as active when user sends message
  onSessionInactive,      // Mark session as inactive when conversation completes/aborts  
  onReplaceTemporarySession, // Replace temporary session ID with real session ID from WebSocket
  onNavigateToSession,    // Navigate to a specific session (for Claude CLI session duplication workaround)
  onShowSettings,         // Show tools settings panel
  autoExpandTools,        // Auto-expand tool accordions
  showRawParameters,      // Show raw parameters in tool accordions
  autoScrollToBottom,     // Auto-scroll to bottom when new messages arrive
  sendByCtrlEnter,        // Send by Ctrl+Enter mode for East Asian language input
  onShellConnectionChange // Handle shell connection state changes
}) {
  const [editingFile, setEditingFile] = useState(null);
  const [openShellSessions, setOpenShellSessions] = useState(0);
  const [contextWindowPercentage, setContextWindowPercentage] = useState(null);
  const [isVibeTaskPanelOpen, setIsVibeTaskPanelOpen] = useState(false);
  const [shellResizeTrigger, setShellResizeTrigger] = useState(0);
  // Shell terminals state removed - single terminal mode only
  
  // Expose tab switching globally for Shell image drops
  useEffect(() => {
    window.switchToTab = setActiveTab;
    return () => {
      delete window.switchToTab;
    };
  }, [setActiveTab]);

  const handleFileOpen = (filePath, diffInfo = null) => {
    // Create a file object that CodeEditor expects
    const file = {
      name: filePath.split('/').pop(),
      path: filePath,
      projectName: selectedProject?.name,
      diffInfo: diffInfo // Pass along diff information if available
    };
    setEditingFile(file);
  };

  const handleCloseEditor = () => {
    setEditingFile(null);
  };
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with menu button for mobile */}
        {isMobile && (
          <div className="bg-card border-b border-border p-3 md:p-4 flex-shrink-0">
            <button
              onClick={onMenuClick}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <div className="w-12 h-12 mx-auto mb-4">
              <div 
                className="w-full h-full rounded-full border-4 border-muted border-t-muted-foreground" 
                style={{ 
                  animation: 'spin 1s linear infinite',
                  WebkitAnimation: 'spin 1s linear infinite',
                  MozAnimation: 'spin 1s linear infinite'
                }} 
              />
            </div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">Loading Claude Code UI</h2>
            <p>Setting up your workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <div className="h-full flex flex-col">
        {/* Header with menu button for mobile */}
        {isMobile && (
          <div className="bg-card border-b border-border p-3 md:p-4 flex-shrink-0">
            <button
              onClick={onMenuClick}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-xl hover:bg-accent"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground max-w-md mx-auto px-6">
            <div className="w-16 h-16 mx-auto mb-6 bg-muted rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <h2 className="text-2xl font-semibold mb-3 text-foreground">Choose Your Project</h2>
            <p className="text-muted-foreground mb-6 leading-relaxed">
              Select a project from the sidebar to start coding with Claude. Each project contains your chat sessions and file history.
            </p>
            <div className="bg-muted rounded-2xl p-4 border border-border">
              <p className="text-sm text-muted-foreground">
                💡 <strong>Tip:</strong> {isMobile ? 'Tap the menu button above to access projects' : 'Create a new project by clicking the folder icon in the sidebar'}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col relative">
      {/* Header with tabs */}
      <div className="bg-card/95 backdrop-blur-sm border-b border-border h-12 md:h-14 px-3 md:px-4 flex items-center flex-shrink-0 relative z-50">
        <div className="flex items-center justify-between gap-4 md:gap-6 w-full">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 order-1">
            {isMobile && (
              <button
                onClick={onMenuClick}
                onTouchStart={(e) => {
                  e.preventDefault();
                  onMenuClick();
                }}
                className="p-2.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent touch-manipulation active:scale-95"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            {!isMobile && !sidebarOpen && onSidebarOpen && (
              <button
                onClick={onSidebarOpen}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
                title="Open sidebar (Ctrl+B)"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="min-w-0 max-w-[200px] md:max-w-[250px]">
              {
                <div>
                  <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                    {activeTab === 'shell' ? 'Shell' :
                     activeTab === 'files' ? 'Project Files' : 
                     activeTab === 'git' ? 'Source Control' : 
                     activeTab === 'dashboard' ? 'Usage Dashboard' :
                     'Project'}
                  </h2>
                  <div className="text-xs truncate">
                    <span className="inline-block px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 dark:from-blue-400/30 dark:to-purple-400/30 text-blue-700 dark:text-blue-300 font-medium">
                      {selectedProject.displayName}
                    </span>
                  </div>
                </div>
              }
            </div>
          </div>
          

          {/* Context Window Display - shows on all screen sizes */}
          {contextWindowPercentage !== null && (
            <div className={`order-2 ml-2 px-2 py-1 rounded text-xs sm:text-sm ${
              contextWindowPercentage >= 90 ? 'bg-red-500/20 text-red-400' :
              contextWindowPercentage >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              Context: {contextWindowPercentage}%
            </div>
          )}
          
          {/* Modern Tab Navigation - Right Side */}
          <div className="flex-shrink-0 hidden sm:block order-3">
            <div className="relative flex bg-muted rounded-lg p-1 gap-1">
              <button
                onClick={() => setActiveTab('shell')}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'shell'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Shell</span>
                  {openShellSessions > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                      {openShellSessions}
                    </span>
                  )}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'files'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Files</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('git')}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'git'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden sm:inline">Source Control</span>
                </span>
              </button>
              <button
                onClick={() => {
                  setIsVibeTaskPanelOpen(!isVibeTaskPanelOpen);
                  // Close sidebar when opening tasks panel to fit everything on screen
                  if (!isVibeTaskPanelOpen && sidebarOpen && onSidebarOpen) {
                    onSidebarOpen(); // This toggles the sidebar
                  }
                  // Trigger shell resize after a small delay to allow panel animation
                  setTimeout(() => {
                    setShellResizeTrigger(prev => prev + 1);
                  }, 350);
                }}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  isVibeTaskPanelOpen
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span className="hidden sm:inline">Tasks</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'dashboard'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <span className="hidden sm:inline">Dashboard</span>
                </span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Shell Terminal Tabs removed - single terminal mode only */}
      </div>

      {/* Main content wrapper with Tasks panel */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Content Area - Shrinks when Tasks panel is open */}
        <div className={`flex-1 min-h-0 flex flex-col transition-all duration-300 px-2 md:px-4 ${
          isVibeTaskPanelOpen ? 'mr-80 sm:mr-96 md:mr-[420px] lg:mr-[480px]' : ''
        }`}>
          <div className={`h-full overflow-hidden ${activeTab === 'files' ? 'block' : 'hidden'} mt-2`}>
            <FileTree selectedProject={selectedProject} />
          </div>
          <div className={`h-full overflow-hidden ${activeTab === 'shell' ? 'block' : 'hidden'} mt-2`}>
            <Shell 
              selectedProject={selectedProject} 
              selectedSession={selectedSession}
              isActive={activeTab === 'shell'}
              onSessionCountChange={setOpenShellSessions}
              onConnectionChange={onShellConnectionChange}
              isMobile={isMobile}
              resizeTrigger={shellResizeTrigger}
            />
          </div>
          <div className={`h-full overflow-hidden ${activeTab === 'git' ? 'block' : 'hidden'} mt-2`}>
            <GitPanel selectedProject={selectedProject} isMobile={isMobile} isVisible={activeTab === 'git'} />
          </div>
          <div className={`h-full overflow-hidden ${activeTab === 'dashboard' ? 'block' : 'hidden'} mt-2`}>
            <Dashboard onBack={() => setActiveTab('shell')} />
          </div>
        </div>

        {/* Vibe Kanban Sliding Panel - Inside content area */}
        <div 
          className={`absolute top-0 right-0 h-full w-80 sm:w-96 md:w-[420px] lg:w-[480px] bg-background border-l border-border shadow-xl transform transition-transform duration-300 ease-in-out ${
            isVibeTaskPanelOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <VibeTaskPanel isVisible={isVibeTaskPanelOpen} onClose={() => setIsVibeTaskPanelOpen(false)} />
        </div>
      </div>

      {/* Code Editor Modal */}
      {editingFile && (
        <CodeEditor
          file={editingFile}
          onClose={handleCloseEditor}
          projectPath={selectedProject?.path}
        />
      )}
    </div>
  );
}

export default React.memo(MainContent);