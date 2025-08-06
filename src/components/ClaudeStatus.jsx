import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';

function ClaudeStatus({ status, onAbort, isLoading }) {
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Update elapsed time every second
  useEffect(() => {
    if (!isLoading) {
      setElapsedTime(0);
      return;
    }
    
    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setElapsedTime(elapsed);
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isLoading]);
  
  if (!isLoading) return null;
  
  // Parse status data - use real data when available
  const statusText = status?.text || 'Working';
  const tokens = status?.tokens || null;
  const canInterrupt = status?.can_interrupt !== false;
  
  // Single spinner character with CSS animation
  const spinner = '✻';
  
  return (
    <div className="flex-1 animate-in slide-in-from-left duration-300">
      <div className="flex items-center justify-between bg-gray-900 dark:bg-gray-950 text-white rounded-lg shadow-lg px-3 py-1.5">
        <div className="flex items-center gap-2 flex-1">
          {/* Animated spinner */}
          <span className="text-base text-blue-400 animate-spin">
            {spinner}
          </span>
          
          {/* Status text - compact version */}
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{statusText}...</span>
            {elapsedTime > 0 && (
              <span className="text-muted-foreground">({elapsedTime}s)</span>
            )}
            {tokens !== null && tokens > 0 && (
              <>
                <span className="text-muted-foreground hidden sm:inline">·</span>
                <span className="text-gray-300 hidden sm:inline">{tokens.toLocaleString()}</span>
              </>
            )}
          </div>
        </div>
        
        {/* Interrupt button */}
        {canInterrupt && onAbort && (
          <button
            onClick={onAbort}
            className="ml-2 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-md transition-colors flex-shrink-0"
            title="Stop"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default ClaudeStatus;