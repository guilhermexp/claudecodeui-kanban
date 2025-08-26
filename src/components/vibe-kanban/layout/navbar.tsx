import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../ui/button';
import {
  FolderOpen,
  Settings,
  ArrowLeft,
  Sun,
  Moon,
} from 'lucide-react';

export function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();

  // Check if dark mode is enabled
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    return document.documentElement.classList.contains('dark');
  });

  // Toggle dark mode
  const toggleDarkMode = () => {
    if (isDarkMode) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setIsDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setIsDarkMode(true);
    }
  };

  // Função para lidar com o botão voltar
  const handleBack = () => {
    // Lógica melhorada de navegação
    const path = location.pathname;
    
    // Se estiver na página inicial do Vibe Kanban (projects), volta para o Claude Code UI
    if (path === '/vibe-kanban' || path === '/vibe-kanban/' || path === '/vibe-kanban/projects') {
      navigate('/');
    } 
    // Se estiver em uma página de tasks/kanban, volta para projects
    else if (path.includes('/vibe-kanban/projects/') && path.includes('/tasks')) {
      // Extrai o projectId e volta para a página do projeto
      const projectIdMatch = path.match(/\/projects\/([^\/]+)/);
      if (projectIdMatch) {
        navigate(`/vibe-kanban/projects/${projectIdMatch[1]}`);
      } else {
        navigate('/vibe-kanban/projects');
      }
    }
    // Se estiver na página de detalhes de um projeto, volta para a lista de projetos
    else if (path.match(/^\/vibe-kanban\/projects\/[^\/]+$/)) {
      navigate('/vibe-kanban/projects');
    }
    // Para outras páginas (settings, mcp-servers), volta para projects
    else if (path === '/vibe-kanban/settings' || path === '/vibe-kanban/mcp-servers') {
      navigate('/vibe-kanban/projects');
    }
    // Caso padrão: usa o histórico do navegador
    else {
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
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleDarkMode}
                className="text-muted-foreground hover:text-foreground"
              >
                {isDarkMode ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
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
        </div>
        {/* Mobile navigation dropdown */}
        <div className="mobile-nav-items hidden sm:hidden border-t border-border py-2">
          <div className="space-y-1 px-3">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent w-full text-left"
            >
              <ArrowLeft className="h-4 w-4" />
              {(() => {
                const path = location.pathname;
                if (path === '/vibe-kanban' || path === '/vibe-kanban/' || path === '/vibe-kanban/projects') {
                  return 'vibeclaude';
                } else if (path.includes('/vibe-kanban/projects/') && path.includes('/tasks')) {
                  return 'Projeto';
                } else if (path.match(/^\/vibe-kanban\/projects\/[^\/]+$/)) {
                  return 'Projetos';
                } else if (path === '/vibe-kanban/settings' || path === '/vibe-kanban/mcp-servers') {
                  return 'Projetos';
                }
                return 'Voltar';
              })()}
            </button>
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
