import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import {
  FolderOpen,
  Settings,
  ArrowLeft,
  MessageSquare,
} from 'lucide-react';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Função para lidar com o botão voltar
  const handleBack = () => {
    // Se estiver na página de chat do Vibe Kanban, volta para o Claude Code UI
    if (location.pathname === '/vibe-kanban' || location.pathname === '/vibe-kanban/chat' || location.pathname === '/vibe-kanban/') {
      navigate('/');
    } else {
      // Caso contrário, usa o histórico do navegador para voltar
      navigate(-1);
    }
  };

  return (
    <>
      <div className="bg-card border-b border-border">
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-3 sm:space-x-6">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBack}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="ml-2">Voltar</span>
              </Button>
              <div className="hidden sm:flex items-center space-x-1">
                <Button
                  asChild
                  variant={
                    location.pathname === '/vibe-kanban' || location.pathname === '/vibe-kanban/chat' ? 'default' : 'ghost'
                  }
                  size="sm"
                >
                  <Link to="/vibe-kanban/chat">
                    <MessageSquare className="h-4 w-4" />
                    <span className="ml-2">Chat</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant={
                    location.pathname === '/vibe-kanban/projects' || location.pathname.startsWith('/vibe-kanban/projects/') ? 'default' : 'ghost'
                  }
                  size="sm"
                >
                  <Link to="/vibe-kanban/projects">
                    <FolderOpen className="h-4 w-4" />
                    <span className="ml-2">Projects</span>
                  </Link>
                </Button>
                <Button
                  asChild
                  variant={
                    location.pathname === '/vibe-kanban/settings' ? 'default' : 'ghost'
                  }
                  size="sm"
                >
                  <Link to="/vibe-kanban/settings">
                    <Settings className="h-4 w-4" />
                    <span className="ml-2">Settings</span>
                  </Link>
                </Button>
              </div>
            </div>
          {/* Mobile menu button */}
          <div className="sm:hidden">
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground"
                onClick={() => {
                  const nav = document.querySelector('.mobile-nav-items');
                  nav?.classList.toggle('hidden');
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </Button>
            </div>
          </div>
        </div>
        {/* Mobile navigation dropdown */}
        <div className="mobile-nav-items hidden sm:hidden border-t border-border py-2">
          <div className="space-y-1 px-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent w-full text-left"
            >
              <ArrowLeft className="h-4 w-4" />
              {location.pathname === '/vibe-kanban' || location.pathname === '/vibe-kanban/chat' || location.pathname === '/vibe-kanban/'
                ? 'Voltar ao Claude Code UI' 
                : 'Voltar'}
            </button>
            <Link
              to="/vibe-kanban/chat"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/vibe-kanban' || location.pathname === '/vibe-kanban/chat'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              Chat
            </Link>
            <Link
              to="/vibe-kanban/projects"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/vibe-kanban/projects' || location.pathname.startsWith('/vibe-kanban/projects/')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              Projects
            </Link>
            <Link
              to="/vibe-kanban/settings"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/vibe-kanban/settings'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
