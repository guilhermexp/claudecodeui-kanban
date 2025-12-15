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
import ResourceMonitor from './ResourceMonitor';
import PromptsModal from './PromptsModal';
import ErrorBoundary from './ErrorBoundary';
import { TextShimmer } from './ui/text-shimmer';
import { createLogger } from '../utils/logger';
import ProjectsModal from './ProjectsModal';
import DarkModeToggle from './DarkModeToggle';
import PromptEnhancer from './PromptEnhancer';
import { Folder, Settings as SettingsIcon, HardDrive } from 'lucide-react';
import CtaButton from './ui/CtaButton';
import TimerChip from './TimerChip';

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
  const [forceMdPreview, setForceMdPreview] = useState(false);
  // openShellSessions removed - was set but never used
  const [contextWindowPercentage, setContextWindowPercentage] = useState(null);
  const [shellResizeTrigger, setShellResizeTrigger] = useState(0);
  // Panel states
  const [hasPreviewOpen, setHasPreviewOpen] = useState(false); // Track if preview is open
  const [shellVisible, setShellVisible] = useState(true); // Terminal visibility for header dynamics
  
  // Modal states
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [showPromptEnhancer, setShowPromptEnhancer] = useState(false);
  
  // Expose openPromptEnhancer globally for other components
  useEffect(() => {
    window.openPromptEnhancer = () => setShowPromptEnhancer(true);
    return () => {
      delete window.openPromptEnhancer;
    };
  }, []);

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
    setForceMdPreview(/\.(md|markdown)$/i.test(file.name));
  };

  const handleCloseEditor = () => {
    setEditingFile(null);
    setForceMdPreview(false);
  };

  // Global helper to open Markdown from chat badges
  useEffect(() => {
    const fn = (absOrRelPath) => {
      try {
        const isAbs = typeof absOrRelPath === 'string' && absOrRelPath.startsWith('/');
        const p = isAbs ? absOrRelPath : ((selectedProject?.path || '') + '/' + String(absOrRelPath || ''));
        const name = String(p).split('/').pop() || 'file.md';
        setEditingFile({ name, path: p, projectName: selectedProject?.name });
        setForceMdPreview(true);
      } catch {}
    };
    window.__openMarkdown = fn;
    return () => { try { delete window.__openMarkdown; } catch {} };
  }, [selectedProject]);

  // Shell session protection handler - now uses prop function
  const handleShellSessionStateChange = (isActive) => {
    if (onShellSessionStateChange) {
      onShellSessionStateChange(isActive);
    }
  };

  // Handler for executing prompts from PromptsHub
  const handleExecutePrompt = async (promptText) => {
    // Send to Shell terminal
    if (activeTab === 'shell') {
      const shellElement = document.querySelector('.xterm-screen');
      if (shellElement) {
        const terminal = window.shellTerminal;
        if (terminal) {
          terminal.paste(promptText);
          setToast({ message: 'Prompt enviado para o Shell!' });
          setTimeout(() => setToast(null), 2000);
        } else {
          navigator.clipboard.writeText(promptText);
          setToast({ message: 'Prompt copiado! Cole no Shell com Cmd+V' });
          setTimeout(() => setToast(null), 3000);
        }
      }
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
      <div className="h-11 md:h-12 px-3 md:px-3 flex items-center flex-shrink-0 relative z-50 bg-background overflow-visible">
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
                    <h2 className="text-sm sm:text-base font-semibold text-foreground whitespace-nowrap">
                      Shell
                    </h2>
                    <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gradient-to-r from-primary/20 to-accent/20 dark:from-primary/30 dark:to-accent/30 text-primary dark:text-primary-foreground font-medium shrink-0">
                      {selectedProject.displayName}
                    </span>
                  </div>
                }
              </div>
              {/* Shell quick actions (disabled here; controls moved to right header group) */}
              {false && (
              <div className="hidden sm:flex items-center gap-1.5">
                <button
                  onClick={() => { try { window.__shellControls?.toggleBypass?.(); } catch {} }}
                  className="icon-pill-sm text-muted-foreground"
                  title="Toggle bypass permissions"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12a5 5 0 015 5v2H7v-2a5 5 0 015-5zM12 12V7a3 3 0 016 0v5" />
                  </svg>
                </button>
                <button
                  onClick={() => { try { window.__shellControls?.restart?.(); } catch {} }}
                  className="icon-pill-sm text-muted-foreground"
                  title="Restart shell"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9" />
                  </svg>
                </button>
                <button
                  onClick={() => { try { window.__shellControls?.disconnect?.(); } catch {} }}
                  className="icon-pill-sm text-muted-foreground"
                  title="Disconnect shell"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              )}
            </div>
          </div>
          

          {/* Context Window chip moved into each chat overlay; header chip disabled */}
        </div>

        {/* Centered tabs container across the header */}
          <div className="pointer-events-auto hidden sm:flex absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 z-40">
          <div className="flex items-center rounded-[14px] bg-transparent border border-transparent p-0.5 gap-1">
              {/* Projects */}
              {!shellVisible && (
              <button
                onClick={() => { try { window.__shellControls?.showTerminal?.(); } catch {}; }}
                className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 bg-background/60 backdrop-blur-md hover:bg-accent border border-white/20 dark:border-white/10 text-foreground/70 hover:text-foreground shadow-inner"
                title="Open Shell"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h18v12H3zM7 20h10M9 8l2 2-2 2m4 0h4" />
                  </svg>
                  <span className="hidden">Shell</span>
                </span>
              </button>
              )}

              <button
                onClick={() => setShowProjectsModal(true)}
                className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 bg-background/60 backdrop-blur-md hover:bg-accent border border-white/20 dark:border-white/10 text-foreground/70 hover:text-foreground shadow-inner"
                title="Open Projects"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <Folder className="w-4 h-4" />
                  <span className="hidden">Projects</span>
                </span>
              </button>
              
              <button
                onClick={() => {
                  try {
                    window.__shellControls?.toggleProjectBrowser?.();
                  } catch {}
                }}
                className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 bg-background/60 backdrop-blur-md hover:bg-accent border border-white/20 dark:border-white/10 text-foreground/70 hover:text-foreground shadow-inner"
                title="Toggle local folders panel"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <HardDrive className="w-4 h-4" />
                  <span className="hidden">Folders</span>
                </span>
              </button>
              
              { /* Kanban button removed */ }

              {/* Files (desktop hidden if mobile). Opens preview + file tree */}
              <button
                onClick={() => {
                  if (!selectedProject || selectedProject?.isStandalone || selectedProject?.path === 'STANDALONE_MODE') {
                    setShowProjectsModal(true);
                    setToast({ message: 'Select a project to view files' });
                    setTimeout(() => setToast(null), 1800);
                    return;
                  }
                  // Open in Preview/Shell area so it coexists with chats
                  try {
                    if (window.__shellControls?.openFilesPrimary) {
                      window.__shellControls.openFilesPrimary();
                    } else {
                      window.__shellControls?.openPreview?.();
                      setTimeout(() => window.__shellControls?.showFiles?.(), 80);
                    }
                  } catch {}
                  setTimeout(() => setShellResizeTrigger(prev => prev + 1), 350);
                }}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 bg-background/60 backdrop-blur-md hover:bg-accent border border-white/20 dark:border-white/10 text-foreground/70 hover:text-foreground shadow-inner`}
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className="hidden">Files</span>
                </span>
              </button>

              {/* Prompts Hub button (opens modal) */}
              <button
                onClick={() => setShowPromptsModal(true)}
                className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 bg-background/60 backdrop-blur-md hover:bg-accent border border-white/20 dark:border-white/10 text-foreground/70 hover:text-foreground shadow-inner`}
                title="Open Prompts Hub"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8z" />
                  </svg>
                  <span className="hidden">Prompts</span>
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
                className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 bg-background/60 backdrop-blur-md hover:bg-accent border border-white/20 dark:border-white/10 text-foreground/70 hover:text-foreground shadow-inner"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="hidden">Source Control</span>
                </span>
              </button>
              

            </div>

            {/* Timer moved to right-side controls to avoid affecting tabs sizing */}
          </div>
          
          {/* Right-side controls group */}
          <div className="absolute top-1/2 -translate-y-1/2 z-40 right-4 flex items-center">
            <div className="flex items-center gap-1.5">
              {/* Timer (always visible on desktop) */}
              <div className="hidden md:block mr-2">
                <TimerChip projectName={selectedProject?.displayName ?? selectedProject?.name ?? 'Standalone'} />
              </div>
              {/* Settings */}
              <button
                onClick={onShowSettings}
                className="icon-pill-sm text-muted-foreground"
                title="Tools Settings"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </button>
              
              {/* Dark Mode Toggle */}
              <div className="icon-pill-sm text-muted-foreground flex items-center justify-center">
                <DarkModeToggle />
              </div>
              
              {/* System Monitor */}
              <div className="icon-pill-sm text-muted-foreground flex items-center justify-center">
                <ResourceMonitor />
              </div>
            </div>
          </div>
        </div>

      <div className="flex-1 min-h-0 flex relative bg-background">
        <div className={`min-h-0 flex flex-col transition-all duration-300 flex-1 bg-background`}>
          <div className="h-full overflow-hidden">
            {!isMobile && (
                <Shell 
                  key="shell-main"
                  selectedProject={selectedProject} 
                  selectedSession={selectedSession}
                  isActive={true}
                  onConnectionChange={onShellConnectionChange}
                  onSessionStateChange={handleShellSessionStateChange}
                  isMobile={false}
                  resizeTrigger={shellResizeTrigger}
                  activeSidePanel={null}
                  onPreviewStateChange={setHasPreviewOpen}
                  onBindControls={(controls) => { window.__shellControls = controls; }}
                  onTerminalVisibilityChange={setShellVisible}
                  onSidebarClose={() => {
                    if (sidebarOpen && onSidebarOpen) {
                      onSidebarOpen();
                    }
                  }}
                  projects={projects}
                  onProjectSelect={onProjectSelect}
                  onProjectsRefresh={onRefresh}
                />
            )}
          </div>
        </div>

        {/* Files overlay removed: Files opens inside Preview to avoid overlapping other panels */}
        

        {/* Mobile support - keeping existing tabs behavior */}
        {isMobile && (
          <>
            {activeTab === 'files' && (
              <div className="absolute inset-0 bg-background z-10 mobile-modal ios-sides-safe">
                <div className="h-full mobile-content overflow-y-auto scrollable-content">
                  <FileManagerSimple selectedProject={selectedProject} embedded={true} />
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

      {/* No desktop-specific picker here; Files uses current project */}

      {/* Code Editor Modal */}
      {editingFile && (
        <CodeEditor
          file={editingFile}
          onClose={handleCloseEditor}
          projectPath={selectedProject?.path}
          preferMarkdownPreview={forceMdPreview}
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

      {/* Prompts Modal */}
      <PromptsModal 
        isOpen={showPromptsModal} 
        onClose={() => setShowPromptsModal(false)}
        onExecutePrompt={handleExecutePrompt}
      />

      {/* Prompt Enhancer Modal */}
      <PromptEnhancer
        open={showPromptEnhancer}
        onClose={() => setShowPromptEnhancer(false)}
      />


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
