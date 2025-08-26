import { Folder, Terminal, GitBranch, CheckSquare } from 'lucide-react';

function MobileNav({ activeTab, setActiveTab, isInputFocused, isShellConnected, shellHasActiveSession }) {
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
    },
    {
      id: 'tasks',
      icon: CheckSquare,
      onClick: () => setActiveTab('tasks')
    }
  ];


  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40 transform transition-transform duration-300 ease-in-out ${
        isInputFocused ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{
        // Ensure the bar background covers the iOS home indicator area in PWA
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        paddingLeft: 'env(safe-area-inset-left, 0px)',
        paddingRight: 'env(safe-area-inset-right, 0px)'
      }}
    >
      <div 
        className="flex items-center justify-around"
        style={{
          minHeight: '56px'
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
              className={`flex items-center justify-center p-2 rounded-lg min-h-[44px] min-w-[44px] relative touch-manipulation transition-colors ${
                isActive
                  ? 'text-primary bg-primary/10'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              aria-label={item.id}
            >
              <Icon className="w-5 h-5" />
              {/* Show active session indicator for Shell */}
              {item.id === 'shell' && shellHasActiveSession && activeTab !== 'shell' && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse border border-background" />
              )}
              {isActive && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default MobileNav;