import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../ui/button';
import {
  FolderOpen,
  Settings,
  Server,
  ArrowLeft,
} from 'lucide-react';
import { Logo } from '../logo';

export function Navbar() {
  const location = useLocation();

  return (
    <>
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="w-full px-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center space-x-3 sm:space-x-6">
              <Button
                asChild
                variant="outline"
                size="sm"
              >
                <a href="/">
                  <ArrowLeft className="h-4 w-4" />
                  <span className="ml-2">Voltar</span>
                </a>
              </Button>
              <Logo />
              <div className="hidden sm:flex items-center space-x-1">
                <Button
                  asChild
                  variant={
                    location.pathname === '/vibe-kanban' || location.pathname === '/vibe-kanban/projects' || location.pathname.startsWith('/vibe-kanban/projects/') ? 'default' : 'ghost'
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
                    location.pathname === '/vibe-kanban/mcp-servers' ? 'default' : 'ghost'
                  }
                  size="sm"
                >
                  <Link to="/vibe-kanban/mcp-servers">
                    <Server className="h-4 w-4" />
                    <span className="ml-2">MCP Servers</span>
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
                className="text-gray-600 dark:text-gray-400"
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
        <div className="mobile-nav-items hidden sm:hidden border-t border-gray-200 dark:border-gray-700 py-2">
          <div className="space-y-1 px-3">
            <a
              href="/"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar ao Claude Code UI
            </a>
            <Link
              to="/vibe-kanban/projects"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/vibe-kanban' || location.pathname === '/vibe-kanban/projects' || location.pathname.startsWith('/vibe-kanban/projects/')
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              Projects
            </Link>
            <Link
              to="/vibe-kanban/mcp-servers"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/vibe-kanban/mcp-servers'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Server className="h-4 w-4" />
              MCP Servers
            </Link>
            <Link
              to="/vibe-kanban/settings"
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                location.pathname === '/vibe-kanban/settings'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
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
