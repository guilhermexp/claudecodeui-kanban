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
import OverlayChat from './OverlayChat';
import OverlayChatClaude from './OverlayChatClaude';
import ResourceMonitor from './ResourceMonitor';
import ErrorBoundary from './ErrorBoundary';
import { TextShimmer } from './ui/text-shimmer';
import { createLogger } from '../utils/logger';
import ProjectsModal from './ProjectsModal';
import DarkModeToggle from './DarkModeToggle';
import { Folder, Settings as SettingsIcon } from 'lucide-react';
import CtaButton from './ui/CtaButton';

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
  // openShellSessions removed - was set but never used
  const [contextWindowPercentage, setContextWindowPercentage] = useState(null);
  const [shellResizeTrigger, setShellResizeTrigger] = useState(0);
  // Panel states - only one can be open at a time
  const [activeSidePanel, setActiveSidePanel] = useState(null); // 'files' | 'git' | 'chat' | null
  const [hasPreviewOpen, setHasPreviewOpen] = useState(false); // Track if preview is open
  const [shellVisible, setShellVisible] = useState(true); // Terminal visibility for header dynamics
  // Shell terminals state removed - single terminal mode only
  
  // Modal states
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  // const [showKanbanModal, setShowKanbanModal] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [claudeOverlaySessionId, setClaudeOverlaySessionId] = useState(null);
  const [claudeOverlayControls, setClaudeOverlayControls] = useState(null);
  const [codexOverlayControls, setCodexOverlayControls] = useState(null);
  const [chatActivity, setChatActivity] = useState(false); // true if any chat is active
  
  // Debug logging for endClaudeOverlaySession updates
  useEffect(() => {
    const log = createLogger('MainContent');
    log.debug('claudeOverlayControls updated:', {
      hasEnd: typeof claudeOverlayControls?.end === 'function',
      hasNew: typeof claudeOverlayControls?.new === 'function'
    });
  }, [claudeOverlayControls]);

  // Notify parent component about active side panel changes
  useEffect(() => {
    if (onActiveSidePanelChange) {
      onActiveSidePanelChange(activeSidePanel);
    }
  }, [activeSidePanel, onActiveSidePanelChange]);

  // (Removed assistant side panel integration)
  
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
                <CtaButton
                  onClick={() => {
                    if (onStartStandaloneSession) {
                      onStartStandaloneSession();
                    }
                  }}
                  className="group inline-flex items-center gap-3"
                >
                  <TextShimmer 
                    duration={6}
                    className="text-lg font-semibold"
                    variant="on-light"
                  >
                    Start vibeclaude Session
                  </TextShimmer>
                </CtaButton>
                <p className="text-sm text-muted-foreground">
                  Launch vibeclaude without any project constraints
                </p>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-4">
                <div className="flex-1 h-px bg-border"></div>
                <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">OR</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              {/* Secondary Action */}
              <div className="space-y-4">
                <CtaButton
                  onClick={() => setShowProjectsModal(true)}
                  icon={false}
                >
                  Browse Projects
                </CtaButton>
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
      <div className="h-12 md:h-14 px-3 md:px-4 flex items-center flex-shrink-0 relative z-50 bg-background">
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

            {/* Preview button - toggles preview panel (icon-only) */}
              <button
                onClick={() => {
                  if (hasPreviewOpen) {
                    try { window.__shellControls?.closePreview?.(); } catch {}
                  } else {
                    try { window.__shellControls?.openPreview?.(); } catch {}
                  }
                  setTimeout(() => setShellResizeTrigger(prev => prev + 1), 300);
                }}
                className={`hidden sm:inline-flex items-center p-2 rounded-md transition-all duration-200 ${
                  hasPreviewOpen ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </button>
            {/* Projects button (desktop) moved into centered tabs */}
            <div className="flex items-center gap-3 flex-1">
              <div className="min-w-0 flex-1">
                {
                  <div className="flex items-center gap-3">
                    <h2 className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white whitespace-nowrap">
                      Shell {activeSidePanel && `+ ${activeSidePanel === 'files' ? 'Files' : 
                                                      activeSidePanel === 'chat' ? 'Assistant' : ''}`}
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
        </div>

        {/* Centered tabs container across the header */}
        <div className="pointer-events-auto hidden sm:flex absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-40">
          <div className="flex items-center bg-muted rounded-lg p-1 gap-1 shadow-sm">
              {/* Projects */}
              {!shellVisible && (
              <button
                onClick={() => { try { window.__shellControls?.showTerminal?.(); } catch {}; }}
                className="relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent"
                title="Open Shell"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18v12H3zM7 20h10M9 8l2 2-2 2m4 0h4" />
                  </svg>
                  <span className="hidden sm:inline">Shell</span>
                </span>
              </button>
              )}

              <button
                onClick={() => setShowProjectsModal(true)}
                className="relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent"
                title="Open Projects"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <Folder className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
                  <span className="hidden sm:inline">Projects</span>
                </span>
              </button>
              
              { /* Kanban button removed */ }

              {/* Files (mobile hidden) */}
              <button
                onClick={() => {
                  // Prefer Chat + Preview (two panels). If a chat é aberto, recede terminal por padrão.
                  if (activeSidePanel === 'claude-chat' || activeSidePanel === 'codex-chat') {
                    try { window.__shellControls?.hideTerminal?.(); } catch {}
                  }
                  try {
                    window.__shellControls?.openPreview?.();
                    window.__shellControls?.showFiles?.();
                  } catch {}
                  setTimeout(() => setShellResizeTrigger(prev => prev + 1), 350);
                }}
                className={`hidden sm:inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="hidden sm:inline">Files</span>
                </span>
              </button>
              
              
              <button
                onClick={() => {
                  if (!selectedProject || selectedProject?.isStandalone || selectedProject?.path === 'STANDALONE_MODE') {
                    setToast({ message: 'Source Control is disabled in standalone sessions' });
                    setTimeout(() => setToast(null), 2200);
                    return;
                  }
                  setShowGitModal(true);
                }}
                className="relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden sm:inline">Source Control</span>
                </span>
              </button>
              {/* Codex AI button - opens Codex chat panel */}
              <button
                onClick={() => {
                  if (activeSidePanel === 'codex-chat') {
                    setActiveSidePanel(null);
                  } else {
                    // Don't close preview - allow both to be open
                    // Close Claude chat if open
                    if (activeSidePanel === 'claude-chat') {
                      setActiveSidePanel('codex-chat');
                    } else {
                      setActiveSidePanel('codex-chat');
                    }
                    if (sidebarOpen && onSidebarOpen) {
                      onSidebarOpen();
                    }
                  }
                  setTimeout(() => setShellResizeTrigger(prev => prev + 1), 350);
                }}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeSidePanel === 'codex-chat'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                title="Open Codex AI Assistant"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h6m-7 7l-2 2V5a2 2 0 012-2h14a2 2 0 012 2v12a2 2 0 01-2 2H7z" />
                  </svg>
                  <span className="hidden sm:inline">Codex</span>
                </span>
              </button>
              
              {/* Claude Code button - opens Claude chat panel */}
              <button
                onClick={() => {
                  if (activeSidePanel === 'claude-chat') {
                    setActiveSidePanel(null);
                  } else {
                    // Don't close preview - allow both to be open
                    // Close Codex chat if open
                    if (activeSidePanel === 'codex-chat') {
                      setActiveSidePanel('claude-chat');
                    } else {
                      setActiveSidePanel('claude-chat');
                    }
                    if (sidebarOpen && onSidebarOpen) {
                      onSidebarOpen();
                    }
                  }
                  setTimeout(() => setShellResizeTrigger(prev => prev + 1), 350);
                }}
                className={`relative inline-flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all duration-200 ${
                  activeSidePanel === 'claude-chat'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
                title="Open Claude Code Assistant"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-3 sm:w-3.5 h-3 sm:h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">Claude</span>
                </span>
              </button>
              

            </div>
          </div>
          
          {/* Right-side controls group - Settings, Dark Mode, System */}
          <div className="flex absolute right-4 top-1/2 -translate-y-1/2 z-40">
            <div className="flex items-center bg-muted rounded-lg p-1 gap-1 shadow-sm">
              {claudeOverlaySessionId && !String(claudeOverlaySessionId).startsWith('temp-') && (
                <span className="hidden sm:inline-flex items-center h-7 px-2 rounded-md bg-background/80 text-[11px] text-muted-foreground border border-border/40 mr-1" title="Claude session active">
                  Active
                </span>
              )}
              {(activeSidePanel === 'claude-chat' ? claudeOverlayControls?.end : codexOverlayControls?.end) && (
                <button
                  onClick={() => { 
                    try { 
                      (activeSidePanel === 'claude-chat' ? claudeOverlayControls.end : codexOverlayControls.end)(); 
                      // Close panel after a delay to allow session to end properly
                      setTimeout(() => {
                        setActiveSidePanel(null);
                      }, 500);
                    } catch {} 
                  }}
                  className="px-2 h-7 rounded-md text-[11px] bg-background/80 border border-border/40 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title="End Claude session and close panel"
                >End</button>
              )}
              {(activeSidePanel === 'claude-chat' ? claudeOverlayControls?.new : codexOverlayControls?.new) && (
                <button
                  onClick={() => { try { (activeSidePanel === 'claude-chat' ? claudeOverlayControls.new : codexOverlayControls.new)(); } catch {}; if (!activeSidePanel) setActiveSidePanel('claude-chat'); }}
                  className="px-2 h-7 rounded-md text-[11px] bg-background/80 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-accent/20"
                  title="Start new Claude session"
                >New</button>
              )}
              {/* Settings */}
              <button
                onClick={onShowSettings}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
                title="Tools Settings"
              >
                <SettingsIcon className="w-4 h-4" />
              </button>
              
              {/* Dark Mode Toggle */}
              <DarkModeToggle />
              
              {/* System Monitor */}
              <ResourceMonitor />
            </div>
          </div>
        </div>

      <div className="flex-1 min-h-0 flex relative bg-background">
        {/* Shell Area - main content flexes; assistant panel occupies width when open */}
        <div className={`min-h-0 flex flex-col transition-all duration-300 flex-1 bg-background`}>
          <div className="h-full overflow-hidden">
            {!isMobile && (
                <Shell 
                  selectedProject={selectedProject} 
                  selectedSession={selectedSession}
                  isActive={true}
                  onConnectionChange={onShellConnectionChange}
                  onSessionStateChange={handleShellSessionStateChange}
                  isMobile={false}
                  resizeTrigger={shellResizeTrigger}
                  activeSidePanel={activeSidePanel}
                  onPreviewStateChange={setHasPreviewOpen}
                  onBindControls={(controls) => { window.__shellControls = controls; }}
                  onTerminalVisibilityChange={setShellVisible}
                  onSidebarClose={() => {
                    if (sidebarOpen && onSidebarOpen) {
                      onSidebarOpen();
                    }
                    setActiveSidePanel(null);
                  }}
                />
            )}
          </div>
        </div>

        {/* Removed empty-state overlay when shell is hidden to avoid duplication */}

        {/* Codex Chat panel integrated */}
        {!isMobile && (
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            activeSidePanel === 'codex-chat' ? 'w-[260px] sm:w-[320px] md:w-[360px] lg:w-[420px] border-l border-border bg-black' : 'w-0'
          }`}>
            {activeSidePanel === 'codex-chat' && (
              <OverlayChat 
                embedded={true}
                disableInlinePanel={true}
                projectPath={selectedProject?.path}
                previewUrl={null}
                onPanelClosed={() => setActiveSidePanel(null)}
                cliProviderFixed="codex"
                chatId="codex-instance"
                onBindControls={setCodexOverlayControls}
                onActivityChange={(active) => setChatActivity(active)}
              />
            )}
          </div>
        )}
        
        {/* Claude Chat panel integrated */}
        {!isMobile && (
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            activeSidePanel === 'claude-chat' ? 'w-[260px] sm:w-[320px] md:w-[360px] lg:w-[420px] border-l border-border bg-black' : 'w-0'
          }`}>
            {activeSidePanel === 'claude-chat' && (
              <div style={{ height: '100%' }}>
                <OverlayChatClaude 
                  key="claude-chat-panel"
                  embedded={true}
                  disableInlinePanel={true}
                  cliProviderFixed="claude"
                  chatId="claude-instance"
                  projectPath={selectedProject?.path}
                  previewUrl={null}
                  onSessionIdChange={setClaudeOverlaySessionId}
                  onBindControls={setClaudeOverlayControls}
                  onActivityChange={(active) => setChatActivity(active)}
                  onPanelClosed={() => setActiveSidePanel(null)}
                />
              </div>
            )}
          </div>
        )}

        {/* Files panel overlay removed: Files now always opens integrated over the Preview */}
        

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
      
      { /* Kanban Modal removed */ }

      {/* Git Modal */}
      {showGitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setShowGitModal(false)} />
          <div className="relative z-50 w-full max-w-4xl max-h-[85vh] bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <GitPanel 
              selectedProject={selectedProject} 
              isMobile={false} 
              isVisible={true} 
              onClose={() => setShowGitModal(false)} 
            />
          </div>
        </div>
      )}

      {/* Toast - discrete top-center notice */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
          <div className="px-3 py-2 text-xs bg-background/90 text-muted-foreground border border-border rounded-md shadow-sm">
            {toast.message}
          </div>
        </div>
      )}

    </div>
  );
}

export default React.memo(MainContent);
