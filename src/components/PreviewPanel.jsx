import React, { useState, useRef, useEffect } from 'react';

function PreviewPanel({ url, onClose, onRefresh, onOpenExternal, isMobile }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(url);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showLogs, setShowLogs] = useState(false);
  const [pausedUrl, setPausedUrl] = useState(null); // Store URL when paused
  const iframeRef = useRef(null);
  const logsRef = useRef(null);

  useEffect(() => {
    // When paused, don't update the current URL or reload
    if (!isPaused) {
      setCurrentUrl(url);
      setIsLoading(true);
      setError(null);
    }
    // If paused, just update the stored URL for when we resume
    else {
      setPausedUrl(url);
    }
  }, [url, isPaused]);

  // Handle console messages from iframe via postMessage
  useEffect(() => {
    const handleMessage = (event) => {
      // Validate origin is localhost
      try {
        const origin = new URL(event.origin);
        const validHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
        if (!validHosts.includes(origin.hostname)) {
          return;
        }
      } catch {
        return;
      }

      // Handle console messages from iframe
      if (event.data && event.data.type === 'console-message') {
        const { level, message, timestamp, url, filename, line, column, stack } = event.data;
        
        const logEntry = {
          type: level,
          message: message || 'Unknown message',
          timestamp: new Date(timestamp).toLocaleTimeString(),
          url: url,
          filename: filename,
          line: line,
          column: column,
          stack: stack
        };
        
        setLogs(prev => [...prev.slice(-99), logEntry]); // Keep last 100 logs
      }
      
      // Handle console capture ready notification
      if (event.data && event.data.type === 'console-capture-ready') {
        console.log('Console capture initialized for preview');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Inject console capture script when iframe loads
  useEffect(() => {
    const injectConsoleCapture = () => {
      if (iframeRef.current && !isPaused) {
        try {
          // Try to inject the script into the iframe
          const iframe = iframeRef.current;
          
          // Function to perform the actual injection
          const performInjection = () => {
            try {
              // Try to access iframe content window
              const iframeWindow = iframe.contentWindow;
              const iframeDocument = iframe.contentDocument || (iframeWindow && iframeWindow.document);
              
              if (iframeWindow && iframeDocument) {
                // Check if already injected
                if (iframeWindow.__consoleInjected) return;
                iframeWindow.__consoleInjected = true;

                // Create and inject script
                const script = iframeDocument.createElement('script');
                script.src = '/preview-console-injector.js';
                script.async = false;
                
                // Also inject inline as fallback
                const inlineScript = iframeWindow.document.createElement('script');
                inlineScript.textContent = `
                  (function() {
                    const originalConsole = {
                      log: console.log,
                      error: console.error,
                      warn: console.warn,
                      info: console.info,
                      debug: console.debug
                    };
                    
                    function safeStringify(obj) {
                      try {
                        const seen = new WeakSet();
                        return JSON.stringify(obj, function(key, value) {
                          if (typeof value === 'object' && value !== null) {
                            if (seen.has(value)) return '[Circular]';
                            seen.add(value);
                          }
                          if (value instanceof Error) {
                            return { message: value.message, stack: value.stack, name: value.name };
                          }
                          return value;
                        });
                      } catch (e) {
                        return String(obj);
                      }
                    }
                    
                    ['log', 'error', 'warn', 'info', 'debug'].forEach(method => {
                      console[method] = function(...args) {
                        originalConsole[method].apply(console, args);
                        try {
                          const message = args.map(arg => {
                            if (typeof arg === 'object') return safeStringify(arg);
                            return String(arg);
                          }).join(' ');
                          
                          window.parent.postMessage({
                            type: 'console-message',
                            level: method,
                            message: message,
                            timestamp: new Date().toISOString(),
                            url: window.location.href
                          }, '*');
                        } catch (e) {}
                      };
                    });
                    
                    window.addEventListener('error', function(event) {
                      try {
                        window.parent.postMessage({
                          type: 'console-message',
                          level: 'error',
                          message: event.message || 'Unknown error',
                          timestamp: new Date().toISOString(),
                          url: window.location.href,
                          filename: event.filename,
                          line: event.lineno,
                          column: event.colno,
                          stack: event.error?.stack
                        }, '*');
                      } catch (e) {}
                    });
                    
                    window.addEventListener('unhandledrejection', function(event) {
                      try {
                        window.parent.postMessage({
                          type: 'console-message',
                          level: 'error',
                          message: 'Unhandled Promise Rejection: ' + (event.reason?.message || event.reason || 'Unknown'),
                          timestamp: new Date().toISOString(),
                          url: window.location.href,
                          stack: event.reason?.stack
                        }, '*');
                      } catch (e) {}
                    });
                    
                    // Test that the injection worked
                    console.log('[Console Capture] Initialized at ' + new Date().toISOString());
                    
                    // Notify parent that we're ready
                    window.parent.postMessage({
                      type: 'console-capture-ready',
                      timestamp: new Date().toISOString()
                    }, '*');
                    
                    // Also capture React errors
                    if (window.React && window.React.createElement) {
                      const originalCreateElement = window.React.createElement;
                      window.React.createElement = function(...args) {
                        try {
                          return originalCreateElement.apply(this, args);
                        } catch (error) {
                          console.error('React Error:', error);
                          throw error;
                        }
                      };
                    }
                  })();
                `;
                
                // Try to inject in both head and body
                const head = iframeDocument.head || iframeDocument.getElementsByTagName('head')[0];
                const body = iframeDocument.body || iframeDocument.getElementsByTagName('body')[0];
                
                // Inject inline script first (more reliable)
                if (head) {
                  head.appendChild(inlineScript);
                } else if (body) {
                  body.appendChild(inlineScript);
                }
                
                // Then inject external script
                if (head) {
                  head.appendChild(script);
                }
                
                console.log('Console capture injected successfully');
              }
            } catch (e) {
              // Cross-origin restriction, can't inject script
              console.log('Cannot inject console capture script:', e.message);
            }
          };

          // Try to inject immediately
          performInjection();
          
          // Also try after a short delay
          setTimeout(performInjection, 100);
          
          // And after a longer delay for slow-loading content
          setTimeout(performInjection, 500);
          
        } catch (e) {
          console.warn('Failed to setup console capture:', e);
        }
      }
    };

    if (iframeRef.current && !isPaused) {
      const iframe = iframeRef.current;
      
      // Try to inject immediately if iframe already has content
      injectConsoleCapture();
      
      // Also inject on load event
      iframe.addEventListener('load', injectConsoleCapture);
      
      // And monitor for dynamic content changes
      const observer = new MutationObserver(() => {
        injectConsoleCapture();
      });
      
      if (iframe.contentDocument) {
        observer.observe(iframe.contentDocument, {
          childList: true,
          subtree: true
        });
      }
      
      return () => {
        iframe.removeEventListener('load', injectConsoleCapture);
        observer.disconnect();
      };
    }
  }, [isPaused, currentUrl]);

  const handleRefresh = () => {
    if (iframeRef.current && !isPaused) {
      setIsLoading(true);
      setError(null);
      // Load URL directly for full functionality
      iframeRef.current.src = currentUrl;
    }
  };
  
  // Expose refresh function to global scope for MainContent
  useEffect(() => {
    window.refreshPreview = handleRefresh;
    return () => {
      delete window.refreshPreview;
    };
  }, [currentUrl, isPaused]);

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
    if (isPaused && iframeRef.current) {
      // Resume - use the latest URL if it changed while paused
      const urlToLoad = pausedUrl || currentUrl;
      setCurrentUrl(urlToLoad);
      setPausedUrl(null);
      setIsLoading(true);
      setError(null);
      iframeRef.current.src = urlToLoad;
    } else if (!isPaused && iframeRef.current) {
      // Pause - clear the iframe and store current URL
      setPausedUrl(currentUrl);
      iframeRef.current.src = 'about:blank';
      setIsLoading(false);
      setError(null);
    }
  };

  const clearLogs = () => {
    setLogs([]);
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

  const handleOpenExternal = () => {
    window.open(currentUrl, '_blank');
  };

  const handleIframeLoad = () => {
    setIsLoading(false);
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

  // Validate URL to ensure it's a localhost URL
  const isValidPreviewUrl = (url) => {
    try {
      const urlObj = new URL(url);
      const validHosts = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]'];
      return validHosts.includes(urlObj.hostname);
    } catch {
      return false;
    }
  };

  if (!isValidPreviewUrl(currentUrl)) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card">
          <div className="flex items-center gap-2">
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
              Only localhost URLs can be previewed for security reasons.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-card rounded-xl border border-border">
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {/* URL Display */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div 
              className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-green-500 animate-pulse'}`} 
              title={isPaused ? "Paused" : "Connected"} 
            />
            <input
              type="text"
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isPaused) {
                  handleRefresh();
                }
              }}
              className="flex-1 px-2 py-1 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="http://localhost:3000"
              disabled={isPaused}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleTogglePause}
              className={`p-1.5 rounded-md transition-colors ${isPaused ? 'bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 dark:text-yellow-400' : 'hover:bg-accent'}`}
              title={isPaused ? "Resume preview" : "Pause preview (disconnect)"}
            >
              {isPaused ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </button>
            <button
              onClick={handleRefresh}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              title="Refresh preview"
              disabled={isPaused}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            {/* Logs Button with Dropdown */}
            <div className="relative" ref={logsRef}>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className={`p-1.5 hover:bg-accent rounded-md transition-colors relative ${logs.length > 0 ? 'text-red-500' : ''}`}
                title={`Console logs (${logs.length})`}
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
              
              {/* Logs Dropdown */}
              {showLogs && (
                <div className="absolute right-0 mt-2 w-96 max-h-96 bg-card border border-border rounded-lg shadow-lg overflow-hidden z-50">
                  <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/50">
                    <span className="text-sm font-medium">Console Logs ({logs.length})</span>
                    <button
                      onClick={clearLogs}
                      className="text-xs px-2 py-1 hover:bg-accent rounded transition-colors"
                    >
                      Clear
                    </button>
                  </div>
                  <div className="overflow-y-auto max-h-80 p-2 space-y-1">
                    {logs.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        No logs captured yet
                      </div>
                    ) : (
                      logs.map((log, index) => (
                        <div
                          key={index}
                          className={`p-2 rounded text-xs font-mono ${
                            log.type === 'error'
                              ? 'bg-red-500/10 border border-red-500/20 text-red-400'
                              : log.type === 'warn'
                              ? 'bg-yellow-500/10 border border-yellow-500/20 text-yellow-400'
                              : log.type === 'info'
                              ? 'bg-blue-500/10 border border-blue-500/20 text-blue-400'
                              : log.type === 'debug'
                              ? 'bg-gray-500/10 border border-gray-500/20 text-gray-400'
                              : 'bg-accent/50 border border-border text-foreground'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-muted-foreground">[{log.timestamp}]</span>
                            <span className="uppercase text-xs font-semibold">
                              {log.type === 'log' ? 'LOG' : log.type.toUpperCase()}
                            </span>
                          </div>
                          <div className="mt-1 break-all whitespace-pre-wrap">{log.message}</div>
                          {log.filename && (
                            <div className="mt-1 text-muted-foreground text-xs opacity-75">
                              {log.filename}:{log.line}:{log.column}
                            </div>
                          )}
                          {log.stack && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-muted-foreground text-xs hover:text-foreground">
                                Stack trace
                              </summary>
                              <pre className="mt-1 text-xs opacity-75 overflow-x-auto">{log.stack}</pre>
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
        {isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500/10 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Preview Paused</h3>
              <p className="text-sm text-muted-foreground mb-4">Click the play button to resume preview</p>
              <button
                onClick={handleTogglePause}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Resume Preview
              </button>
            </div>
          </div>
        )}

        {isLoading && !isPaused && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/50 backdrop-blur-sm z-10">
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

        <iframe
          ref={iframeRef}
          src={isPaused ? 'about:blank' : currentUrl}
          className="w-full h-full border-0"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title="Preview"
          loading="lazy"
          data-preview-frame="true"
        />
      </div>
    </div>
  );
}

export default React.memo(PreviewPanel);