import React from 'react';
import { Folder, Terminal, GitBranch } from 'lucide-react';
import { MicButton } from './MicButton';

function MobileNav({ activeTab, setActiveTab, isInputFocused, isShellConnected }) {
  const navItems = [
    {
      id: 'shell',
      icon: Terminal,
      onClick: () => setActiveTab('shell')
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
      }
    }
  };

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 transform transition-transform duration-300 ease-in-out ${
        isInputFocused ? 'translate-y-full' : 'translate-y-0'
      }`}
    >
      <div 
        className="flex items-center justify-around"
        style={{
          minHeight: '56px',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)'
        }}>
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
              className={`flex items-center justify-center p-2 rounded-lg min-h-[40px] min-w-[40px] relative touch-manipulation transition-colors ${
                isActive
                  ? 'text-blue-500 bg-blue-500/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              aria-label={item.id}
            >
              <Icon className="w-5 h-5" />
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}
        
        {/* Voice button - show when in shell tab */}
        {activeTab === 'shell' && (
          <MicButton 
            onTranscript={handleVoiceTranscript}
            className="p-2 rounded-lg min-h-[40px] min-w-[40px] bg-accent hover:bg-accent/80 text-accent-foreground transition-colors"
            isChat={false}
            hasChatText={false}
          />
        )}
      </div>
    </div>
  );
}

export default MobileNav;