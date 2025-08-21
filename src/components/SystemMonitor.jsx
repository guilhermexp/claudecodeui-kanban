import React, { useState, useEffect } from 'react';

function SystemMonitor({ className = '' }) {
  const [systemInfo, setSystemInfo] = useState({
    terminals: 0,
    ports: [],
    serverProcesses: [],
    loading: true,
    cpuUsage: 0,
    memoryUsage: 0
  });

  const [isExpanded, setIsExpanded] = useState(false);
  const [killingProcess, setKillingProcess] = useState(null);

  // Kill a process
  const killProcess = async (pid) => {
    setKillingProcess(pid);
    try {
      const response = await fetch('/api/system/kill', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ pid })
      });
      
      if (response.ok) {
        // Refresh system info after killing
        setTimeout(fetchSystemInfo, 500);
      } else {
        const error = await response.json();
        console.error('Failed to kill process:', error.error);
      }
    } catch (error) {
      console.error('Failed to kill process:', error);
    } finally {
      setKillingProcess(null);
    }
  };

  // Fetch system information
  const fetchSystemInfo = async () => {
    try {
      const response = await fetch('/api/system/monitor');
      if (response.ok) {
        const data = await response.json();
        setSystemInfo({
          ...data,
          loading: false
        });
      }
    } catch (error) {
      console.error('Failed to fetch system info:', error);
      setSystemInfo(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchSystemInfo();

    // Update every 5 seconds
    const interval = setInterval(fetchSystemInfo, 5000);

    return () => clearInterval(interval);
  }, []);

  // Determine status color based on resource usage
  const getStatusColor = () => {
    const terminalCount = systemInfo.terminals;
    const portCount = systemInfo.ports.length;
    
    if (terminalCount > 10 || portCount > 15) return 'text-red-500';
    if (terminalCount > 5 || portCount > 10) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getMemoryColor = () => {
    if (systemInfo.memoryUsage > 80) return 'text-red-500';
    if (systemInfo.memoryUsage > 60) return 'text-yellow-500';
    return 'text-green-500';
  };

  if (systemInfo.loading) {
    return (
      <div className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
        <div className="animate-pulse">
          <span className="opacity-50">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Compact View */}
      <div 
        className={`flex items-center gap-3 text-xs cursor-pointer hover:bg-accent/50 rounded px-2 py-1 transition-colors ${className}`}
        onClick={() => setIsExpanded(!isExpanded)}
        title="Click to expand system monitor"
      >
        {/* Terminal Count */}
        <div className={`flex items-center gap-1 ${getStatusColor()}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-mono font-semibold">{systemInfo.terminals}</span>
        </div>

        {/* Port Count */}
        <div className={`flex items-center gap-1 ${getStatusColor()}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <span className="font-mono font-semibold">{systemInfo.ports.length}</span>
        </div>

        {/* Memory Usage */}
        <div className={`flex items-center gap-1 ${getMemoryColor()}`}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <span className="font-mono font-semibold">{systemInfo.memoryUsage}%</span>
        </div>

        {/* Expand/Collapse Icon */}
        <svg 
          className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded View */}
      {isExpanded && (
        <div className="absolute top-full right-0 mt-1 w-96 max-w-[90vw] bg-card border border-border rounded-lg shadow-lg p-4 z-50">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center justify-between">
              System Monitor
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsExpanded(false);
                }}
                className="p-1 hover:bg-accent rounded"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </h3>

            {/* Active Terminals */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Active Terminals ({systemInfo.terminals})</div>
              {systemInfo.terminals > 0 ? (
                <div className="text-xs font-mono bg-muted/50 rounded p-2 max-h-32 overflow-auto">
                  {systemInfo.serverProcesses.map((proc, idx) => (
                    <div key={idx} className="flex items-center justify-between group hover:bg-muted/70 p-1 rounded">
                      <span className="flex-1 min-w-0 pr-2 text-xs">
                        <span className="font-bold">PID {proc.pid}:</span>
                        <span className="ml-1 text-muted-foreground break-words">{proc.command}</span>
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          killProcess(proc.pid);
                        }}
                        disabled={killingProcess === proc.pid}
                        className="ml-2 p-1 hover:bg-red-500/20 rounded transition-colors"
                        title={`Kill process ${proc.pid}`}
                      >
                        {killingProcess === proc.pid ? (
                          <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">No active terminals</div>
              )}
            </div>

            {/* Active Ports */}
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Active Ports ({systemInfo.ports.length})</div>
              {systemInfo.ports.length > 0 ? (
                <div className="text-xs font-mono bg-muted/50 rounded p-2 max-h-32 overflow-auto">
                  {systemInfo.ports.map((port, idx) => (
                    <div key={idx} className="flex items-center justify-between group hover:bg-muted/70 p-1 rounded">
                      <span className="font-bold min-w-[80px]">:{port.port}</span>
                      <span className="text-muted-foreground flex-1 mx-2">{port.process}</span>
                      <div className="flex items-center gap-1 ml-auto">
                        {/* Open in browser button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`http://localhost:${port.port}`, '_blank');
                          }}
                          className="p-1 hover:bg-blue-500/20 rounded transition-colors"
                          title={`Open localhost:${port.port} in browser`}
                        >
                          <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </button>
                        {/* Kill button */}
                        {port.pid && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              killProcess(port.pid);
                            }}
                            disabled={killingProcess === port.pid}
                            className="p-1 hover:bg-red-500/20 rounded transition-colors"
                            title={`Kill process ${port.pid} on port ${port.port}`}
                          >
                            {killingProcess === port.pid ? (
                              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                            ) : (
                              <svg className="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground italic">No active ports</div>
              )}
            </div>

            {/* System Resources */}
            <div className="space-y-2 pt-2 border-t border-border">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Memory Usage</span>
                <span className={`font-mono ${getMemoryColor()}`}>{systemInfo.memoryUsage}%</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">CPU Usage</span>
                <span className="font-mono">{systemInfo.cpuUsage}%</span>
              </div>
            </div>

            {/* Warning */}
            {(systemInfo.terminals > 5 || systemInfo.ports.length > 10) && (
              <div className="text-xs text-yellow-500 bg-yellow-500/10 rounded p-2">
                ⚠️ High resource usage detected. Consider closing unused terminals.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default React.memo(SystemMonitor);