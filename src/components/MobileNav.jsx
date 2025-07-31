import React from 'react';
import { MessageSquare, Folder, Terminal, GitBranch } from 'lucide-react';
import { MicButton } from './MicButton';

function MobileNav({ activeTab, setActiveTab, isInputFocused, isShellConnected }) {
  const [hasChatText, setHasChatText] = React.useState(false);
  
  // Check if chat has text periodically
  React.useEffect(() => {
    if (activeTab === 'chat') {
      const checkText = () => {
        if (window.hasChatText && typeof window.hasChatText === 'function') {
          const hasText = window.hasChatText();
          setHasChatText(hasText);
        } else {
          // Try again in a moment if function not available yet
          setTimeout(() => {
            if (window.hasChatText && typeof window.hasChatText === 'function') {
              const hasText = window.hasChatText();
              setHasChatText(hasText);
            }
          }, 200);
        }
      };
      
      // Check immediately
      checkText();
      
      // Check periodically
      const interval = setInterval(checkText, 100);
      
      return () => clearInterval(interval);
    } else {
      setHasChatText(false);
    }
  }, [activeTab]);
  
  // Detect dark mode
  const isDarkMode = document.documentElement.classList.contains('dark');
  const navItems = [
    {
      id: 'shell',
      icon: Terminal,
      onClick: () => setActiveTab('shell')
    },
    {
      id: 'chat',
      icon: MessageSquare,
      onClick: () => setActiveTab('chat')
    },
    {
      id: 'files',
      icon: Folder,
      onClick: () => setActiveTab('files')
    },
    {
      id: 'git',
      icon: GitBranch,
      onClick: () => setActiveTab('git')
    }
  ];

  // Handler for voice transcription
  const handleVoiceTranscript = (text) => {
    if (activeTab === 'shell') {
      // Send the transcribed text to the terminal via the global handler
      if (window.sendToActiveTerminal && typeof window.sendToActiveTerminal === 'function') {
        window.sendToActiveTerminal(text);
      } else {
        console.warn('Terminal voice handler not available');
      }
    } else if (activeTab === 'chat') {
      // For chat, we need to set the text in the input
      if (window.setChatInput && typeof window.setChatInput === 'function') {
        window.setChatInput(text);
      }
    }
  };

  return (
    <>
      <div 
        className={`fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 z-40 transform transition-transform duration-300 ease-in-out shadow-lg ${
          isInputFocused ? 'translate-y-full' : 'translate-y-0'
        }`}
        style={{
          paddingBottom: 'env(safe-area-inset-bottom)',
          backgroundColor: isDarkMode ? '#111827' : '#ffffff'
        }}
      >
      <div className="flex items-center justify-around py-2 min-h-[56px]">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={item.onClick}
              onTouchStart={(e) => {
                e.preventDefault();
                item.onClick();
              }}
              className={`flex items-center justify-center p-3 rounded-2xl min-h-[44px] min-w-[44px] relative touch-manipulation ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
              }`}
              aria-label={item.id}
            >
              <Icon className="w-6 h-6" />
              {isActive && (
                <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-6 h-1 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}
        
        {/* Voice button - show when in shell tab OR when in chat tab */}
        {(activeTab === 'shell' || activeTab === 'chat') && (
          <MicButton 
            onTranscript={handleVoiceTranscript}
            className="p-3 rounded-2xl min-h-[44px] min-w-[44px] bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
            isChat={activeTab === 'chat'}
            hasChatText={hasChatText}
          />
        )}
      </div>
    </div>
    </>
  );
}

export default MobileNav;