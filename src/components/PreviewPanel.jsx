import React, { useState, useRef, useEffect } from 'react';

function PreviewPanel({ url, onClose, onRefresh, onOpenExternal, isMobile }) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUrl, setCurrentUrl] = useState(url);
  const iframeRef = useRef(null);

  useEffect(() => {
    setCurrentUrl(url);
    setIsLoading(true);
    setError(null);
  }, [url]);

  // Isolate iframe errors from affecting the parent application
  useEffect(() => {
    const handleGlobalError = (event) => {
      // Check if error originated from iframe
      if (event.filename && event.filename.includes('localhost')) {
        // Prevent the error from affecting parent app
        event.preventDefault();
        event.stopPropagation();
        console.warn('Preview iframe error isolated:', event.message);
        return false;
      }
    };

    // Add global error handler to isolate iframe errors
    window.addEventListener('error', handleGlobalError, true);

    return () => {
      window.removeEventListener('error', handleGlobalError, true);
    };
  }, []);

  const handleRefresh = () => {
    if (iframeRef.current) {
      setIsLoading(true);
      setError(null);
      iframeRef.current.src = currentUrl;
    }
  };

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
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Connected" />
            <input
              type="text"
              value={currentUrl}
              onChange={(e) => setCurrentUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleRefresh();
                }
              }}
              className="flex-1 px-2 py-1 text-sm bg-muted rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="http://localhost:3000"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className="p-1.5 hover:bg-accent rounded-md transition-colors"
              title="Refresh preview"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
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
        {isLoading && (
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

        {error && (
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
          src={currentUrl}
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          title="Preview"
          loading="lazy"
        />
      </div>
    </div>
  );
}

export default React.memo(PreviewPanel);