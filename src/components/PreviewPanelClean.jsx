import React, { useState, useRef, useEffect } from 'react';
import OverlayChat from './OverlayChat';
import { consoleInjectorScript } from '../utils/console-injector';

function PreviewPanelClean({ url, projectPath, onClose, onRefresh, onOpenExternal, isMobile, initialPaused = false }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(url || '');
  const [isPaused, setIsPaused] = useState(initialPaused);
  const [logs, setLogs] = useState([]);
  const [captureReady, setCaptureReady] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [pausedUrl, setPausedUrl] = useState(initialPaused ? (url || '') : null);
  const [elementSelectionMode, setElementSelectionMode] = useState(false);
  const [selectedElement, setSelectedElement] = useState(null);
  const iframeRef = useRef(null);
  const logsRef = useRef(null);
  const [userEditedUrl, setUserEditedUrl] = useState(false);
  
  useEffect(() => {
    if (!userEditedUrl && !isPaused) {
      setCurrentUrl(url);
      setIsLoading(true);
      setError(null);
      setLogs([]);
    }
  }, [url]);

  // Handle console messages from iframe
  useEffect(() => {
    const handleMessage = (event) => {
      // Validate origin
      try {
        const origin = new URL(event.origin);
        const validHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
        if (!validHosts.includes(origin.hostname)) return;
      } catch {
        return;
      }

      if (event.data?.type === 'console-message') {
        const raw = String(event.data.message || '');
        const low = raw.toLowerCase();
        
        // Filter out development noise
        if (raw.includes('[vite]') || raw.includes('[HMR]') || 
            low.includes('websocket') || low.includes('connecting')) {
          return;
        }
        
        const { level, message, timestamp, url, filename, line, column, stack } = event.data;
        const logEntry = {
          type: level,
          message: message || 'Unknown message',
          timestamp: new Date(timestamp).toLocaleTimeString(),
          url,
          filename,
          line,
          column,
          stack,
          count: 1
        };
        
        setLogs(prev => {
          const lastLog = prev[prev.length - 1];
          if (lastLog && 
              lastLog.message === logEntry.message && 
              lastLog.filename === logEntry.filename && 
              lastLog.line === logEntry.line) {
            const updatedLogs = [...prev];
            updatedLogs[updatedLogs.length - 1] = {
              ...lastLog,
              count: (lastLog.count || 1) + 1,
              timestamp: logEntry.timestamp
            };
            return updatedLogs;
          }
          return [...prev.slice(-99), logEntry];
        });
      }
      
      if (event.data?.type === 'console-capture-ready') {
        setCaptureReady(true);
      }
      
      if (event.data?.type === 'element-selected') {
        setSelectedElement(event.data.data);
        setElementSelectionMode(false);
        if (window.selectedElementContext !== undefined) {
          window.selectedElementContext = event.data.data;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Inject console capture when iframe loads
  useEffect(() => {
    if (!iframeRef.current || isPaused) return;
    
    const injectConsoleCapture = () => {
      try {
        const iframe = iframeRef.current;
        const iframeWindow = iframe.contentWindow;
        const iframeDocument = iframe.contentDocument || iframeWindow?.document;
        
        if (iframeWindow && iframeDocument && !iframeWindow.__consoleInjected) {
          iframeWindow.__consoleInjected = true;
          
          const script = iframeDocument.createElement('script');
          script.textContent = consoleInjectorScript;
          
          const head = iframeDocument.head || iframeDocument.getElementsByTagName('head')[0];
          if (head) {
            head.appendChild(script);
          }
        }
      } catch (e) {
        // Cross-origin restriction - expected
      }
    };

    const iframe = iframeRef.current;
    injectConsoleCapture();
    
    iframe.addEventListener('load', injectConsoleCapture);
    return () => iframe.removeEventListener('load', injectConsoleCapture);
  }, [isPaused, currentUrl]);

  const handleRefresh = () => {
    if (iframeRef.current && !isPaused) {
      setIsLoading(true);
      setError(null);
      setLogs([]);
      
      let urlToLoad = currentUrl;
      if (currentUrl && !currentUrl.startsWith('http')) {
        urlToLoad = 'http://' + currentUrl;
      }
      
      iframeRef.current.src = urlToLoad;
    }
  };
  
  useEffect(() => {
    window.refreshPreview = handleRefresh;
    return () => delete window.refreshPreview;
  }, [currentUrl, isPaused]);

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    if (isPaused && iframeRef.current) {
      let urlToLoad = pausedUrl || currentUrl;
      if (urlToLoad && !urlToLoad.startsWith('http')) {
        urlToLoad = 'http://' + urlToLoad;
      }
      setCurrentUrl(urlToLoad);
      setPausedUrl(null);
      setUserEditedUrl(false);
      setIsLoading(true);
      setError(null);
      setLogs([]);
      iframeRef.current.src = urlToLoad;
    } else if (!isPaused && iframeRef.current) {
      setPausedUrl(currentUrl);
      iframeRef.current.src = 'about:blank';
      setIsLoading(false);
      setError(null);
    }
  };

  const clearLogs = () => setLogs([]);
  
  const copyLogsToClipboard = () => {
    const errorText = logs.map(log => {
      const count = log.count > 1 ? ` (${log.count}×)` : '';
      const location = log.filename ? `\n  File: ${log.filename}:${log.line}:${log.column}` : '';
      const stack = log.stack ? `\n  Stack: ${log.stack}` : '';
      return `ERROR${count}: ${log.message}${location}${stack}`;
    }).join('\n\n');

    if (!errorText) {
      alert('No errors to copy');
      return;
    }

    navigator.clipboard.writeText(errorText).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    });
  };

  // Handle element selection mode
  useEffect(() => {
    if (!elementSelectionMode || !iframeRef.current) return;
    
    const timer = setTimeout(() => {
      if (!iframeRef.current || !elementSelectionMode) return;
      
      try {
        const iframe = iframeRef.current;
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        
        if (iframeDoc) {
          if (iframeDoc.querySelector('#element-selector-script')) return;
          
          const script = iframeDoc.createElement('script');
          script.id = 'element-selector-script';
          script.textContent = `
            (function() {
              document.body.style.cursor = 'crosshair';
              let hoveredElement = null;
              
              const style = document.createElement('style');
              style.id = 'element-selector-highlight-styles';
              style.textContent = \`
                .element-selector-hover {
                  outline: 2px solid #3b82f6 !important;
                  outline-offset: 2px !important;
                  background-color: rgba(59, 130, 246, 0.1) !important;
                  cursor: crosshair !important;
                }
              \`;
              document.head.appendChild(style);
              
              const handleMouseMove = (e) => {
                const element = e.target;
                if (hoveredElement && hoveredElement !== element) {
                  hoveredElement.classList.remove('element-selector-hover');
                }
                if (element && element !== document.body && element !== document.documentElement) {
                  element.classList.add('element-selector-hover');
                  hoveredElement = element;
                }
              };
              
              const handleClick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const element = e.target;
                if (hoveredElement) {
                  hoveredElement.classList.remove('element-selector-hover');
                }
                
                if (window.parent !== window) {
                  window.parent.postMessage({
                    type: 'element-selected',
                    data: {
                      html: element.outerHTML.substring(0, 500),
                      text: element.textContent?.substring(0, 200),
                      tag: element.tagName.toLowerCase(),
                      id: element.id,
                      classes: element.className,
                      path: element.tagName.toLowerCase() + (element.id ? '#' + element.id : ''),
                    }
                  }, '*');
                }
                
                document.body.style.cursor = '';
                document.removeEventListener('click', handleClick, true);
                document.removeEventListener('mousemove', handleMouseMove, true);
                style.remove();
                return false;
              };
              
              document.addEventListener('click', handleClick, true);
              document.addEventListener('mousemove', handleMouseMove, true);
            })();
          `;
          iframeDoc.body.appendChild(script);
        }
      } catch (error) {
        // Cross-origin restriction
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [elementSelectionMode]);

  const handleOpenExternal = () => window.open(currentUrl, '_blank');
  const handleIframeLoad = () => setIsLoading(false);
  const handleIframeError = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setIsLoading(false);
    setError('Unable to load preview. The server might not be running or the URL might be incorrect.');
  };

  const isValidPreviewUrl = (url) => {
    if (!url || url.trim() === '') return true;
    
    try {
      let urlToValidate = url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        urlToValidate = 'http://' + url;
      }
      
      const urlObj = new URL(urlToValidate);
      const hostname = urlObj.hostname;
      
      const validHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
      if (validHosts.includes(hostname)) return true;
      
      if (hostname.startsWith('192.168.') || 
          hostname.startsWith('10.') ||
          hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)) {
        return true;
      }
      
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
          <span className="text-sm font-medium text-foreground">Preview Panel</span>
          <button onClick={onClose} className="p-1.5 hover:bg-accent rounded-md transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
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
    <div className="h-full flex flex-col bg-card rounded-xl border border-border relative">
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-border">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div 
              className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`} 
              title={isPaused ? "Paused" : "Connected"} 
            />
            <input
              type="text"
              value={isPaused && pausedUrl ? pausedUrl : currentUrl}
              onChange={(e) => {
                setUserEditedUrl(true);
                if (isPaused) {
                  setPausedUrl(e.target.value);
                } else {
                  setCurrentUrl(e.target.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (!isPaused) {
                    handleRefresh();
                  } else {
                    handleTogglePause();
                  }
                }
              }}
              className="flex-1 px-2 py-1 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="http://localhost:3000"
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setElementSelectionMode(!elementSelectionMode)}
              className={`p-1.5 rounded-md transition-colors ${
                elementSelectionMode 
                  ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-500/30' 
                  : 'hover:bg-accent'
              }`}
              title={elementSelectionMode ? "Cancel element selection" : "Select element"}
              disabled={isPaused}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>
            
            <button
              onClick={handleTogglePause}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
            
            <button
              onClick={handleRefresh}
              disabled={isPaused}
              className="p-1.5 hover:bg-accent rounded-md transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            <div className="relative" ref={logsRef}>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={`p-1.5 rounded-md transition-colors relative ${
                  logs.filter(l => l.type === 'error').length > 0 
                    ? 'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20' 
                    : 'hover:bg-accent'
                }`}
                title="Console logs"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {logs.filter(l => l.type === 'error').length > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full text-[8px] text-white flex items-center justify-center">
                    {logs.filter(l => l.type === 'error').length}
                  </span>
                )}
              </button>
              
              {showLogs && (
                <div className="absolute right-0 top-full mt-1 w-96 max-h-80 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="p-2 border-b border-border flex items-center justify-between">
                    <span className="text-sm font-medium">Console Output</span>
                    <div className="flex gap-1">
                      <button
                        onClick={copyLogsToClipboard}
                        className="px-2 py-1 text-xs hover:bg-accent rounded transition-colors"
                        data-copy-button
                      >
                        Copy
                      </button>
                      <button
                        onClick={clearLogs}
                        className="px-2 py-1 text-xs hover:bg-accent rounded transition-colors"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <div className="max-h-64 overflow-y-auto p-2 space-y-1">
                    {logs.length === 0 ? (
                      <div className="text-center py-4 text-sm text-muted-foreground">
                        No console output yet
                      </div>
                    ) : (
                      logs.map((log, idx) => (
                        <div
                          key={idx}
                          className={`text-xs p-2 rounded border ${
                            log.type === 'error' 
                              ? 'bg-red-500/10 border-red-500/20 text-red-600 dark:text-red-400' 
                              : 'bg-muted border-border'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <span className="flex-1 font-mono whitespace-pre-wrap break-all">
                              {log.message}
                            </span>
                            {log.count > 1 && (
                              <span className="ml-2 px-1.5 py-0.5 bg-background rounded text-[10px]">
                                {log.count}×
                              </span>
                            )}
                          </div>
                          {log.filename && (
                            <div className="mt-1 text-[10px] text-muted-foreground">
                              {log.filename}:{log.line}:{log.column}
                            </div>
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
              title="Open in browser"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
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
      <div className="flex-1 relative">
        {isLoading && !isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-muted-foreground">Loading preview...</span>
            </div>
          </div>
        )}
        
        {error && !isPaused && (
          <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Preview Error</h3>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          </div>
        )}
        
        {isPaused ? (
          <div className="h-full flex items-center justify-center bg-muted/20">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Preview Paused</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Edit the URL above and press Enter or click play to resume
              </p>
            </div>
          </div>
        ) : (
          <iframe
            ref={iframeRef}
            src={currentUrl}
            className="w-full h-full border-0"
            onLoad={handleIframeLoad}
            onError={handleIframeError}
            title="Preview"
            sandbox={elementSelectionMode ? 
              "allow-same-origin allow-scripts allow-forms allow-popups allow-modals" : 
              undefined
            }
            allow="microphone; camera; geolocation"
          />
        )}
      </div>
      
      {/* Overlay Chat */}
      <OverlayChat
        projectPath={projectPath}
        previewUrl={currentUrl}
        embedded={false}
        disableInlinePanel={false}
      />
    </div>
  );
}

export default PreviewPanelClean;