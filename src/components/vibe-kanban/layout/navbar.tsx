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
    <div className="border-b">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-6">
            <Logo />
            <div className="flex items-center space-x-1">
              <Button
                asChild
                variant={
                  location.pathname === '/vibe-kanban' || location.pathname === '/vibe-kanban/projects' || location.pathname.startsWith('/vibe-kanban/projects/') ? 'default' : 'ghost'
                }
                size="sm"
              >
                <Link to="/vibe-kanban/projects">
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Projects
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
                  <Server className="mr-2 h-4 w-4" />
                  MCP Servers
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
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </Link>
              </Button>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="bg-background hover:bg-muted"
            >
              <a href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar ao Claude Code UI
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
