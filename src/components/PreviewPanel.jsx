import React, { useState, useRef, useEffect } from 'react';
import { refreshPreviewStatus as apiRefreshStatus, startPreview as apiStartPreview, stopPreview as apiStopPreview, fetchProjectFiles } from '../utils/preview/api';
import { useConsoleCapture } from '../hooks/preview/useConsoleCapture';
import { useElementSelection } from '../hooks/preview/useElementSelection';
import FileManagerSimple from './FileManagerSimple';
import CtaButton from './ui/CtaButton';

function PreviewPanel({ url, projectPath, projectName = null, onClose, onRefresh, onOpenExternal, isMobile, initialPaused = false, onBindControls = null }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(url || '');
  const [isPaused, setIsPaused] = useState(initialPaused);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [pausedUrl, setPausedUrl] = useState(initialPaused ? (url || '') : null); // Store URL when paused
  const [microphoneStatus, setMicrophoneStatus] = useState('idle'); // idle, granted, denied, requesting
  const [showPermissionInfo, setShowPermissionInfo] = useState(false);
  const [elementSelectionMode, setElementSelectionMode] = useState(false); // Direct element selection
  const [selectedElement, setSelectedElement] = useState(null); // Captured element data
  const [deviceMode, setDeviceMode] = useState('desktop'); // 'desktop' | 'mobile'
  const [showFileTree, setShowFileTree] = useState(true);
  const [fileTree, setFileTree] = useState([]);
  
  // Debug state changes
  useEffect(() => {
  }, [elementSelectionMode]);
  const iframeRef = useRef(null);
  const logsRef = useRef(null);
  const startTimerRef = useRef(null);

  // Track if user has manually edited the URL
  const [userEditedUrl, setUserEditedUrl] = useState(false);
  const [uiUrl, setUiUrl] = useState(''); // Friendly URL shown in input
  
  // Backend-driven preview lifecycle
  const [previewRunning, setPreviewRunning] = useState(false);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const pingTimerRef = useRef(null);
  const pingAttemptsRef = useRef(0);

  const refreshPreviewStatus = async () => {
    if (!projectName) return;
    const { running, url: detectedUrl } = await apiRefreshStatus(projectName);
    setPreviewRunning(running);
    if (running && !userEditedUrl && !isPaused) {
      setCurrentUrl(`/preview/${encodeURIComponent(projectName)}/`);
      if (detectedUrl) setUiUrl(detectedUrl);
    }
  };

  useEffect(() => { refreshPreviewStatus(); }, [projectName]);

  // Expose minimal controls to parent (via Shell → MainContent)
  useEffect(() => {
    if (typeof onBindControls === 'function') {
      const controls = {
        showFiles: () => setShowFileTree(true),
        hideFiles: () => setShowFileTree(false),
        toggleFiles: () => setShowFileTree(v => !v)
      };
      onBindControls(controls);
      return () => {
        try { onBindControls(null); } catch {}
      };
    }
  }, [onBindControls]);

  const startBackendPreview = async () => {
    if (!projectName || starting) return;
    setStarting(true);
    setShowFileTree(false);
    try {
      const { url: detectedUrl } = await apiStartPreview(projectName);
      setPreviewRunning(true);
      if (detectedUrl) {
        setCurrentUrl(`/preview/${encodeURIComponent(projectName)}/`);
        setUiUrl(detectedUrl);
        setUserEditedUrl(false);
        waitForServer(detectedUrl);
      }
    } catch {}
    // Keep loader until iframe load or timeout
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = setTimeout(() => setStarting(false), 15000);
  };

  const waitForServer = (url) => {
    try { if (pingTimerRef.current) clearTimeout(pingTimerRef.current); } catch {}
    pingAttemptsRef.current = 0;
    const attempt = async () => {
      pingAttemptsRef.current += 1;
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 800);
        // Use no-cors to avoid CORS errors; success if fetch resolves
        await fetch(url, { mode: 'no-cors', cache: 'no-cache', signal: controller.signal });
        clearTimeout(t);
        setStarting(false);
        setPreviewRunning(true);
        handleRefresh();
        return;
      } catch (e) {
        // keep trying
      }
      if (pingAttemptsRef.current < 30) { // ~24s total
        pingTimerRef.current = setTimeout(attempt, 800);
      } else {
        setStarting(false);
      }
    };
    pingTimerRef.current = setTimeout(attempt, 300);
  };

  const stopBackendPreview = async () => {
    if (!projectName || stopping) return;
    setStopping(true);
    try {
      await apiStopPreview(projectName);
    } catch {}
    setStopping(false);
    setPreviewRunning(false);
    setStarting(false);
    setIsLoading(false);
    setCurrentUrl('');
    try { if (startTimerRef.current) clearTimeout(startTimerRef.current); } catch {}
    try { if (pingTimerRef.current) clearTimeout(pingTimerRef.current); } catch {}
  };

  // Friendly screen when preview is not running
  const [framework, setFramework] = useState(null);
  useEffect(() => {
    // Try to detect framework from package.json
    (async () => {
      try {
        if (!projectPath || projectPath === 'STANDALONE_MODE') return;
        const token = localStorage.getItem('auth-token');
        const pkgPath = `${projectPath}/package.json`;
        const r = await fetch(`/api/files/read?path=${encodeURIComponent(pkgPath)}`, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
        if (!r.ok) return;
        const text = await r.text();
        const pkg = JSON.parse(text);
        const deps = { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}) };
        if (deps.next) setFramework('Next.js');
        else if (deps.vite) setFramework('Vite');
        else if (deps['react-scripts']) setFramework('Create React App');
        else if (deps.remix) setFramework('Remix');
        else if (deps.astro) setFramework('Astro');
        else if (deps['@sveltejs/kit']) setFramework('SvelteKit');
        else if (deps.nuxt || deps['nuxt3']) setFramework('Nuxt');
        else setFramework(null);
      } catch {}
    })();
  }, [projectPath]);
  
  useEffect(() => {
    // Only update from props if user hasn't edited the URL
    if (!userEditedUrl && !isPaused) {
      setCurrentUrl(url);
      setIsLoading(true);
      setError(null);
      setLogs([]);
    }
  }, [url]);

  // Load project file tree when toggled open
  useEffect(() => {
    if (!showFileTree || !projectName || /standalone/i.test(projectName)) return;
    let aborted = false;
    (async () => {
      try {
        const data = await fetchProjectFiles(projectName);
        if (!aborted) setFileTree(data);
      } catch {}
    })();
    return () => { aborted = true; };
  }, [showFileTree, projectName]);

  // File content preview removed here; FileManagerSimple cuida da visualização/edição

  // Check microphone permission status
  const checkMicrophonePermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'microphone' });
      setMicrophoneStatus(result.state);
      
      // Listen for permission changes
      result.addEventListener('change', () => {
        setMicrophoneStatus(result.state);
      });
    } catch (e) {
      // Permissions API might not be available or microphone not supported
      // Could not check microphone permission
    }
  };

  // Request microphone permission
  const requestMicrophonePermission = async () => {
    try {
      setMicrophoneStatus('requesting');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Stop the stream immediately - we just needed to request permission
      stream.getTracks().forEach(track => track.stop());
      
      setMicrophoneStatus('granted');
      setShowPermissionInfo(false);
      
      // Reload the iframe to apply the new permissions
      if (iframeRef.current) {
        iframeRef.current.src = currentUrl;
      }
    } catch (e) {
      setMicrophoneStatus('denied');
    }
  };

  useEffect(() => {
    checkMicrophonePermission();
  }, []);

  const { captureReady, helperSnippet, clearLogs, refreshLogs, copyLogsToClipboard } = useConsoleCapture({ iframeRef, isPaused, currentUrl, logs, setLogs });

  const handleRefresh = () => {
    if (iframeRef.current && !isPaused) {
      setIsLoading(true);
      setError(null);
      // Clear logs on refresh - errors will be re-captured if they still exist
      setLogs([]);
      
      // Format URL if needed
      let urlToLoad = currentUrl;
      if (currentUrl && !currentUrl.startsWith('http') && !currentUrl.startsWith('/')) {
        urlToLoad = 'http://' + currentUrl;
      }
      
      // Load URL directly for full functionality
      iframeRef.current.src = urlToLoad;
    }
  };
  
  // Expose refresh function to global scope for MainContent
  useEffect(() => {
    window.refreshPreview = handleRefresh;
    return () => {
      delete window.refreshPreview;
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
    };
  }, [currentUrl, isPaused]);

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    if (isPaused && iframeRef.current) {
      // Resume - use the edited URL (pausedUrl) if it was changed, otherwise use currentUrl
      let urlToLoad = pausedUrl || currentUrl;
      
      // Format URL if needed
      if (urlToLoad && !urlToLoad.startsWith('http')) {
        urlToLoad = 'http://' + urlToLoad;
      }
      
      setCurrentUrl(urlToLoad);
      setPausedUrl(null);
      setUserEditedUrl(false); // Reset the flag after using the edited URL
      setIsLoading(true);
      setError(null);
      // Clear logs when resuming with new URL
      setLogs([]);
      iframeRef.current.src = urlToLoad;
    } else if (!isPaused && iframeRef.current) {
      // Pause - clear the iframe and store current URL for editing
      setPausedUrl(currentUrl);
      iframeRef.current.src = 'about:blank';
      setIsLoading(false);
      setError(null);
    }
  };

  

  // Close logs dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (logsRef.current && !logsRef.current.contains(event.target)) {
        setShowLogs(false);
      }
    };

    if (showLogs) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showLogs]);
  
  useElementSelection({
    iframeRef,
    enabled: elementSelectionMode,
    onSelected: (data) => setSelectedElement(data),
    onToggleOff: () => setElementSelectionMode(false)
  });

  const handleOpenExternal = () => {
    window.open(currentUrl, '_blank');
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
    setStarting(false);
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
  };

  const handleIframeError = (event) => {
    // Prevent error from bubbling up to the parent application
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setIsLoading(false);
    setError('Unable to load preview. The server might not be running or the URL might be incorrect.');
  };

  // Validate URL to ensure it's a safe preview URL
  const isValidPreviewUrl = (url) => {
    // Empty URL is valid (for paused state)
    if (!url || url.trim() === '') return true;
    // Allow same-origin proxy paths
    if (url.startsWith('/preview/')) return true;
    if (url.startsWith('/')) return true;
    
    try {
      // Add http:// if missing
      let urlToValidate = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        urlToValidate = 'http://' + url;
      }
      
      const urlObj = new URL(urlToValidate);
      const hostname = urlObj.hostname;
      
      // Allow localhost and local IPs
      const validHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
      if (validHosts.includes(hostname)) return true;
      
      // Allow private network IPs (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
      if (hostname.startsWith('192.168.') || 
          hostname.startsWith('10.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        return true;
      }
      
      // Allow ngrok domains
      if (hostname.includes('ngrok.app') || 
          hostname.includes('ngrok-free.app') ||
          hostname.includes('ngrok.io')) {
        return true;
      }
      
      return false;
    } catch {
      return false;
    }
  };

  if (!isValidPreviewUrl(currentUrl)) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border bg-card">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-medium text-foreground">Preview Panel</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
            title="Close preview"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Invalid URL</h3>
            <p className="text-sm text-muted-foreground">
              Only local network and ngrok URLs can be previewed for security.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background rounded-xl border border-border relative">
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {/* URL Display */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div 
              className={`w-2 h-2 rounded-full ${previewRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`} 
              title={previewRunning ? 'Running' : 'Stopped'} 
            />
            <input
              type="text"
              value={uiUrl || currentUrl}
              onChange={(e) => {
                setUserEditedUrl(true);
                setUiUrl(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  // Map typed URL to proxy path for same-origin features
                  try {
                    let newUi = (uiUrl || '').trim();
                    if (!newUi) return;
                    if (newUi.startsWith('/preview/')) {
                      setCurrentUrl(newUi);
                      setUserEditedUrl(false);
                      handleRefresh();
                      return;
                    }
                    if (newUi.startsWith('http')) {
                      const u = new URL(newUi);
                      const proxy = `/preview/${encodeURIComponent(projectName)}${u.pathname}${u.search}${u.hash}`;
                      setCurrentUrl(proxy);
                      setUiUrl(newUi);
                      setUserEditedUrl(false);
                      handleRefresh();
                      return;
                    }
                    // Relative path -> mount under proxy root
                    if (newUi.startsWith('/')) {
                      const proxy = `/preview/${encodeURIComponent(projectName)}${newUi}`;
                      setCurrentUrl(proxy);
                      setUserEditedUrl(false);
                      handleRefresh();
                      return;
                    }
                    // Fallback: treat as host without protocol
                    const proxy = `/preview/${encodeURIComponent(projectName)}/`;
                    setCurrentUrl(proxy);
                    setUserEditedUrl(false);
                    handleRefresh();
                  } catch {
                    handleRefresh();
                  }
                }
              }}
              className="flex-1 px-2 py-1 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="http://localhost:3000"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            {/* File tree toggle */}
            {projectName && (
              <button
                onClick={() => setShowFileTree(v => !v)}
                className={`p-1.5 rounded-md hover:bg-accent transition-colors ${showFileTree ? 'opacity-100' : 'opacity-80'}`}
                title={showFileTree ? 'Hide project files' : 'Show project files'}
              >
                {/* Folder icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 7h5l2 2h11v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"/>
                </svg>
              </button>
            )}
            {/* Device mode */}
            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`p-1.5 rounded-md hover:bg-accent transition-colors ${deviceMode==='desktop' ? 'opacity-100' : 'opacity-70'}`}
                title="Desktop preview"
              >
                {/* Monitor icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="12" rx="2"/>
                  <path d="M8 21h8M12 17v4"/>
                </svg>
              </button>
              <button
                onClick={() => setDeviceMode('mobile')}
                className={`p-1.5 rounded-md hover:bg-accent transition-colors ${deviceMode==='mobile' ? 'opacity-100' : 'opacity-70'}`}
                title="Mobile preview"
              >
                {/* Mobile icon */}
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="7" y="3" width="10" height="18" rx="2"/>
                  <circle cx="12" cy="17" r="1"/>
                </svg>
              </button>
            </div>
            {/* Backend preview lifecycle */}
            {projectName && (
              previewRunning ? (
                <button
                  onClick={stopBackendPreview}
                  disabled={stopping}
                  className={`p-1.5 rounded-md hover:bg-accent transition-colors ${stopping ? 'opacity-50' : ''}`}
                  title="Stop preview"
                >
                  {/* Stop icon */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="8" y="8" width="8" height="8"/>
                  </svg>
                </button>
              ) : (
                <button
                  onClick={startBackendPreview}
                  disabled={starting}
                  className={`p-1.5 rounded-md hover:bg-accent transition-colors ${starting ? 'opacity-50' : ''}`}
                  title="Start preview"
                >
                  {/* Play icon */}
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
              )
            )}
            
            {/* Element Selection Toggle */}
            <button
              onClick={() => {
                setElementSelectionMode(!elementSelectionMode);
              }}
              className={`p-1.5 rounded-md transition-colors ${
                elementSelectionMode 
                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30' 
                  : 'hover:bg-accent'
              }`}
              title={elementSelectionMode ? "Element selection active - Click any element" : "Click to select elements"}
              
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2z" />
              </svg>
            </button>
            
            {/* Microphone Permission Button - Hidden but functional */}
            <button
              onClick={() => {
                if (microphoneStatus === 'prompt' || microphoneStatus === 'denied') {
                  setShowPermissionInfo(true);
                } else if (microphoneStatus === 'idle') {
                  requestMicrophonePermission();
                }
              }}
              className="hidden"
              aria-hidden="true"
            />

            {/* Pause/Play toggle removed */}
            <button
              onClick={handleRefresh}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              title="Refresh preview"
              
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            {/* Error Console Button - Only highlight if there are errors */}
            <div className="relative" ref={logsRef}>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={`p-1.5 hover:bg-accent rounded-md transition-colors relative ${
                  logs.length > 0 
                    ? 'text-red-500 animate-pulse' 
                    : 'text-muted-foreground opacity-50'
                }`}
                title={`Console Errors (${logs.length})`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {logs.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {logs.length > 99 ? '99+' : logs.length}
                  </span>
                )}
              </button>
              
              {/* Error Console Dropdown */}
              {showLogs && (
                <div className="absolute right-0 mt-2 w-96 max-h-96 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
                    <span className="text-sm font-medium">
                      Console Errors ({logs.length} {logs.length === 1 ? 'error' : 'errors'})
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={refreshLogs}
                        className="text-xs px-2 py-1 hover:bg-accent rounded transition-colors flex items-center gap-1"
                        title="Refresh errors"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Refresh
                      </button>
                      <button
                        onClick={copyLogsToClipboard}
                        className="text-xs px-2 py-1 hover:bg-accent rounded transition-colors flex items-center gap-1"
                        data-copy-button
                        title="Copy all errors to clipboard"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copy
                      </button>
                      <button
                        onClick={clearLogs}
                        className="text-xs px-2 py-1 hover:bg-accent rounded transition-colors"
                        title="Clear all errors"
                      >
                        Clear
                      </button>
                      {/* Helper for cross-origin pages */}
                      {!captureReady && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(helperSnippet).then(() => alert('Helper snippet copied. Paste it in the target app console once.'));
                          }}
                          className="text-xs px-2 py-1 hover:bg-accent rounded transition-colors"
                          title="Copy helper to forward errors from cross-origin apps"
                        >
                          Helper
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-y-auto max-h-80 p-2 space-y-1">
                    {logs.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No errors detected
                      </div>
                    ) : (
                      logs.map((log, index) => (
                        <div
                          key={index}
                          className="p-2 rounded text-xs font-mono bg-red-500/10 border border-red-500/20 text-red-400"
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <span className="uppercase text-xs font-bold text-red-500">
                                ⚠️ ERROR
                              </span>
                              {log.count > 1 && (
                                <span className="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full text-xs font-bold">
                                  {log.count}×
                                </span>
                              )}
                            </div>
                            <span className="text-muted-foreground text-xs">{log.timestamp}</span>
                          </div>
                          <div className="break-all whitespace-pre-wrap font-medium">{log.message}</div>
                          {log.filename && (
                            <div className="mt-1 text-muted-foreground text-xs">
                              📁 {log.filename}:{log.line}:{log.column}
                            </div>
                          )}
                          {log.stack && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-muted-foreground text-xs hover:text-foreground">
                                Stack trace
                              </summary>
                              <pre className="mt-1 text-xs opacity-75 overflow-x-auto bg-black/20 p-1 rounded">{log.stack}</pre>
                            </details>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={handleOpenExternal}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              title="Open in new tab"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              title="Close preview"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Preview Content */}
      <div className="flex-1 relative bg-white">
        {/* Microphone Permission Info Modal */}
        {showPermissionInfo && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-20">
            <div className="bg-card border border-border rounded-lg p-6 max-w-md mx-4 shadow-lg">
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold text-foreground">Microphone Permission Required</h3>
                <button
                  onClick={() => setShowPermissionInfo(false)}
                  className="p-1 hover:bg-accent rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Your application needs microphone access to work properly. The preview panel requires permission to share microphone access with the embedded application.
                </p>
                
                {microphoneStatus === 'denied' && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-md p-3">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Microphone permission was previously denied. You may need to:
                    </p>
                    <ol className="mt-2 ml-4 text-sm text-red-600 dark:text-red-400 list-decimal">
                      <li>Click the lock icon in your browser's address bar</li>
                      <li>Find the microphone permission setting</li>
                      <li>Change it from "Blocked" to "Allow"</li>
                      <li>Refresh the page</li>
                    </ol>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <button
                    onClick={requestMicrophonePermission}
                    className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                    disabled={microphoneStatus === 'requesting'}
                  >
                    {microphoneStatus === 'requesting' ? 'Requesting...' : 'Grant Permission'}
                  </button>
                  <button
                    onClick={() => setShowPermissionInfo(false)}
                    className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-accent transition-colors"
                  >
                    Cancel
                  </button>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Note: The permission is only for this session and will be used solely by your application in the preview.
                </p>
              </div>
            </div>
          </div>
        )}

        {isPaused && false && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Preview Paused</h3>
              <p className="text-sm text-muted-foreground mb-4">Content is disconnected to save resources</p>
              <button
                onClick={handleTogglePause}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Resume Preview
              </button>
            </div>
          </div>
        )}

        {isLoading && !starting && currentUrl && previewRunning && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
            <div className="text-center">
              <div className="w-8 h-8 mx-auto mb-2">
                <div 
                  className="w-full h-full rounded-full border-4 border-muted border-t-primary" 
                  style={{ animation: 'spin 1s linear infinite' }} 
                />
              </div>
              <p className="text-sm text-muted-foreground">Loading preview...</p>
            </div>
          </div>
        )}

        {error && !isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center max-w-md px-4">
              <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Unable to Load Preview</h3>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Iframe principal - sempre mostra a aplicação */}
        {/* Optional side file panel */}
        {showFileTree && projectName && projectPath && (
          <div className="absolute inset-0 z-30 bg-background">
            {/standalone/i.test(String(projectName)) || String(projectPath) === 'STANDALONE_MODE' ? (
              <div className="w-full h-full flex items-center justify-center select-none">
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl overflow-hidden shadow-lg">
                    <img
                      src="/icons/claude-ai-icon.svg"
                      alt="vibeclaude"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <h1 className="text-3xl md:text-4xl font-bold text-foreground">vibeclaude</h1>
                  <p className="text-sm md:text-base text-muted-foreground">Choose Your Project</p>
                  <div className="w-20 h-0.5 bg-gradient-to-r from-primary to-accent" />
                </div>
              </div>
            ) : (
              <FileManagerSimple
                selectedProject={{ name: projectName, path: projectPath }}
                onClose={() => setShowFileTree(false)}
              />
            )}
          </div>
        )}

        <div className={`w-full h-full flex items-center justify-center bg-background`}>
          {(starting || !previewRunning || !currentUrl) ? (
            <div className="text-center text-foreground/90">
              <ClaudableLoader starting={starting} onStart={startBackendPreview} />
            </div>
          ) : (
            <div className={`${deviceMode==='mobile' ? 'w-[375px] h-[667px] rounded-[20px] border-8 border-neutral-800 shadow-2xl overflow-hidden' : 'w-full h-full'} bg-background`}>
              <iframe
                ref={iframeRef}
                src={(currentUrl && (!currentUrl.startsWith('http') && !currentUrl.startsWith('/')) ? 'http://' + currentUrl : currentUrl) || 'about:blank'}
                className="w-full h-full border-0"
                style={{ backgroundColor: 'transparent' }}
                onLoad={handleIframeLoad}
                onError={handleIframeError}
                title="Preview"
                loading="lazy"
                data-preview-frame="true"
                {...(!elementSelectionMode && {
                  sandbox: "allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads allow-storage-access-by-user-activation allow-top-navigation-by-user-activation"
                })}
                allow="microphone *; camera *; geolocation *; accelerometer *; gyroscope *; magnetometer *; midi *; encrypted-media *"
              />
            </div>
          )}
        </div>

        {/* File viewer duplicado removido: FileManagerSimple assume a visualização/edição */}
        
      </div>
      
      {/* Element Selection Preview */}
      {selectedElement && (
        <div className="absolute bottom-4 left-4 right-4 max-w-lg mx-auto bg-card border border-border rounded-lg shadow-xl p-4 z-50">
          <div className="flex justify-between items-start mb-2">
            <h3 className="text-sm font-semibold">Element Selected</h3>
            <button
              onClick={() => setSelectedElement(null)}
              className="text-muted-foreground hover:text-foreground"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="text-xs space-y-1">
            <div><span className="font-medium">Tag:</span> {selectedElement.tag}</div>
            {selectedElement.id && <div><span className="font-medium">ID:</span> {selectedElement.id}</div>}
            {selectedElement.classes && <div><span className="font-medium">Classes:</span> {selectedElement.classes}</div>}
            <div><span className="font-medium">Path:</span> {selectedElement.path}</div>
          </div>
          
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => {
                // Send to OverlayChat (our internal chat)
                if (window.pushToOverlayChat) {
                  // Send the complete element data, not just HTML
                  window.pushToOverlayChat(selectedElement.html, selectedElement);
                }
                // Set global context for compatibility
                window.selectedElementContext = selectedElement;
                setSelectedElement(null);
              }}
              className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90"
            >
              Send to Chat
            </button>
            <button
              onClick={() => {
                // Copy element HTML to clipboard
                navigator.clipboard.writeText(selectedElement.html);
                setSelectedElement(null);
              }}
              className="px-3 py-1 bg-muted hover:bg-accent rounded-md text-xs"
            >
              Copy HTML
            </button>
          </div>
        </div>
      )}
      
      {/* OverlayChat removed from preview to keep panel clean */}
    </div>
  );
}

export default React.memo(PreviewPanel);

function ClaudableLoader({ starting, onStart }) {
  return (
    <div className="text-center">
      <RingLogo spinning={starting} />
      <div className="mt-6">{!starting && (<CtaButton onClick={onStart}>Start Preview</CtaButton>)}</div>
      <h2 className="text-3xl font-semibold mt-6">{starting ? 'Starting Preview…' : 'Preview Not Running'}</h2>
      <p className="text-sm text-white/60 mt-2">Start your development server to see live changes</p>
    </div>
  );
}

function RingLogo() { return null; }

function FrameworkIcon({ name }) {
  const color = '#ffbe55';
  const common = { width: 24, height: 24 };
  if (/next/i.test(name)) {
    return (
      <svg {...common} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="22" fill="none" stroke={color} strokeWidth="2" />
        <path d="M14 30l8-12 12 18" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    );
  }
  if (/vite/i.test(name)) {
    return (
      <svg {...common} viewBox="0 0 48 48">
        <path d="M24 4l8 10-8 28-8-28 8-10z" fill="none" stroke={color} strokeWidth="2" />
        <path d="M24 12l4 5-4 16-4-16 4-5z" fill={color} />
      </svg>
    );
  }
  if (/react|cra/i.test(name)) {
    return (
      <svg {...common} viewBox="0 0 48 48">
        <circle cx="24" cy="24" r="3" fill={color} />
        <ellipse cx="24" cy="24" rx="18" ry="8" stroke={color} strokeWidth="2" fill="none" />
        <ellipse cx="24" cy="24" rx="18" ry="8" stroke={color} strokeWidth="2" fill="none" transform="rotate(60 24 24)" />
        <ellipse cx="24" cy="24" rx="18" ry="8" stroke={color} strokeWidth="2" fill="none" transform="rotate(-60 24 24)" />
      </svg>
    );
  }
  if (/astro/i.test(name)) {
    return (
      <svg {...common} viewBox="0 0 48 48">
        <path d="M24 8l14 30H10L24 8z" fill="none" stroke={color} strokeWidth="2" />
      </svg>
    );
  }
  if (/svelte|sveltekit/i.test(name)) {
    return (
      <svg {...common} viewBox="0 0 48 48">
        <path d="M30 12c-4-3-10-2-13 2l-4 6c-3 4-2 10 2 13s10 2 13-2l4-6c3-4 2-10-2-13z" fill="none" stroke={color} strokeWidth="2" />
      </svg>
    );
  }
  if (/nuxt/i.test(name)) {
    return (
      <svg {...common} viewBox="0 0 48 48">
        <path d="M8 36l10-18 10 18H8z" fill="none" stroke={color} strokeWidth="2" />
        <path d="M36 36L24 14" stroke={color} strokeWidth="2" />
      </svg>
    );
  }
  if (/remix/i.test(name)) {
    return (
      <svg {...common} viewBox="0 0 48 48">
        <rect x="10" y="10" width="28" height="10" rx="2" stroke={color} strokeWidth="2" fill="none" />
        <rect x="10" y="26" width="20" height="12" rx="2" stroke={color} strokeWidth="2" fill="none" />
      </svg>
    );
  }
  return (
    <svg {...common} viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="20" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}
