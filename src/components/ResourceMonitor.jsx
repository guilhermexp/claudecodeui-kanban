import React, { useState, useEffect, useRef } from 'react';

function ResourceMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [systemInfo, setSystemInfo] = useState({
    activePorts: [],
    memoryUsage: 0,
    cpuUsage: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef(null);

  // Fetch system information
  const fetchSystemInfo = async () => {
    if (!isOpen) return;
    
    setIsLoading(true);
    try {
      const response = await fetch('/api/system/info');
      if (response.ok) {
        const data = await response.json();
        setSystemInfo(data);
      }
    } catch (error) {
      console.error('Failed to fetch system info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Start/stop monitoring when panel opens/closes
  useEffect(() => {
    if (isOpen) {
      // Fetch immediately
      fetchSystemInfo();
      // Then every 2 seconds
      intervalRef.current = setInterval(fetchSystemInfo, 2000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isOpen]);

  const handlePortAction = async (port, action) => {
    try {
      await fetch('/api/system/ports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ port, action })
      });
      // Refresh after action
      setTimeout(fetchSystemInfo, 500);
    } catch (error) {
      console.error('Port action failed:', error);
    }
  };

  const getMemoryColor = () => {
    if (systemInfo.memoryUsage >= 90) return 'text-destructive';
    if (systemInfo.memoryUsage >= 70) return 'text-warning';
    return 'text-success';
  };

  const getCpuColor = () => {
    if (systemInfo.cpuUsage >= 80) return 'text-destructive';
    if (systemInfo.cpuUsage >= 60) return 'text-warning';
    return 'text-success';
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all duration-200 ${
          isOpen
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground hover:text-foreground hover:bg-accent'
        }`}
        title="System Monitor"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
          />
        </svg>
        <span className="hidden sm:inline">System</span>
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="font-semibold text-sm">System Monitor</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-md hover:bg-accent transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {/* System Stats */}
            <div className="p-3 border-b border-border">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-muted-foreground">Memory Usage</span>
                <span className={`text-sm font-medium ${getMemoryColor()}`}>
                  {systemInfo.memoryUsage}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">CPU Usage</span>
                <span className={`text-sm font-medium ${getCpuColor()}`}>
                  {systemInfo.cpuUsage}%
                </span>
              </div>
            </div>

            {/* High Resource Usage Warning */}
            {(systemInfo.memoryUsage >= 85 || systemInfo.cpuUsage >= 80) && (
              <div className="p-3 border-b border-border">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5C2.962 18.333 3.924 20 5.464 20z" 
                    />
                  </svg>
                  <span className="text-sm font-medium">
                    High resource usage detected. Consider closing unused terminals.
                  </span>
                </div>
              </div>
            )}

            {/* Active Ports */}
            <div className="p-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Active Ports ({systemInfo.activePorts.length})</span>
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
                )}
              </div>
              
              {systemInfo.activePorts.length > 0 ? (
                <div className="space-y-2">
                  {systemInfo.activePorts.map((port, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium">:{port.port}</span>
                        <span className="text-muted-foreground">{port.process || 'node'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {port.url && (
                          <button
                            onClick={() => window.open(port.url, '_blank')}
                            className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-primary rounded transition-colors"
                            title="Open in browser"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
                              />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => handlePortAction(port.port, 'kill')}
                          className="w-6 h-6 flex items-center justify-center text-muted-foreground hover:text-destructive rounded transition-colors"
                          title="Kill process"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-muted-foreground text-sm">
                  No active ports detected
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ResourceMonitor;