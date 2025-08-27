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
import FileManagerSimple from './FileManagerSimple';
import CodeEditor from './CodeEditor';
import Shell from './Shell';
import GitPanel from './GitPanel';
import VibeTaskPanel from './VibeTaskPanel';
import Dashboard from './Dashboard';
import ResourceMonitor from './ResourceMonitor';
import ErrorBoundary from './ErrorBoundary';
import { TextShimmer } from './ui/text-shimmer';
import { ConfigProvider } from './vibe-kanban/config-provider';
import ProjectsModal from './ProjectsModal';
import KanbanModal from './KanbanModal';
import { Folder, Kanban } from 'lucide-react';

function MainContent({ 
  selectedProject, 
  selectedSession, 
  activeTab, 
  setActiveTab, 
  ws, 
  sendMessage, 
  messages,
  isMobile,
  onSidebarOpen,          // Function to open sidebar (for desktop)
  sidebarOpen,            // Sidebar open state (for desktop)
  onActiveSidePanelChange, // Callback to report active side panel state
  isLoading,
  onInputFocusChange,
  // New props for projects modal
  projects,
  onProjectSelect,
  onSessionSelect,
  onNewSession,
  onSessionDelete,
  onProjectDelete,
  onRefresh,
  // Session Protection Props: Functions passed down from App.jsx to manage active session state
  // These functions control when project updates are paused during active conversations
  onSessionActive,        // Mark session as active when user sends message
  onSessionInactive,      // Mark session as inactive when conversation completes/aborts  
  onReplaceTemporarySession, // Replace temporary session ID with real session ID from WebSocket
  onNavigateToSession,    // Navigate to a specific session (for Claude CLI session duplication workaround)
  onShowSettings,         // Show tools settings panel
  onStartStandaloneSession, // Function to start standalone Claude session
  autoExpandTools,        // Auto-expand tool accordions
  showRawParameters,      // Show raw parameters in tool accordions
  autoScrollToBottom,     // Auto-scroll to bottom when new messages arrive
  sendByCtrlEnter,        // Send by Ctrl+Enter mode for East Asian language input
  onShellConnectionChange, // Handle shell connection state changes
  shellHasActiveSession,   // Current Shell session protection state
  onShellSessionStateChange // Function to update Shell session protection state
}) {
  const [editingFile, setEditingFile] = useState(null);
  const [openShellSessions, setOpenShellSessions] = useState(0);
  const [contextWindowPercentage, setContextWindowPercentage] = useState(null);
  const [shellResizeTrigger, setShellResizeTrigger] = useState(0);
  // Panel states - only one can be open at a time
  const [activeSidePanel, setActiveSidePanel] = useState(null); // 'files' | 'git' | 'tasks' | 'dashboard' | null
  const [hasPreviewOpen, setHasPreviewOpen] = useState(false); // Track if preview is open
  // Shell terminals state removed - single terminal mode only
  
  // Modal states
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showKanbanModal, setShowKanbanModal] = useState(false);

  // Notify parent component about active side panel changes
  useEffect(() => {
    if (onActiveSidePanelChange) {
      onActiveSidePanelChange(activeSidePanel);
    }
  }, [activeSidePanel, onActiveSidePanelChange]);
  
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

  // Shell session protection handler - now uses prop function
  const handleShellSessionStateChange = (isActive) => {
    if (onShellSessionStateChange) {
      onShellSessionStateChange(isActive);
    }
  };
  if (isLoading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
                <img 
                  src="/icons/claude-ai-icon.svg" 
                  alt="Claude AI" 
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl font-bold leading-tight tracking-tight text-foreground mb-2">
              vibeclaude
            </h1>
            <p className="text-lg text-muted-foreground font-light mb-8">
              Setting up your workspace
            </p>

            {/* Modern Loading Animation */}
            <div className="relative w-20 h-20 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-muted animate-pulse"></div>
              <div 
                className="absolute inset-0 rounded-full border-4 border-transparent border-t-primary border-r-primary"
                style={{ 
                  animation: 'spin 1.5s linear infinite',
                  WebkitAnimation: 'spin 1.5s linear infinite',
                  MozAnimation: 'spin 1.5s linear infinite'
                }}
              ></div>
              <div 
                className="absolute inset-2 rounded-full border-2 border-transparent border-b-accent border-l-accent"
                style={{ 
                  animation: 'spin 2s linear infinite reverse',
                  WebkitAnimation: 'spin 2s linear infinite reverse',
                  MozAnimation: 'spin 2s linear infinite reverse'
                }}
              ></div>
            </div>

            {/* Loading dots */}
            <div className="flex justify-center space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!selectedProject) {
    return (
      <>
      <div className="h-full flex flex-col">
        <div className="flex-1 flex items-center justify-center bg-background relative">
          <div className="text-center max-w-lg mx-auto px-8">
            {/* Header Section */}
            <div className="mb-12">
              {/* Logo */}
              <div className="flex justify-center mb-8">
                <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-lg">
                  <img 
                    src="/icons/claude-ai-icon.svg" 
                    alt="Claude AI" 
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              
              {/* App Name */}
              <h1 className="text-4xl font-bold text-foreground mb-2">vibeclaude</h1>
              <p className="text-lg text-muted-foreground font-light mb-4">Choose Your Project</p>
              <div className="w-20 h-0.5 bg-gradient-to-r from-primary to-accent mx-auto"></div>
            </div>
            
            {/* Action Section */}
            <div className="space-y-8">
              {/* Primary Action */}
              <div className="space-y-4">
                <button
                  onClick={() => {
                    if (onStartStandaloneSession) {
                      onStartStandaloneSession();
                    }
                  }}
                  className="group inline-flex items-center gap-3 px-8 py-4 bg-neutral-900 text-white rounded-xl font-semibold hover:bg-neutral-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                >
                  <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3" />
                    </svg>
                  </div>
                  <TextShimmer 
                    duration={6}
                    className="text-lg font-semibold"
                  >
                    Start vibeclaude Session
                  </TextShimmer>
                </button>
                <p className="text-sm text-muted-foreground">
                  Launch vibeclaude without any project constraints
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border"></div>
                <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Or</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              {/* Secondary Action */}
              <div className="space-y-4">
                <button
                  onClick={() => setShowProjectsModal(true)}
                  className="inline-flex items-center gap-3 px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-secondary/90 transition-all duration-200 border border-border/50 shadow-md hover:shadow-lg transform hover:scale-[1.02]"
                >
                  <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center">
                    <svg className="w-3 h-3 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </div>
                  Browse Projects
                </button>
                <p className="text-sm text-muted-foreground">
                  Select from your existing projects
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Projects Modal */}
      <ProjectsModal
        isOpen={showProjectsModal}
        onClose={() => setShowProjectsModal(false)}
        projects={projects}
        selectedProject={selectedProject}
        selectedSession={selectedSession}
        onProjectSelect={onProjectSelect}
        onSessionSelect={onSessionSelect}
        onNewSession={onNewSession}
        onSessionDelete={onSessionDelete}
        onProjectDelete={onProjectDelete}
        isLoading={false}
        onRefresh={onRefresh}
      />
      </>
    );
  }

  return (
    <div className="h-full min-h-0 flex flex-col relative overflow-hidden">
      {/* Header with tabs */}
      <div className="h-12 md:h-14 px-3 md:px-4 flex items-center flex-shrink-0 relative z-50">
        <div className="flex items-center justify-between gap-4 md:gap-6 w-full">
          <div className="flex items-center space-x-2 sm:space-x-3 flex-1 order-1">
            {isMobile && (
              <button
                onClick={() => setShowProjectsModal(true)}
                onTouchStart={(e) => {
                  e.preventDefault();
                  setShowProjectsModal(true);
                }}
                className="p-2.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent touch-manipulation active:scale-95 flex items-center gap-1"
              >
                <Folder className="w-5 h-5" />
                <span className="text-xs font-medium">Projects</span>
              </button>
            )}
            {/* Projects button for desktop */}
            {!isMobile && (
              <button
                onClick={() => setShowProjectsModal(true)}
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors flex items-center gap-2"
                title="Open Projects"
              >
                <Folder className="w-5 h-5" />
                <span className="text-sm font-medium">Projects</span>
              </button>
            )}
            <div className="flex items-center gap-3 flex-1">
              <div className="min-w-0 flex-1">
                {
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      Shell {activeSidePanel && `+ ${activeSidePanel === 'files' ? 'Files' : 
                                                      activeSidePanel === 'git' ? 'Source Control' :
                                                      activeSidePanel === 'tasks' ? 'Tasks' :
                                                      activeSidePanel === 'dashboard' ? 'Dashboard' : ''}`}
                    </h2>
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gradient-to-r from-primary/20 to-accent/20 dark:from-primary/30 dark:to-accent/30 text-primary dark:text-primary-foreground font-medium shrink-0">
                      {selectedProject.displayName}
                    </span>
                  </div>
                }
              </div>
            </div>
          </div>
          

          {/* Context Window Display - shows on all screen sizes */}
          {contextWindowPercentage !== null && (
            <div className={`order-2 ml-2 px-2 py-1 rounded text-xs sm:text-sm ${
              contextWindowPercentage >= 90 ? 'bg-destructive/20 text-destructive' :
              contextWindowPercentage >= 70 ? 'bg-warning/20 text-warning-foreground' :
              'bg-success/20 text-success-foreground'
            }`}>
              Context: {contextWindowPercentage}%
            </div>
          )}
          
          {/* Modern Tab Navigation - Right Side */}
          {/* Modern Tab Navigation - Right Side */}
          <div className="flex-shrink-0 hidden sm:block order-3">
            <div className="relative flex items-center bg-muted rounded-lg p-1 gap-1">
              
              <button
                onClick={() => {
                  // Toggle Files panel
                  if (activeSidePanel === 'files') {
                    setActiveSidePanel(null);
                  } else {
                    setActiveSidePanel('files');
                    if (sidebarOpen && onSidebarOpen) {
                      onSidebarOpen();
                    }
                  }
                  setTimeout(() => setShellResizeTrigger(prev => prev + 1), 350);
                }}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeSidePanel === 'files'
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
              
              {/* Kanban button - Opens modal */}
              <button
                onClick={() => setShowKanbanModal(true)}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <Kanban className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  <span className="hidden sm:inline">Kanban</span>
                </span>
              </button>
              
              <button
                onClick={() => {
                  // Toggle Git panel
                  if (activeSidePanel === 'git') {
                    setActiveSidePanel(null);
                  } else {
                    setActiveSidePanel('git');
                    if (sidebarOpen && onSidebarOpen) {
                      onSidebarOpen();
                    }
                  }
                  setTimeout(() => setShellResizeTrigger(prev => prev + 1), 350);
                }}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeSidePanel === 'git'
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
              {/* Tasks button - Only show on desktop */}
              {!isMobile && (
                <button
                  onClick={() => {
                    // Toggle Tasks panel
                    if (activeSidePanel === 'tasks') {
                      setActiveSidePanel(null);
                    } else {
                      setActiveSidePanel('tasks');
                      if (sidebarOpen && onSidebarOpen) {
                        onSidebarOpen();
                      }
                    }
                    setTimeout(() => setShellResizeTrigger(prev => prev + 1), 350);
                  }}
                  className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                    activeSidePanel === 'tasks'
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
              )}
              <button
                onClick={() => {
                  // Toggle Dashboard panel
                  if (activeSidePanel === 'dashboard') {
                    setActiveSidePanel(null);
                  } else {
                    setActiveSidePanel('dashboard');
                    if (sidebarOpen && onSidebarOpen) {
                      onSidebarOpen();
                    }
                  }
                  setTimeout(() => setShellResizeTrigger(prev => prev + 1), 350);
                }}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeSidePanel === 'dashboard'
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
          
          {/* System Monitor - Right Side */}
          <div className="flex-shrink-0 order-4">
            <ResourceMonitor />
          </div>
        </div>
        
        {/* Shell Terminal Tabs removed - single terminal mode only */}
      </div>

      {/* Main content wrapper with side panels */}
      <div className="flex-1 min-h-0 flex relative">
        {/* Shell Area - Keep width stable; side panels overlay on top */}
        <div className={`min-h-0 flex flex-col transition-all duration-300 px-2 md:px-4 flex-1 ${
          activeSidePanel && hasPreviewOpen ? 'pr-48 sm:pr-56 md:pr-64' : ''
        }`}>
          <div className="h-full overflow-hidden mt-2">
            <ConfigProvider>
              <Shell 
                selectedProject={selectedProject} 
                selectedSession={selectedSession}
                isActive={true}
                onSessionCountChange={setOpenShellSessions}
                onConnectionChange={onShellConnectionChange}
                onSessionStateChange={handleShellSessionStateChange}
                isMobile={isMobile}
                resizeTrigger={shellResizeTrigger}
                activeSidePanel={activeSidePanel}
                onPreviewStateChange={setHasPreviewOpen}
                onSidebarClose={() => {
                  if (sidebarOpen && onSidebarOpen) {
                    onSidebarOpen(); // This toggles the sidebar (closes it when open)
                  }
                setActiveSidePanel(null); // Close any active side panel
              }}
            />
            </ConfigProvider>
          </div>
        </div>

        {/* Side Panels - Only one visible at a time on desktop */}
        {!isMobile && (
          <>
            {/* Files Panel */}
            <div 
              className={`absolute top-0 right-0 h-full bg-background shadow-xl transform transition-transform duration-300 ease-in-out ${
                activeSidePanel === 'files' ? 'translate-x-0' : 'translate-x-full'
              } ${
                activeSidePanel === 'files' && hasPreviewOpen ? 'w-48 sm:w-56 md:w-64' : 'w-96 sm:w-[440px] md:w-[520px]'
              }`}
            >
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-hidden">
                  <FileManagerSimple selectedProject={selectedProject} />
                </div>
              </div>
            </div>

            {/* Git Panel */}
            <div 
              className={`absolute top-0 right-0 h-full bg-background shadow-xl transform transition-transform duration-300 ease-in-out ${
                activeSidePanel === 'git' ? 'translate-x-0' : 'translate-x-full'
              } ${
                activeSidePanel === 'git' && hasPreviewOpen ? 'w-48 sm:w-56 md:w-64' : 'w-96 sm:w-[440px] md:w-[520px]'
              }`}
            >
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-hidden">
                  <GitPanel selectedProject={selectedProject} isMobile={false} isVisible={activeSidePanel === 'git'} />
                </div>
              </div>
            </div>

            {/* Tasks Panel */}
            <div 
              className={`absolute top-0 right-0 h-full bg-background shadow-xl transform transition-transform duration-300 ease-in-out ${
                activeSidePanel === 'tasks' ? 'translate-x-0' : 'translate-x-full'
              } ${
                activeSidePanel === 'tasks' && hasPreviewOpen ? 'w-48 sm:w-56 md:w-64' : 'w-96 sm:w-[440px] md:w-[520px]'
              }`}
            >
              <VibeTaskPanel isVisible={activeSidePanel === 'tasks'} onClose={() => setActiveSidePanel(null)} />
            </div>

            {/* Dashboard Panel */}
            <div 
              className={`absolute top-0 right-0 h-full bg-background shadow-xl transform transition-transform duration-300 ease-in-out ${
                activeSidePanel === 'dashboard' ? 'translate-x-0' : 'translate-x-full'
              } ${
                activeSidePanel === 'dashboard' && hasPreviewOpen ? 'w-48 sm:w-56 md:w-64' : 'w-96 sm:w-[440px] md:w-[520px]'
              }`}
            >
              <div className="h-full flex flex-col">
                <div className="flex-1 overflow-hidden">
                  <Dashboard onBack={() => setActiveSidePanel(null)} />
                </div>
              </div>
            </div>
          </>
        )}

        {/* Mobile support - keeping existing tabs behavior */}
        {isMobile && (
          <>
            {activeTab === 'files' && (
              <div className="absolute inset-0 bg-background z-10 mobile-modal ios-sides-safe">
                <div className="h-full mobile-content overflow-y-auto scrollable-content">
                  <FileManagerSimple selectedProject={selectedProject} />
                </div>
              </div>
            )}
            {activeTab === 'git' && (
              <div className="absolute inset-0 bg-background z-10 mobile-modal ios-sides-safe">
                <div className="h-full mobile-content overflow-y-auto scrollable-content">
                  <GitPanel selectedProject={selectedProject} isMobile={true} isVisible={true} />
                </div>
              </div>
            )}
            {activeTab === 'tasks' && (
              <div className="absolute inset-0 bg-background z-10 mobile-modal ios-sides-safe">
                <div className="h-full mobile-content overflow-y-auto scrollable-content">
                  <VibeTaskPanel isVisible={true} onClose={() => setActiveTab('shell')} isMobile={true} />
                </div>
              </div>
            )}
            {activeTab === 'dashboard' && (
              <div className="absolute inset-0 bg-background z-10 mobile-modal ios-sides-safe">
                <div className="h-full mobile-content overflow-y-auto scrollable-content">
                  <Dashboard onBack={() => setActiveTab('shell')} />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Code Editor Modal */}
      {editingFile && (
        <CodeEditor
          file={editingFile}
          onClose={handleCloseEditor}
          projectPath={selectedProject?.path}
        />
      )}
      
      {/* Projects Modal */}
      <ProjectsModal
        isOpen={showProjectsModal}
        onClose={() => setShowProjectsModal(false)}
        projects={projects}
        selectedProject={selectedProject}
        selectedSession={selectedSession}
        onProjectSelect={onProjectSelect}
        onSessionSelect={onSessionSelect}
        onNewSession={onNewSession}
        onSessionDelete={onSessionDelete}
        onProjectDelete={onProjectDelete}
        isLoading={false}
        onRefresh={onRefresh}
      />
      
      {/* Kanban Modal */}
      <KanbanModal
        isOpen={showKanbanModal}
        onClose={() => setShowKanbanModal(false)}
        selectedProject={selectedProject}
        isMobile={isMobile}
      />
    </div>
  );
}

export default React.memo(MainContent);
