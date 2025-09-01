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
    // Select the project and prepare for a NEW session (no auto-resume)
    onProjectSelect(project);
    onSessionSelect(null);
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
      <DialogContent className="w-full max-w-5xl max-h-[70vh] sm:max-h-[75vh] p-0 bg-card border border-border mx-2 sm:mx-auto" onOpenChange={onClose}>
        <DialogHeader className="px-3 sm:px-5 pr-10 pt-3 pb-2 sm:pt-4 sm:pb-3 border-b border-border bg-card">
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
          <div className="mt-2 sm:mt-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-8 sm:h-9 bg-background border-border text-foreground rounded-lg focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[calc(70vh-120px)] sm:h-[calc(75vh-140px)] bg-card">
          <div className="p-3 sm:p-4">
          {/* Projects List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-[#666]" />
            </div>
          ) : sortedProjects.length === 0 ? (
            <div className="text-center py-6 text-[#666]">
              {searchQuery || projectFilter !== 'all' 
                ? 'No projects match your filters' 
                : 'No projects yet. Click "New Project" to create one.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
              {sortedProjects.map((project, index) => {
                const projectSessions = project.sessions || [];
                const latestSession = projectSessions[0]; // Pega apenas a última sessão
                const totalSessions = project.sessionMeta?.total || projectSessions.length; // Usa o total real se disponível

                return (
                  <div 
                    key={project.name || `project-${index}`} 
                    className={cn(
                      "relative group rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-colors flex flex-col min-h-[100px] sm:min-h-[110px]",
                      selectedProject?.name === project.name && "ring-1 ring-border"
                    )}
                  >
                    {/* Card Content */}
                    <div
                      className="p-2.5 sm:p-3 cursor-pointer flex-1 overflow-hidden"
                      onClick={() => handleProjectClick(project)}
                    >
                      <div className="flex items-start gap-2 mb-2">
                        <ProjectIcon project={project} className="w-4 h-4 flex-shrink-0 text-foreground/70 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          {editingProject === project.name ? (
                            <div className="flex items-center gap-1">
                              <Input
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => {
                                  e.stopPropagation();
                                  if (e.key === 'Enter') {
                                    // Save the edit
                                    if (editingName && editingName !== project.name) {
                                      api.updateProject(project.name, { name: editingName })
                                        .then(() => onRefresh?.())
                                        .catch(console.error);
                                    }
                                    setEditingProject(null);
                                  } else if (e.key === 'Escape') {
                                    setEditingProject(null);
                                  }
                                }}
                                className="h-6 text-xs bg-background/60"
                                autoFocus
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (editingName && editingName !== project.name) {
                                    api.updateProject(project.name, { name: editingName })
                                      .then(() => onRefresh?.())
                                      .catch(console.error);
                                  }
                                  setEditingProject(null);
                                }}
                                className="p-0.5 hover:bg-accent rounded"
                              >
                                <Check className="w-3 h-3 text-success" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingProject(null);
                                }}
                                className="p-0.5 hover:bg-accent rounded"
                              >
                                <X className="w-3 h-3 text-destructive" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h3 className="text-xs sm:text-sm font-semibold text-foreground leading-tight truncate">
                                {(() => {
                                  const pathSegments = project.path.split('/').filter(seg => seg);
                                  const lastTwo = pathSegments.slice(-2).join('/');
                                  return lastTwo || project.name;
                                })()}
                              </h3>
                              <div className="text-[9px] sm:text-[10px] text-muted-foreground mt-1 whitespace-normal break-words break-all leading-snug" title={project.path}>
                                {project.path}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Minimal meta + explicit actions: New, Resume, View all */}
                      <div className="mt-1.5 space-y-1.5">
                        <div className="text-[10px] sm:text-[11px] text-muted-foreground">
                          {latestSession ? `Updated ${formatTimeAgo(latestSession.updated_at, currentTime)}` : 'No sessions yet'}
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <button
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded border border-border/60 bg-background/40 hover:bg-accent/20 text-foreground"
                            onClick={(e) => { e.stopPropagation(); onNewSession?.(project); onClose(); }}
                            title="New session"
                          >
                            <Plus className="w-3 h-3" />
                            <span className="hidden sm:inline">New session</span>
                            <span className="sm:hidden">New</span>
                          </button>
                          {latestSession && (
                            <button
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded border border-border/60 bg-background/40 hover:bg-accent/20 text-foreground"
                              onClick={(e) => {
                                e.stopPropagation();
                                onProjectSelect(project);
                                onSessionSelect(latestSession);
                                onClose();
                              }}
                              title="Resume last session"
                            >
                              <Clock className="w-3 h-3" />
                              Resume
                            </button>
                          )}
                          <button
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded border border-border/60 bg-background/40 hover:bg-accent/20 text-foreground"
                            onClick={(e) => { e.stopPropagation(); navigate(`/project/${encodeURIComponent(project.name)}/sessions`); onClose(); }}
                            title={`View all ${totalSessions} sessions`}
                          >
                            <Eye className="w-3 h-3" />
                            <span className="hidden sm:inline">View all</span>
                            <span className="sm:hidden">All</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Bottom action icons - show on hover only on larger screens */}
                    <div className="hidden sm:flex items-center justify-end gap-1 p-1.5 pt-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        className="p-1 rounded hover:bg-accent transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject(project.name);
                          setEditingName(project.name);
                        }}
                        title="Edit project name"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                      </button>
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
                      <button
                        className="p-1 rounded hover:bg-destructive/10 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete project "${project.name}"?\n\nThis will delete all sessions and data for this project.`)) {
                            onProjectDelete?.(project.name);
                          }
                        }}
                        title="Delete project"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
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
