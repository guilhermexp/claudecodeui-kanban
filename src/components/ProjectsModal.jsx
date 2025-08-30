import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Folder, Plus, MessageSquare, Clock, ChevronDown, ChevronRight, ChevronUp, Edit3, Check, X, Trash2, FolderPlus, RefreshCw, Search, Star, Edit2, Loader2, FolderSearch, Filter, Eye } from 'lucide-react';
import { ProjectIcon, isVibeKanbanProject as isVibeKanban } from '../utils/projectIcons.jsx';
import { cn } from '../lib/utils';
import ClaudeLogo from './ClaudeLogo';
import { api } from '../utils/api';
import { formatTimeAgo } from '../utils/time';
import { FolderPicker } from './vibe-kanban/ui/folder-picker';

function ProjectsModal({ 
  isOpen,
  onClose,
  projects, 
  selectedProject, 
  selectedSession, 
  onProjectSelect, 
  onSessionSelect, 
  onNewSession,
  onSessionDelete,
  onProjectDelete,
  isLoading,
  onRefresh
}) {
  const navigate = useNavigate();
  const [editingProject, setEditingProject] = useState(null);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [projectSortOrder, setProjectSortOrder] = useState('recent');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');

  // Time update interval
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => clearInterval(interval);
  }, []);


  const handleProjectClick = async (project) => {
    // Select the project and navigate to it
    onProjectSelect(project);
    
    // Auto-select most recent session if available
    if (project.sessions && project.sessions.length > 0) {
      const mostRecentSession = project.sessions[0];
      onSessionSelect(mostRecentSession);
    } else {
      onSessionSelect(null);
    }

    // Close modal after selection
    onClose();
  };



  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Filter and sort projects
  const filteredProjects = projects.filter(project => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        project.name.toLowerCase().includes(query) ||
        project.path.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Type filter
    if (projectFilter === 'vibe-kanban' && !isVibeKanban(project)) return false;
    if (projectFilter === 'regular' && isVibeKanban(project)) return false;

    return true;
  });

  // Sort projects - newest first by default
  const sortedProjects = [...filteredProjects].sort((a, b) => {
    switch (projectSortOrder) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'recent':
        const aTime = a.sessions?.[0]?.updated_at || a.created_at || 0;
        const bTime = b.sessions?.[0]?.updated_at || b.created_at || 0;
        return new Date(bTime) - new Date(aTime);
      case 'starred':
        const aStarred = a.starred ? 1 : 0;
        const bStarred = b.starred ? 1 : 0;
        if (aStarred !== bStarred) return bStarred - aStarred;
        return a.name.localeCompare(b.name);
      default:
        return 0;
    }
  });

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[85vh] p-0 bg-card border border-border" onOpenChange={onClose}>
        <DialogHeader className="px-5 pr-10 pt-4 pb-3 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">Select Project</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">Choose from your recent projects</p>
            </div>
            <div className="flex items-center gap-2 mr-4">
              <Button variant="ghost" size="sm" onClick={() => setShowFolderPicker(true)} className="h-8 text-muted-foreground hover:text-foreground hover:bg-accent">
                <FolderPlus className="w-4 h-4 mr-1" /> Browse
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="mt-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 bg-[#1a1a1a] border-[#2a2a2a] text-white rounded-lg focus:border-[#3a3a3a] focus:ring-1 focus:ring-[#3a3a3a]"
              />
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[70vh] bg-card">
          <div className="p-5">
          {/* Projects List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#666]" />
            </div>
          ) : sortedProjects.length === 0 ? (
            <div className="text-center py-8 text-[#666]">
              {searchQuery || projectFilter !== 'all' 
                ? 'No projects match your filters' 
                : 'No projects yet. Click "New Project" to create one.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedProjects.map((project, index) => {
                const projectSessions = project.sessions || [];
                const latestSession = projectSessions[0]; // Pega apenas a última sessão
                const totalSessions = project.sessionMeta?.total || projectSessions.length; // Usa o total real se disponível

                return (
                  <div 
                    key={project.name || `project-${index}`} 
                    className={cn(
                      "relative group rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-colors flex flex-col",
                      selectedProject?.name === project.name && "ring-1 ring-border"
                    )}
                  >
                    {/* Card Content */}
                    <div
                      className="p-4 cursor-pointer flex-1"
                      onClick={() => handleProjectClick(project)}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <ProjectIcon project={project} className="w-4 h-4 flex-shrink-0 text-foreground/70 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-foreground leading-tight">
                            {(() => {
                              const pathSegments = project.path.split('/').filter(seg => seg);
                              const lastTwo = pathSegments.slice(-2).join('/');
                              return lastTwo || project.name;
                            })()}
                          </h3>
                          <div className="text-[10px] text-muted-foreground mt-1 truncate" title={project.path}>{project.path}</div>
                        </div>
                      </div>

                      {/* Minimal meta: last activity only */}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {latestSession ? `Updated ${formatTimeAgo(latestSession.updated_at, currentTime)}` : 'No sessions yet'}
                      </div>
                    </div>

                    {/* Bottom action icons - show on hover only */}
                    <div className="flex items-center justify-end gap-1 p-2 pt-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded hover:bg-accent transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNewSession?.(project);
                          onClose();
                        }}
                        title="New session"
                      >
                        <Plus className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                      <button
                        className="p-1 rounded hover:bg-accent transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/project/${encodeURIComponent(project.name)}/sessions`);
                          onClose();
                        }}
                        title={`View all ${totalSessions} sessions`}
                      >
                        <Eye className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>

    {/* Folder Picker Dialog */}
    <FolderPicker
      open={showFolderPicker}
      onClose={() => setShowFolderPicker(false)}
      onSelect={async (path) => {
        setShowFolderPicker(false);
        if (!path.trim()) return;
        
        setCreatingProject(true);
        try {
          const response = await api.createProject(path);
          if (onRefresh) {
            await onRefresh();
          }
          // Select and focus the newly created project
          if (response.name) {
            // Wait for projects to refresh
            setTimeout(() => {
              const newProject = projects.find(p => p.name === response.name);
              if (newProject) {
                onProjectSelect(newProject);
                // Scroll to top where new projects appear
                const scrollArea = document.querySelector('.scroll-area-viewport');
                if (scrollArea) scrollArea.scrollTop = 0;
              }
            }, 100);
          }
        } catch (error) {
          console.error('Failed to create project:', error);
        } finally {
          setCreatingProject(false);
        }
      }}
      value=""
      title="Select Project Folder"
      description="Choose a folder to create your Claude Code project"
    />
    </>
  );
}

export default ProjectsModal;
