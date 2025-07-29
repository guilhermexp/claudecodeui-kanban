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
      <div className="flex items-center justify-between bg-gray-900 dark:bg-gray-950 text-white rounded-lg shadow-lg px-4 py-2">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            {/* Animated spinner */}
            <span className="text-xl text-blue-400 animate-spin">
              {spinner}
            </span>
            
            {/* Status text - first line */}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{statusText}...</span>
                {elapsedTime > 0 && (
                  <span className="text-gray-400 text-sm">({elapsedTime}s)</span>
                )}
                {tokens !== null && tokens > 0 && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-300 text-sm hidden sm:inline">⚒ {tokens.toLocaleString()} tokens</span>
                    <span className="text-gray-300 text-sm sm:hidden">⚒ {tokens.toLocaleString()}</span>
                  </>
                )}
                <span className="text-gray-400 hidden sm:inline">·</span>
                <span className="text-gray-300 text-sm hidden sm:inline">esc to interrupt</span>
              </div>
              {/* Second line for mobile */}
              <div className="text-xs text-gray-400 sm:hidden mt-1">
                esc to interrupt
              </div>
            </div>
          </div>
        </div>
        
        {/* Interrupt button */}
        {canInterrupt && onAbort && (
          <button
            onClick={onAbort}
            className="ml-3 text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded-md transition-colors flex items-center gap-1.5 flex-shrink-0"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="hidden sm:inline">Stop</span>
          </button>
        )}
      </div>
    </div>
  );
}

export default ClaudeStatus;