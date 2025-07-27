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
          setHasChatText(window.hasChatText());
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
      <style>
        {`
          .mobile-nav-container {
            background-color: ${isDarkMode ? '#1f2937' : '#ffffff'} !important;
          }
          .mobile-nav-container:hover {
            background-color: ${isDarkMode ? '#1f2937' : '#ffffff'} !important;
          }
        `}
      </style>
      <div 
        className={`mobile-nav-container fixed bottom-0 left-0 right-0 border-t border-gray-200 dark:border-gray-700 z-50 ios-bottom-safe transform transition-transform duration-300 ease-in-out shadow-lg ${
          isInputFocused ? 'translate-y-full' : 'translate-y-0'
        }`}
      >
      <div className="flex items-center justify-around py-1">
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
              className={`flex items-center justify-center p-2 rounded-lg min-h-[40px] min-w-[40px] relative touch-manipulation ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
              aria-label={item.id}
            >
              <Icon className="w-5 h-5" />
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-6 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
              )}
            </button>
          );
        })}
        
        {/* Voice button - show when shell is connected OR when in chat tab */}
        {((activeTab === 'shell' && isShellConnected) || activeTab === 'chat') && (
          <div className="relative">
            <MicButton 
              onTranscript={handleVoiceTranscript}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              isChat={activeTab === 'chat'}
              hasChatText={hasChatText}
            />
          </div>
        )}
      </div>
    </div>
    </>
  );
}

export default MobileNav;