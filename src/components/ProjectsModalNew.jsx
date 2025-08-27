import React, { useState, useEffect, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from './ui/dialog';
import { 
  Search, 
  Folder, 
  ChevronRight, 
  ChevronDown, 
  Plus, 
  RefreshCw, 
  Edit2, 
  Trash2, 
  MessageSquare,
  Check,
  X,
  Filter,
  SortAsc,
  FolderOpen,
  FileText,
  Terminal,
  Package,
  GitBranch,
  Calendar,
  MoreVertical
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { cn } from '../lib/utils';
import { Loader2 } from 'lucide-react';

// ... (keeping helper functions from original)
const ProjectIcon = ({ project, className }) => {
  const iconClass = cn("flex-shrink-0", className);
  
  if (!project.path) {
    return <Package className={iconClass} />;
  }
  
  const lowerPath = project.path.toLowerCase();
  
  if (lowerPath.includes('node_modules') || lowerPath.includes('npm') || lowerPath.includes('yarn')) {
    return <Package className={iconClass} />;
  }
  
  if (lowerPath.includes('.git') || lowerPath.includes('github')) {
    return <GitBranch className={iconClass} />;
  }
  
  if (project.isStandalone || project.path === 'STANDALONE_MODE') {
    return <Terminal className={iconClass} />;
  }
  
  if (project.sessions && project.sessions.length > 0) {
    return <FolderOpen className={iconClass} />;
  }
  
  if (lowerPath.includes('documents') || lowerPath.includes('desktop')) {
    return <FileText className={iconClass} />;
  }
  
  return <Folder className={iconClass} />;
};

const formatTimeAgo = (date, currentTime) => {
  if (!date) return 'Unknown';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Unknown';
  
  const seconds = Math.floor((currentTime - d) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  
  return d.toLocaleDateString();
};

function ProjectsModalNew({ 
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
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedProjects, setExpandedProjects] = useState(new Set());
  const [additionalSessions, setAdditionalSessions] = useState({});
  const [loadingSessions, setLoadingSessions] = useState({});
  const [editingProject, setEditingProject] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [showNewProject, setShowNewProject] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update time every minute
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  const loadAdditionalSessions = async (projectId) => {
    if (loadingSessions[projectId]) return;
    
    setLoadingSessions(prev => ({ ...prev, [projectId]: true }));
    
    // Simulate loading additional sessions
    setTimeout(() => {
      setAdditionalSessions(prev => ({
        ...prev,
        [projectId]: []
      }));
      setLoadingSessions(prev => ({ ...prev, [projectId]: false }));
    }, 500);
  };

  const handleProjectClick = (project) => {
    onProjectSelect(project);
    if (project.sessions && project.sessions.length > 0) {
      onSessionSelect(project.sessions[0]);
    }
    onClose();
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (onRefresh) {
      await onRefresh();
    }
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  // Filter projects
  const filteredProjects = useMemo(() => {
    if (!projects) return [];
    
    return projects.filter(project => {
      if (!searchQuery) return true;
      
      const query = searchQuery.toLowerCase();
      return (
        project.name?.toLowerCase().includes(query) ||
        project.path?.toLowerCase().includes(query) ||
        project.sessions?.some(s => s.summary?.toLowerCase().includes(query))
      );
    });
  }, [projects, searchQuery]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[85vh] p-0" onOpenChange={onClose}>
        <DialogHeader className="px-6 pr-12 pt-5 pb-4 border-b border-border/50 bg-background/50">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle className="text-xl font-semibold flex items-center gap-2 text-foreground">
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

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 h-9 bg-background/50 border-border/50"
            />
          </div>
        </DialogHeader>

        {/* Projects Grid */}
        <div className="flex-1 overflow-y-auto p-6 bg-background/30">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Folder className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No projects found</p>
              {searchQuery && (
                <p className="text-xs mt-2">Try adjusting your search</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredProjects.map(project => {
                const isExpanded = expandedProjects.has(project.id);
                const allSessions = [
                  ...(project.sessions || []),
                  ...(additionalSessions[project.id] || [])
                ];
                const sessionCount = allSessions.length;

                return (
                  <div
                    key={project.id}
                    className={cn(
                      "relative group rounded-xl border bg-card/60 hover:bg-card/90 transition-all duration-200",
                      "hover:shadow-lg hover:border-primary/30",
                      selectedProject?.id === project.id && "bg-card/90 border-primary/50 shadow-lg"
                    )}
                  >
                    {/* Card Main Content */}
                    <div 
                      className="p-5 cursor-pointer"
                      onClick={() => handleProjectClick(project)}
                    >
                      {/* Header */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-start gap-3 flex-1">
                          <ProjectIcon project={project} className="w-5 h-5 mt-0.5 text-primary/70" />
                          <div className="flex-1 min-w-0">
                            {editingProject === project.id ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <Input
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="h-7 text-sm"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      setEditingProject(null);
                                    } else if (e.key === 'Escape') {
                                      setEditingProject(null);
                                    }
                                  }}
                                />
                                <Button size="icon" variant="ghost" className="h-6 w-6">
                                  <Check className="w-3 h-3" />
                                </Button>
                              </div>
                            ) : (
                              <h3 className="font-semibold text-foreground text-base">
                                {project.name}
                              </h3>
                            )}
                          </div>
                        </div>
                        
                        {/* Action Menu */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Could open a dropdown menu here
                          }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Project Path */}
                      <div className="text-xs text-muted-foreground truncate mb-4">
                        {project.path}
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{sessionCount}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>
                              {project.sessions?.[0]?.updated_at 
                                ? formatTimeAgo(project.sessions[0].updated_at, currentTime)
                                : 'No sessions'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Sessions Section */}
                    {sessionCount > 0 && (
                      <div className="border-t border-border/50">
                        <button
                          className="w-full px-5 py-3 flex items-center justify-between hover:bg-accent/30 transition-colors"
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
                          <span className="text-xs font-medium text-muted-foreground">
                            View Sessions ({sessionCount})
                          </span>
                          {isExpanded ? 
                            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : 
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          }
                        </button>
                        
                        {isExpanded && (
                          <div className="max-h-48 overflow-y-auto border-t border-border/50 bg-background/50">
                            {/* New Session button */}
                            <button
                              className="w-full px-5 py-2.5 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                onNewSession?.(project.id);
                                onClose();
                              }}
                            >
                              <Plus className="w-3 h-3" />
                              <span>New Session</span>
                            </button>
                            
                            {allSessions.map(session => (
                              <div
                                key={session.id}
                                className={cn(
                                  "group px-5 py-2.5 flex items-center justify-between cursor-pointer hover:bg-accent/30 transition-colors",
                                  selectedSession?.id === session.id && "bg-accent/50"
                                )}
                                onClick={() => {
                                  onSessionSelect(session);
                                  onClose();
                                }}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <MessageSquare className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  <span className="text-xs text-foreground truncate">
                                    {session.summary}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {formatTimeAgo(session.updated_at, currentTime)}
                                  </span>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (confirm(`Delete session "${session.summary}"?`)) {
                                        onSessionDelete?.(project.id, session.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-2.5 h-2.5 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                            
                            {loadingSessions[project.id] && (
                              <div className="px-5 py-2.5">
                                <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default ProjectsModalNew;