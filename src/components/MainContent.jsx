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
import { useClaudeWebSocket } from '../contexts/ClaudeWebSocketContext';
import FileManagerSimple from './FileManagerSimple';
import CodeEditor from './CodeEditor';
import Shell from './Shell';
import GitPanel from './GitPanel';
import OverlayChatClaude from './OverlayChatClaude';
import ResourceMonitor from './ResourceMonitor';
import PromptsModal from './PromptsModal';
import ErrorBoundary from './ErrorBoundary';
import { TextShimmer } from './ui/text-shimmer';
import { createLogger } from '../utils/logger';
import ProjectsModal from './ProjectsModal';
import DarkModeToggle from './DarkModeToggle';
import PromptEnhancer from './PromptEnhancer';
import { Folder, Settings as SettingsIcon } from 'lucide-react';
import CtaButton from './ui/CtaButton';
import TimerChip from './TimerChip';
import { ModalManager, useModalManager } from './managers/ModalManager';

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
  // Panel states - only one can be open at a time
  const [activeSidePanel, setActiveSidePanel] = useState(null); // 'codex-chat' | 'claude-chat'
  const [hasPreviewOpen, setHasPreviewOpen] = useState(false); // Track if preview is open
  const [shellVisible, setShellVisible] = useState(true); // Terminal visibility for header dynamics
  // Shell terminals state removed - single terminal mode only
  
  // TODO: MODAL_MANAGEMENT - These states will be moved to ModalManager
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  // const [showKanbanModal, setShowKanbanModal] = useState(false);
  const [showGitModal, setShowGitModal] = useState(false);
  const [showPromptsModal, setShowPromptsModal] = useState(false);
  // Desktop Files overlay removed; Files opens inside Preview/Shell area
  const [toast, setToast] = useState(null);
  const [showPromptEnhancer, setShowPromptEnhancer] = useState(false);
  const [claudeOverlaySessionId, setClaudeOverlaySessionId] = useState(null);
  const [claudeOverlayControls, setClaudeOverlayControls] = useState(null);
  const [codexOverlayControls, setCodexOverlayControls] = useState(null);
  const [chatActivity, setChatActivity] = useState(false); // true if any chat is active
  const [productivityMode, setProductivityMode] = useState(false);
  const { registerMessageHandler } = useClaudeWebSocket();
  const [ctxUsed, setCtxUsed] = useState({ claude: 0, codex: 0 });
  
  // Debug logging for endClaudeOverlaySession updates
  useEffect(() => {
    const log = createLogger('MainContent');
    log.debug('claudeOverlayControls updated:', {
      hasEnd: typeof claudeOverlayControls?.end === 'function',
      hasNew: typeof claudeOverlayControls?.new === 'function'
    });
  }, [claudeOverlayControls]);

  // Expose openPromptEnhancer globally for other components
  useEffect(() => {
    window.openPromptEnhancer = () => setShowPromptEnhancer(true);
    return () => {
      delete window.openPromptEnhancer;
    };
  }, []);

  // Listen for backend context window updates and reflect in header chip
  useEffect(() => {
    const unsub = registerMessageHandler('ctx-window', (msg) => {
      try {
        if (!msg || msg.type !== 'context-usage') return;
        // Server may send percentage directly. Prefer it if present.
        if (typeof msg.percentage === 'number') {
          setContextWindowPercentage(Math.max(0, Math.min(100, Math.round(msg.percentage))));
          return;
        }
        // Otherwise compute locally using provider defaults and accumulated usage.
        const provider = (msg.provider || 'claude').toLowerCase();
        const usedIncrement = Number(msg.used || 0);
        // Accumulate tokens per provider (approx if server only sends per-message usage)
        setCtxUsed((prev) => {
          const next = { ...prev };
          if (!Number.isFinite(next[provider])) next[provider] = 0;
          next[provider] += usedIncrement;
          // Compute limit
          let limit = 200000; // default 200k
          if (provider === 'codex') {
            try {
              const label = (localStorage.getItem('codex-model-label') || '').toLowerCase();
              limit = label === 'gpt-high' ? 400000 : 200000;
            } catch {}
          } else {
            // Claude defaults to 200k for Sonnet/Opus; adjust here if needed in the future
            limit = 200000;
          }
          const pct = Math.max(0, Math.min(100, Math.round((next[provider] / Math.max(1, limit)) * 100)));
          setContextWindowPercentage(pct);
          return next;
        });
      } catch {}
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, [registerMessageHandler]);

  // Reset context usage counters when new sessions start
  useEffect(() => {
    const unsub = registerMessageHandler('ctx-reset', (msg) => {
      try {
        if (!msg) return;
        if (msg.type === 'claude-session-started') {
          setCtxUsed((p) => ({ ...p, claude: 0 }));
          setContextWindowPercentage(0);
        } else if (msg.type === 'codex-session-started') {
          setCtxUsed((p) => ({ ...p, codex: 0 }));
          setContextWindowPercentage(0);
        }
      } catch {}
    });
    return () => { try { unsub && unsub(); } catch {} };
  }, [registerMessageHandler]);

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

  // Helpers to ensure chat panels are open before sending from Prompt Enhancer
  const waitFor = (check, { timeout = 2000, interval = 50 } = {}) => new Promise((resolve) => {
    const start = Date.now();
    const tick = () => {
      if (check()) return resolve(true);
      if (Date.now() - start >= timeout) return resolve(false);
      setTimeout(tick, interval);
    };
    tick();
  });

  const ensureClaudeOpen = async () => {
    if (activeSidePanel !== 'claude-chat') setActiveSidePanel('claude-chat');
    const ok = await waitFor(() => !!claudeOverlayControls && typeof claudeOverlayControls.insert === 'function');
    if (!ok) {
      setToast({ message: 'Abra o painel do Claude para enviar o texto' });
      setTimeout(() => setToast(null), 2200);
    }
    return ok;
  };

  const ensureCodexOpen = async () => {
    if (activeSidePanel !== 'codex-chat') setActiveSidePanel('codex-chat');
    const ok = await waitFor(() => !!codexOverlayControls && typeof codexOverlayControls.insert === 'function');
    if (!ok) {
      setToast({ message: 'Abra o painel do Codex para enviar o texto' });
      setTimeout(() => setToast(null), 2200);
    }
    return ok;
  };

  // Handler for executing prompts from PromptsHub
  const handleExecutePrompt = async (promptText) => {
    // Check which tab/panel is active and send the prompt there
    if (activeTab === 'shell') {
      // Send to Shell terminal
      const shellElement = document.querySelector('.xterm-screen');
      if (shellElement) {
        // Focus the terminal and paste the prompt
        const terminal = window.shellTerminal; // Assuming terminal is exposed globally
        if (terminal) {
          terminal.paste(promptText);
          setToast({ message: 'Prompt enviado para o Shell!' });
          setTimeout(() => setToast(null), 2000);
        } else {
          // Fallback: copy to clipboard
          navigator.clipboard.writeText(promptText);
          setToast({ message: 'Prompt copiado! Cole no Shell com Cmd+V' });
          setTimeout(() => setToast(null), 3000);
        }
      }
    } else if (activeSidePanel === 'claude-chat') {
      // Send to Claude overlay
      const ready = await ensureClaudeOpen();
      if (ready && claudeOverlayControls) {
        claudeOverlayControls.insert(promptText);
        claudeOverlayControls.send();
        setToast({ message: 'Prompt enviado para o Claude!' });
        setTimeout(() => setToast(null), 2000);
      }
    } else {
      // Default: open Claude and send
      const ready = await ensureClaudeOpen();
      if (ready && claudeOverlayControls) {
        claudeOverlayControls.insert(promptText);
        claudeOverlayControls.send();
        setToast({ message: 'Prompt enviado para o Claude!' });
        setTimeout(() => setToast(null), 2000);
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
        {/* Chat column header overlay: make header area match chat background when open */}
        {(!isMobile && (activeSidePanel === 'codex-chat' || activeSidePanel === 'claude-chat')) && (
          <div
            className={`absolute top-0 right-0 h-full bg-card border-l border-border pointer-events-none transition-all duration-300 ease-in-out rounded-r-lg overflow-hidden ${
              activeSidePanel === 'codex-chat' || activeSidePanel === 'claude-chat'
                ? 'w-[260px] sm:w-[320px] md:w-[360px] lg:w-[420px]'
                : 'w-0'
            }`}
            style={{ zIndex: 20 }}
          />
        )}
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
            {!productivityMode && (
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
            )}
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
                className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 ${
                  activeSidePanel === 'codex-chat'
                    ? 'bg-accent border border-border text-foreground'
                    : 'bg-background/60 hover:bg-accent border border-border/50 text-foreground/70 hover:text-foreground'
                }`}
                title="Open Codex AI Assistant"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  {/* OpenAI/Codex logo */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M21.55 10.004a5.416 5.416 0 00-.478-4.501c-1.217-2.09-3.662-3.166-6.05-2.66A5.59 5.59 0 0010.831 1C8.39.995 6.224 2.546 5.473 4.838A5.553 5.553 0 001.76 7.496a5.487 5.487 0 00.691 6.5 5.416 5.416 0 00.477 4.502c1.217 2.09 3.662 3.165 6.05 2.66A5.586 5.586 0 0013.168 23c2.443.006 4.61-1.546 5.361-3.84a5.553 5.553 0 003.715-2.66 5.488 5.488 0 00-.693-6.497v.001zm-8.381 11.558a4.199 4.199 0 01-2.675-.954c.034-.018.093-.05.132-.074l4.44-2.53a.71.71 0 00.364-.623v-6.176l1.877 1.069c.02.01.033.029.036.05v5.115c-.003 2.274-1.87 4.118-4.174 4.123zM4.192 17.78a4.059 4.059 0 01-.498-2.763c.032.02.09.055.131.078l4.44 2.53c.225.13.504.13.73 0l5.42-3.088v2.138a.068.068 0 01-.027.057L9.9 19.288c-1.999 1.136-4.552.46-5.707-1.51h-.001zM3.023 8.216A4.15 4.15 0 015.198 6.41l-.002.151v5.06a.711.711 0 00.364.624l5.42 3.087-1.876 1.07a.067.067 0 01-.063.005l-4.489-2.559c-1.995-1.14-2.679-3.658-1.53-5.63h.001zm15.417 3.54l-5.42-3.088L14.896 7.6a.067.067 0 01.063-.006l4.489 2.557c1.998 1.14 2.683 3.662 1.529 5.633a4.163 4.163 0 01-2.174 1.807V12.38a.71.71 0 00-.363-.623zm1.867-2.773a6.04 6.04 0 00-.132-.078l-4.44-2.53a.731.731 0 00-.729 0l-5.42 3.088V7.325a.068.068 0 01.027-.057L14.1 4.713c2-1.137 4.555-.46 5.707 1.513.487.833.664 1.809.499 2.757h.001zm-11.741 3.81l-1.877-1.068a.065.065 0 01-.036-.051V6.559c.001-2.277 1.873-4.122 4.181-4.12.976 0 1.92.338 2.671.954-.034.018-.092.05-.131.073l-4.44 2.53a.71.71 0 00-.365.623l-.003 6.173v.002zm1.02-2.168L12 9.25l2.414 1.375v2.75L12 14.75l-2.415-1.375v-2.75z"/>
                  </svg>
                  <span className="hidden">Codex</span>
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
                className={`relative inline-flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-200 ${
                  activeSidePanel === 'claude-chat'
                    ? 'bg-accent border border-border text-foreground'
                    : 'bg-background/60 hover:bg-accent border border-border/50 text-foreground/70 hover:text-foreground'
                }`}
                title="Open Claude Code Assistant"
              >
                <span className="flex items-center gap-1 sm:gap-1.5 leading-none">
                  {/* Claude logo with original color */}
                  <svg className="w-4 h-4" viewBox="0 0 512 510" fill="#D77655">
                    <path d="M142.27 316.619l73.655-41.326 1.238-3.589-1.238-1.996-3.589-.001-12.31-.759-42.084-1.138-36.498-1.516-35.361-1.896-8.897-1.895-8.34-10.995.859-5.484 7.482-5.03 10.717.935 23.683 1.617 35.537 2.452 25.782 1.517 38.193 3.968h6.064l.86-2.451-2.073-1.517-1.618-1.517-36.776-24.922-39.81-26.338-20.852-15.166-11.273-7.683-5.687-7.204-2.451-15.721 10.237-11.273 13.75.935 3.513.936 13.928 10.716 29.749 23.027 38.848 28.612 5.687 4.727 2.275-1.617.278-1.138-2.553-4.271-21.13-38.193-22.546-38.848-10.035-16.101-2.654-9.655c-.935-3.968-1.617-7.304-1.617-11.374l11.652-15.823 6.445-2.073 15.545 2.073 6.547 5.687 9.655 22.092 15.646 34.78 24.265 47.291 7.103 14.028 3.791 12.992 1.416 3.968 2.449-.001v-2.275l1.997-26.641 3.69-32.707 3.589-42.084 1.239-11.854 5.863-14.206 11.652-7.683 9.099 4.348 7.482 10.716-1.036 6.926-4.449 28.915-8.72 45.294-5.687 30.331h3.313l3.792-3.791 15.342-20.372 25.782-32.227 11.374-12.789 13.27-14.129 8.517-6.724 16.1-.001 11.854 17.617-5.307 18.199-16.581 21.029-13.75 17.819-19.716 26.54-12.309 21.231 1.138 1.694 2.932-.278 44.536-9.479 24.062-4.347 28.714-4.928 12.992 6.066 1.416 6.167-5.106 12.613-30.71 7.583-36.018 7.204-53.636 12.689-.657.48.758.935 24.164 2.275 10.337.556h25.301l47.114 3.514 12.309 8.139 7.381 9.959-1.238 7.583-18.957 9.655-25.579-6.066-59.702-14.205-20.474-5.106-2.83-.001v1.694l17.061 16.682 31.266 28.233 39.152 36.397 1.997 8.999-5.03 7.102-5.307-.758-34.401-25.883-13.27-11.651-30.053-25.302-1.996-.001v2.654l6.926 10.136 36.574 54.975 1.895 16.859-2.653 5.485-9.479 3.311-10.414-1.895-21.408-30.054-22.092-33.844-17.819-30.331-2.173 1.238-10.515 113.261-4.929 5.788-11.374 4.348-9.478-7.204-5.03-11.652 5.03-23.027 6.066-30.052 4.928-23.886 4.449-29.674 2.654-9.858-.177-.657-2.173.278-22.37 30.71-34.021 45.977-26.919 28.815-6.445 2.553-11.173-5.789 1.037-10.337 6.243-9.2 37.257-47.392 22.47-29.371 14.508-16.961-.101-2.451h-.859l-98.954 64.251-17.618 2.275-7.583-7.103.936-11.652 3.589-3.791 29.749-20.474-.101.102.024.101z"/>
                  </svg>
                  <span className="hidden">Claude</span>
                </span>
              </button>
              

            </div>

            {/* Timer moved to right-side controls to avoid affecting tabs sizing */}
          </div>
          
          {/* Right-side controls group - centered over chat when open; hide extra controls in Prod */}
          <div className={`absolute top-1/2 -translate-y-1/2 z-40 items-center ${
            (!isMobile && (activeSidePanel === 'codex-chat' || activeSidePanel === 'claude-chat'))
              ? 'right-0 w-[260px] sm:w-[320px] md:w-[360px] lg:w-[420px] flex justify-center'
              : 'right-4 flex'
          }`}>
            <div className="flex items-center gap-1.5">
              {/* Timer (always visible on desktop) */}
              <div className="hidden md:block mr-2">
                <TimerChip projectName={selectedProject?.displayName ?? selectedProject?.name ?? 'Standalone'} />
              </div>
              {/* Productivity mode toggle */}
              <button
                onClick={() => setProductivityMode(v => !v)}
                className={`px-2 h-7 rounded-[12px] text-[11px] border ${productivityMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'text-muted-foreground bg-background/80 border-border hover:bg-accent hover:text-foreground'}`}
                title="Toggle Productivity Mode (Shell + Claude + Codex)"
              >Prod</button>
              {!productivityMode && (
              <>
              {claudeOverlaySessionId && !String(claudeOverlaySessionId).startsWith('temp-') && (
                <span className="hidden sm:inline-flex items-center h-7 px-2 rounded-[12px] bg-accent/30 text-[11px] text-muted-foreground border border-border mr-1" title="Claude session active">
                  Active
                </span>
              )}
              {(activeSidePanel === 'claude-chat' ? claudeOverlayControls?.new : codexOverlayControls?.new) && (
                <button
                  onClick={() => { try { (activeSidePanel === 'claude-chat' ? claudeOverlayControls.new : codexOverlayControls.new)(); } catch {}; if (!activeSidePanel) setActiveSidePanel('claude-chat'); }}
                  className="icon-pill-sm text-muted-foreground"
                  title="New session"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14"/></svg>
                </button>
              )}
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
              </>
              )}
            </div>
          </div>
        </div>

      <div className="flex-1 min-h-0 flex relative bg-background">
        {productivityMode ? (
          <div className="flex w-full h-full">
            {/* Left: Shell (keeps its own bordered container) */}
            <div className="w-1/3 min-w-0 overflow-hidden rounded-none">
              {!isMobile && (
                <Shell
                  key="shell-main" // Fixed key to preserve session
                  selectedProject={selectedProject}
                  selectedSession={selectedSession}
                  isActive={true}
                  onConnectionChange={onShellConnectionChange}
                  onSessionStateChange={handleShellSessionStateChange}
                  isMobile={false}
                  resizeTrigger={shellResizeTrigger}
                  activeSidePanel={null}
                  onPreviewStateChange={() => {}}
                  onBindControls={(controls) => { window.__shellControls = controls; }}
                  onTerminalVisibilityChange={setShellVisible}
                  onSidebarClose={() => {}}
                  disablePreview={true}
                  flushRight={true}
                />
              )}
            </div>
            {/* Middle: Claude (wrapper draws border; inner is borderless) */}
            <div className="w-1/3 min-w-0 overflow-hidden rounded-none">
              {!isMobile && (
                <div className="h-full border border-border rounded-none overflow-hidden">
                  <OverlayChatClaude
                  key="claude-chat-panel" // Use same key as panel mode
                  embedded={true}
                  disableInlinePanel={true}
                  cliProviderFixed="claude"
                  chatId="claude-instance" // Use same chatId as panel mode
                  projectPath={selectedProject?.path}
                  projects={projects}
                  previewUrl={null}
                  onSessionIdChange={setClaudeOverlaySessionId}
                  onBindControls={setClaudeOverlayControls}
                  onActivityChange={(active) => setChatActivity(active)}
                  onPanelClosed={() => {}}
                  tightEdgeLeft={true}
                />
                </div>
              )}
            </div>
            {/* Right: Codex (wrapper with right rounded) */}
            <div className="w-1/3 min-w-0 overflow-hidden">
              {!isMobile && (
                <div className="h-full border border-border rounded-r-lg overflow-hidden">
                  <OverlayChatClaude
                  key="codex-chat-panel" // Use same key as panel mode
                  embedded={true}
                  disableInlinePanel={true}
                  cliProviderFixed="codex"
                  chatId="codex-instance" // Use same chatId as panel mode
                  projectPath={selectedProject?.path}
                  projects={projects}
                  previewUrl={null}
                  onSessionIdChange={() => {}}
                  onBindControls={setCodexOverlayControls}
                  onActivityChange={(active) => setChatActivity(active)}
                  onPanelClosed={() => {}}
                  tightEdgeLeft={true}
                />
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={`min-h-0 flex flex-col transition-all duration-300 flex-1 bg-background`}>
            <div className="h-full overflow-hidden">
              {!isMobile && (
                  <Shell 
                    key="shell-main" // Fixed key to preserve session
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
        )}

        {/* Removed empty-state overlay when shell is hidden to avoid duplication */}

        {/* Codex Chat panel integrated (uses unified Claude overlay for consistent UI) */}
        {!isMobile && !productivityMode && (
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            activeSidePanel === 'codex-chat' ? 'w-[260px] sm:w-[320px] md:w-[360px] lg:w-[420px] bg-transparent' : 'w-0'
          }`}>
            {/* Always mounted to preserve session state when switching panels */}
            <div className={`${activeSidePanel === 'codex-chat' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
                 style={{ pointerEvents: activeSidePanel === 'codex-chat' ? 'auto' : 'none', height: '100%' }}>
              <OverlayChatClaude 
                key="codex-chat-panel"
                embedded={true}
                disableInlinePanel={true}
                cliProviderFixed="codex"
                chatId="codex-instance"
                projectPath={selectedProject?.path}
                projects={projects}
                previewUrl={null}
                onSessionIdChange={() => {}}
                onBindControls={setCodexOverlayControls}
                onActivityChange={(active) => setChatActivity(active)}
                onPanelClosed={() => setActiveSidePanel(null)}
                tightEdgeLeft={true}
              />
            </div>
          </div>
        )}
        
        {/* Claude Chat panel integrated */}
        {!isMobile && !productivityMode && (
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
            activeSidePanel === 'claude-chat' ? 'w-[260px] sm:w-[320px] md:w-[360px] lg:w-[420px] bg-transparent' : 'w-0'
          }`}>
            {/* Always mounted to preserve session state when switching panels */}
            <div className={`${activeSidePanel === 'claude-chat' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
                 style={{ pointerEvents: activeSidePanel === 'claude-chat' ? 'auto' : 'none', height: '100%' }}>
              <OverlayChatClaude 
                key="claude-chat-panel"
                embedded={true}
                disableInlinePanel={true}
                cliProviderFixed="claude"
                chatId="claude-instance"
                projectPath={selectedProject?.path}
                projects={projects}
                previewUrl={null}
                onSessionIdChange={setClaudeOverlaySessionId}
                onBindControls={setClaudeOverlayControls}
                onActivityChange={(active) => setChatActivity(active)}
                onPanelClosed={() => setActiveSidePanel(null)}
                tightEdgeLeft={true}
              />
            </div>
          </div>
        )}

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
        onSendToClaude={async (text, opts = { send: false }) => {
          const ready = await ensureClaudeOpen();
          if (!ready) return;
          try {
            claudeOverlayControls.insert?.(text, { mode: 'replace' });
            claudeOverlayControls.focus?.();
            if (opts.send) claudeOverlayControls.send?.();
          } catch {}
        }}
        onSendToCodex={async (text, opts = { send: false }) => {
          const ready = await ensureCodexOpen();
          if (!ready) return;
          try {
            codexOverlayControls.insert?.(text, { mode: 'replace' });
            codexOverlayControls.focus?.();
            if (opts.send) codexOverlayControls.send?.();
          } catch {}
        }}
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
