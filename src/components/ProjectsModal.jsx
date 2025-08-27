import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Folder, Plus, MessageSquare, Clock, ChevronDown, ChevronRight, ChevronUp, Edit3, Check, X, Trash2, FolderPlus, RefreshCw, Search, Star, Edit2, Loader2, FolderSearch, Filter } from 'lucide-react';
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
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [editingProject, setEditingProject] = useState(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [newProjectPath, setNewProjectPath] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);
  const [loadingSessions, setLoadingSessions] = useState({});
  const [additionalSessions, setAdditionalSessions] = useState({});
  const [initialSessionsLoaded, setInitialSessionsLoaded] = useState(new Set());
  const [currentTime, setCurrentTime] = useState(new Date());
  const [projectSortOrder, setProjectSortOrder] = useState('name');
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

  // Auto-expand selected project
  useEffect(() => {
    if (selectedProject && !expandedProjects.has(selectedProject.id)) {
      setExpandedProjects(prev => new Set(prev).add(selectedProject.id));
    }
  }, [selectedProject]);

  const handleProjectClick = async (project) => {
    // Toggle expand/collapse
    setExpandedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(project.id)) {
        newSet.delete(project.id);
      } else {
        newSet.add(project.id);
        // Load additional sessions if needed
        loadAdditionalSessions(project.id);
      }
      return newSet;
    });

    // Select the project
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

  const loadAdditionalSessions = async (projectId) => {
    if (loadingSessions[projectId] || initialSessionsLoaded.has(projectId)) {
      return;
    }

    setLoadingSessions(prev => ({ ...prev, [projectId]: true }));
    try {
      const response = await api.getSessions(projectId, { offset: 10, limit: 50 });
      setAdditionalSessions(prev => ({
        ...prev,
        [projectId]: response.sessions || []
      }));
      setInitialSessionsLoaded(prev => new Set(prev).add(projectId));
    } catch (error) {
      console.error('Failed to load additional sessions:', error);
    } finally {
      setLoadingSessions(prev => ({ ...prev, [projectId]: false }));
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectPath.trim()) return;
    
    setCreatingProject(true);
    try {
      const response = await api.createProject(newProjectPath);
      setShowNewProject(false);
      setNewProjectPath('');
      if (onRefresh) {
        await onRefresh();
      }
      // Select the newly created project
      if (response.id) {
        const newProject = projects.find(p => p.id === response.id);
        if (newProject) {
          handleProjectClick(newProject);
        }
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setCreatingProject(false);
    }
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

  // Sort projects
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] p-0" onOpenChange={onClose}>
        <DialogHeader className="px-4 pr-12 pt-4 pb-3 border-b border-border/50 bg-background/50">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold flex items-center gap-2 text-foreground">
              <Folder className="w-5 h-5 text-primary/70" />
              <span>Projects</span>
            </DialogTitle>
            <div className="flex items-center gap-2 mr-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewProject(true)}
                className="h-8 text-muted-foreground hover:text-foreground hover:bg-accent"
              >
                <Plus className="w-4 h-4 mr-1" />
                New Project
              </Button>
            </div>
          </div>

          {/* Search and filters */}
          <div className="mt-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 bg-background border-border text-foreground"
              />
            </div>
            
            <div className="flex gap-2">
              <select
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                className="h-7 px-2 text-xs rounded border border-border bg-background text-foreground"
              >
                <option value="all">All Projects</option>
                <option value="regular">Regular Projects</option>
                <option value="vibe-kanban">Vibe Kanban</option>
              </select>
              
              <select
                value={projectSortOrder}
                onChange={(e) => setProjectSortOrder(e.target.value)}
                className="h-7 px-2 text-xs rounded border border-border bg-background text-foreground"
              >
                <option value="name">Sort by Name</option>
                <option value="recent">Sort by Recent</option>
                <option value="starred">Sort by Starred</option>
              </select>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="h-[70vh] bg-background/30">
          <div className="p-4">
            {/* New Project Form */}
          {showNewProject && (
            <div className="mb-4 p-3 bg-card/50 rounded-lg border border-border/50">
              <div className="space-y-2">
                <FolderPicker
                  value={newProjectPath}
                  onChange={setNewProjectPath}
                  placeholder="Select project folder..."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCreateProject}
                    disabled={!newProjectPath.trim() || creatingProject}
                    className="text-foreground hover:bg-accent"
                  >
                    {creatingProject ? (
                      <>
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Check className="w-3 h-3 mr-1" />
                        Create
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setShowNewProject(false);
                      setNewProjectPath('');
                    }}
                    className="text-muted-foreground hover:text-foreground hover:bg-accent"
                  >
                    <X className="w-3 h-3 mr-1" />
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Projects List */}
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : sortedProjects.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery || projectFilter !== 'all' 
                ? 'No projects match your filters' 
                : 'No projects yet. Click "New Project" to create one.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {sortedProjects.map(project => {
                const isExpanded = expandedProjects.has(project.id);
                const allSessions = [
                  ...(project.sessions || []),
                  ...(additionalSessions[project.id] || [])
                ];

                return (
                  <div 
                    key={project.id} 
                    className={cn(
                      "relative group rounded-lg border bg-card/50 hover:bg-card/70 transition-all duration-200 flex flex-col",
                      "hover:shadow-md hover:border-primary/30",
                      selectedProject?.id === project.id && "bg-card/80 border-primary/50 shadow-md"
                    )}
                  >
                    {/* Card Header */}
                    <div
                      className="p-3 cursor-pointer flex-1"
                      onClick={() => handleProjectClick(project)}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-1.5 flex-1 min-w-0">
                          <ProjectIcon project={project} className="w-4 h-4 flex-shrink-0 text-primary/70" />
                          <div className="flex-1 min-w-0">
                        {editingProject === project.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              className="h-6 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  // Handle rename
                                  setEditingProject(null);
                                } else if (e.key === 'Escape') {
                                  setEditingProject(null);
                                }
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6">
                              <Check className="w-3 h-3" />
                            </Button>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6"
                              onClick={() => setEditingProject(null)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate text-foreground">{project.name}</span>
                            {project.sessions && project.sessions.length > 0 && (
                              <Badge variant="secondary" className="text-xs px-1 py-0 bg-accent text-accent-foreground">
                                {project.sessions.length}
                              </Badge>
                            )}
                          </div>
                        )}
                            <div className="text-xs text-muted-foreground truncate mt-0.5" title={project.path}>
                              {project.path.split('/').slice(-2).join('/')}
                            </div>
                          </div>
                        </div>
                        
                        {/* Action buttons */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingProject(project.id);
                            setEditingName(project.name);
                          }}
                        >
                          <Edit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete project "${project.name}"?`)) {
                              onProjectDelete?.(project.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                        </div>
                      </div>
                    </div>

                    {/* Sessions Section */}
                    <div className="border-t border-border/40">
                      <button
                        className="w-full px-3 py-2 flex items-center justify-between hover:bg-accent/20 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedProjects(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(project.id)) {
                              newSet.delete(project.id);
                            } else {
                              newSet.add(project.id);
                              loadAdditionalSessions(project.id);
                            }
                            return newSet;
                          });
                        }}
                      >
                        <span className="text-xs text-muted-foreground font-medium">Sessions ({allSessions.length})</span>
                        {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
                      </button>
                        
                      {isExpanded && (
                        <div className="border-t border-border/30 bg-background/20">
                          {/* New Session button */}
                          <button
                            className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/20 transition-colors"
                            onClick={(e) => {
                              e.stopPropagation();
                              onNewSession?.(project.id);
                              onClose();
                            }}
                          >
                            <Plus className="w-3 h-3" />
                            <span>New Session</span>
                          </button>
                          
                          {/* Show only last 3 sessions */}
                          <div className="max-h-32 overflow-y-auto">
                            {allSessions.slice(0, 3).map(session => (
                          <div
                            key={session.id}
                            className={cn(
                              "group flex items-center gap-1.5 px-3 py-1.5 cursor-pointer transition-colors",
                              "hover:bg-accent/20",
                              selectedSession?.id === session.id && "bg-accent/30"
                            )}
                            onClick={() => {
                              onSessionSelect(session);
                              onClose();
                            }}
                          >
                            <MessageSquare className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                            <span className="flex-1 truncate text-xs text-foreground">{session.summary}</span>
                            <span className="text-xs text-muted-foreground flex-shrink-0">
                              {formatTimeAgo(session.updated_at, currentTime)}
                            </span>
                            
                            {/* Session action button */}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete session "${session.summary}"?`)) {
                                  onSessionDelete?.(project.id, session.id);
                                }
                              }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                            ))}
                            
                            {allSessions.length > 3 && (
                              <div className="px-3 py-1 text-xs text-center text-muted-foreground border-t border-border/20">
                                +{allSessions.length - 3} more sessions
                              </div>
                            )}
                          </div>
                        
                        {loadingSessions[project.id] && (
                          <div className="flex items-center justify-center py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                          </div>
                        )}
                        </div>
                      )}
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
  );
}

export default ProjectsModal;