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
import ChatInterface from './ChatInterface';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import Shell from './Shell';
import GitPanel from './GitPanel';
import VibeTaskPanel from './VibeTaskPanel';
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
  // Shell terminals state removed - single terminal mode only

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
          <div className="bg-card border-b border-border p-3 sm:p-4 flex-shrink-0">
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
          <div className="bg-card border-b border-border p-3 sm:p-4 flex-shrink-0">
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
    <div className="h-full flex flex-col">
      {/* Header with tabs */}
      <div className="bg-card border-b border-border p-3 sm:p-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1">
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
                className="p-2.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
                title="Open sidebar"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            )}
            <div className="min-w-0">
              {activeTab === 'chat' && selectedSession ? (
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                    {selectedSession.summary}
                  </h2>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {selectedProject.displayName} <span className="hidden sm:inline">• {selectedSession.id}</span>
                  </div>
                </div>
              ) : activeTab === 'chat' && !selectedSession ? (
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    New Session
                  </h2>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {selectedProject.displayName}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white">
                    {activeTab === 'files' ? 'Project Files' : 
                     activeTab === 'git' ? 'Source Control' : 
                     'Project'}
                  </h2>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {selectedProject.displayName}
                  </div>
                </div>
              )}
            </div>
          </div>
          

          {/* Context Window Display - shows on all screen sizes */}
          {contextWindowPercentage !== null && (
            <div className={`px-2 py-1 rounded text-xs sm:text-sm ${
              contextWindowPercentage >= 90 ? 'bg-red-500/20 text-red-400' :
              contextWindowPercentage >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              Context: {contextWindowPercentage}%
            </div>
          )}
          
          {/* Modern Tab Navigation - Right Side */}
          <div className="flex-shrink-0 hidden sm:block">
            <div className="relative flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setActiveTab('chat')}
                className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md ${
                  activeTab === 'chat'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <span className="hidden sm:inline">Chat</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('shell')}
                className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'shell'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5">
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
                className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'files'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Files</span>
                </span>
              </button>
              <button
                onClick={() => setActiveTab('git')}
                className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'git'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden sm:inline">Source Control</span>
                </span>
              </button>
              <button
                onClick={() => setIsVibeTaskPanelOpen(!isVibeTaskPanelOpen)}
                className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  isVibeTaskPanelOpen
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                  <span className="hidden sm:inline">Tasks</span>
                </span>
              </button>
               {/* <button
                onClick={() => setActiveTab('preview')}
                className={`relative px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeTab === 'preview'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              > 
                <span className="flex items-center gap-1 sm:gap-1.5">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  <span className="hidden sm:inline">Preview</span>
                </span>
              </button> */}
            </div>
          </div>
        </div>
        
        {/* Shell Terminal Tabs removed - single terminal mode only */}
      </div>

      {/* Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className={`h-full ${activeTab === 'chat' ? 'block' : 'hidden'} ${isMobile && activeTab === 'chat' ? 'pb-14' : ''}`}>
          <ErrorBoundary showDetails={true}>
            <ChatInterface
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              ws={ws}
              sendMessage={sendMessage}
              messages={messages}
              onFileOpen={handleFileOpen}
              onInputFocusChange={onInputFocusChange}
              onSessionActive={onSessionActive}
              onSessionInactive={onSessionInactive}
              onReplaceTemporarySession={onReplaceTemporarySession}
              onNavigateToSession={onNavigateToSession}
              onShowSettings={onShowSettings}
              autoExpandTools={autoExpandTools}
              showRawParameters={showRawParameters}
              autoScrollToBottom={autoScrollToBottom}
              sendByCtrlEnter={sendByCtrlEnter}
              onContextWindowUpdate={setContextWindowPercentage}
            />
          </ErrorBoundary>
        </div>
        <div className={`h-full overflow-hidden ${activeTab === 'files' ? 'block' : 'hidden'}`}>
          <FileTree selectedProject={selectedProject} />
        </div>
        <div className={`h-full overflow-hidden ${activeTab === 'shell' ? 'block' : 'hidden'} ${isMobile && activeTab === 'shell' ? 'pb-14' : ''}`}>
          <Shell 
            selectedProject={selectedProject} 
            selectedSession={selectedSession}
            isActive={activeTab === 'shell'}
            onSessionCountChange={setOpenShellSessions}
            onConnectionChange={onShellConnectionChange}
            isMobile={isMobile}
          />
        </div>
        <div className={`h-full overflow-hidden ${activeTab === 'git' ? 'block' : 'hidden'}`}>
          <GitPanel selectedProject={selectedProject} isMobile={isMobile} isVisible={activeTab === 'git'} />
        </div>
        <div className={`h-full overflow-hidden ${activeTab === 'preview' ? 'block' : 'hidden'}`}>
          {/* <LivePreviewPanel
            selectedProject={selectedProject}
            serverStatus={serverStatus}
            serverUrl={serverUrl}
            availableScripts={availableScripts}
            onStartServer={(script) => {
              sendMessage({
                type: 'server:start',
                projectPath: selectedProject?.fullPath,
                script: script
              });
            }}
            onStopServer={() => {
              sendMessage({
                type: 'server:stop',
                projectPath: selectedProject?.fullPath
              });
            }}
            onScriptSelect={setCurrentScript}
            currentScript={currentScript}
            isMobile={isMobile}
            serverLogs={serverLogs}
            onClearLogs={() => setServerLogs([])}
          /> */}
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

      {/* Vibe Kanban Sliding Panel */}
      <div 
        className={`fixed top-0 right-0 h-full w-72 sm:w-80 bg-background border-l border-border shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${
          isVibeTaskPanelOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <VibeTaskPanel isVisible={isVibeTaskPanelOpen} onClose={() => setIsVibeTaskPanelOpen(false)} />
      </div>

      {/* Overlay */}
      {isVibeTaskPanelOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 transition-opacity duration-300"
          onClick={() => setIsVibeTaskPanelOpen(false)}
        />
      )}
    </div>
  );
}

export default React.memo(MainContent);