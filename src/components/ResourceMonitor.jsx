import React, { useState, useEffect, useRef } from 'react';
import { authenticatedFetch } from '../utils/api';

function ResourceMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [systemInfo, setSystemInfo] = useState({
    activePorts: [],
    memoryUsage: 0,
    cpuUsage: 0
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const isMountedRef = useRef(true);

  // Fetch system information
  const fetchSystemInfo = async () => {
    // Double check to prevent race conditions
    if (!isMountedRef.current || !isOpen) {
      console.log('[ResourceMonitor] Skipping fetch - not mounted or closed');
      return;
    }
    
    console.log('[ResourceMonitor] Fetching system info...');
    setIsLoading(true);
    try {
      const response = await authenticatedFetch('/api/system/info');
      
      // Check if response is ok
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      // Parse JSON response
      const data = await response.json();
      
      // Check again after async operation
      if (!isMountedRef.current || !isOpen) {
        console.log('[ResourceMonitor] Discarding data - component unmounted or closed');
        return;
      }
      
      console.log('[ResourceMonitor] Received data:', data);
      const clamp = v => Math.max(0, Math.min(100, Math.round(v)));
      const newSystemInfo = {
        activePorts: data?.activePorts || [],
        memoryUsage: clamp(data?.memoryUsage || 0),
        cpuUsage: clamp(data?.cpuUsage || 0),
        ...data
      };
      console.log('[ResourceMonitor] Setting system info:', newSystemInfo);
      setSystemInfo(newSystemInfo);
      setError(null);
    } catch (error) {
      console.error('[ResourceMonitor] Failed to fetch system info:', error);
      if (isMountedRef.current) {
        setSystemInfo({
          activePorts: [],
          memoryUsage: 0,
          cpuUsage: 0
        });
        setError('Failed to load system info');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // Component lifecycle
  useEffect(() => {
    isMountedRef.current = true;
    
    return () => {
      isMountedRef.current = false;
      // Clean up any existing interval on unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []);

  // Start/stop monitoring when panel opens/closes
  useEffect(() => {
    // Always clear any existing interval first
    if (intervalRef.current) {
      console.log('[ResourceMonitor] Clearing existing interval');
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isOpen) {
      console.log('[ResourceMonitor] Panel opened - starting monitoring...');
      // Fetch immediately
      fetchSystemInfo();
      
      // Poll every 30s to reduce server load (cleared on close)
      intervalRef.current = setInterval(fetchSystemInfo, 30000);
      console.log('[ResourceMonitor] Interval created with ID:', intervalRef.current);
    } else {
      console.log('[ResourceMonitor] Panel closed - stopping monitoring');
    }

    // Cleanup function - ALWAYS runs when component unmounts or isOpen changes
    return () => {
      if (intervalRef.current) {
        console.log('[ResourceMonitor] useEffect cleanup - clearing interval:', intervalRef.current);
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isOpen]); // Only re-run when isOpen changes

  const handlePortAction = async (port, action) => {
    try {
      await authenticatedFetch('/api/system/ports', {
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
        onClick={() => {
          const newState = !isOpen;
          console.log('[ResourceMonitor] Button clicked, setting isOpen to:', newState);
          setIsOpen(newState);
        }}
        className={`
          p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors relative
          ${isOpen ? 'bg-accent text-foreground' : ''}
        `}
        title="System Monitor"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" 
          />
        </svg>
        {/* Port count badge - smaller and positioned absolutely */}
        {systemInfo.activePorts && systemInfo.activePorts.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground w-3.5 h-3.5 rounded-full text-[9px] font-bold flex items-center justify-center">
            {systemInfo.activePorts.length}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-xl z-50 max-h-96 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <h3 className="font-semibold text-sm">System Monitor</h3>
            <button
              onClick={() => {
                console.log('[ResourceMonitor] Close button clicked');
                setIsOpen(false);
              }}
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
              {error && (
                <div className="mb-2 text-xs text-destructive">{error}</div>
              )}
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
                <span className="text-sm font-medium">Active Ports ({systemInfo.activePorts?.length || 0})</span>
                {isLoading && (
                  <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
                )}
              </div>
              
              {systemInfo.activePorts?.length > 0 ? (
                <div className="space-y-2">
                  {systemInfo.activePorts?.map((port, index) => (
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
