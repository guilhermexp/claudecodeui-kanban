import React from 'react';

/**
 * Shell Tabs Component
 * Displays tabs for all connected shell sessions
 */
function ShellTabs({ sessions, activeSessionKey, onSwitchTerminal, onCloseTerminal }) {
  if (sessions.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 overflow-x-auto scrollbar-hide">
      {sessions.map((session) => {
        const isActive = session.key === activeSessionKey;
        
        return (
          <button
            key={session.key}
            onClick={() => onSwitchTerminal(session.key)}
            className={`px-3 py-1.5 text-sm border-r border-gray-200 dark:border-gray-700 transition-colors min-w-[140px] flex-shrink-0 ${
              isActive 
                ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white' 
                : 'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                session.isConnected ? 'bg-green-500' : 'bg-gray-500'
              }`} />
              <span className="flex flex-col items-start truncate max-w-[180px]">
                <span className="text-[10px] leading-tight text-gray-500 dark:text-gray-400 truncate w-full">
                  {session.projectDisplayName}
                </span>
                <span className="text-xs leading-tight font-medium truncate w-full">
                  {session.sessionSummary}
                </span>
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTerminal(session.key);
                }}
                className="ml-auto text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer p-1"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    onCloseTerminal(session.key);
                  }
                }}
                aria-label="Close terminal"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default ShellTabs;