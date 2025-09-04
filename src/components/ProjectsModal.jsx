import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Folder, Plus, MessageSquare, Clock, ChevronDown, ChevronRight, ChevronUp, Edit3, Check, X, Trash2, RefreshCw, Search, Star, Edit2, Loader2, FolderSearch, Filter, Eye } from 'lucide-react';
import { ProjectIcon } from '../utils/projectIcons.jsx';
import { cn } from '../lib/utils';
import ClaudeLogo from './ClaudeLogo';
import FolderPicker from './FolderPicker';
import { api } from '../utils/api';
import { formatTimeAgo } from '../utils/time';

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
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualPath, setManualPath] = useState('');
  const [editingName, setEditingName] = useState('');
  // const [creatingProject, setCreatingProject] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [projectSortOrder, setProjectSortOrder] = useState('recent');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const [indexing, setIndexing] = useState(null); // project name currently indexing
  const [highlightProject, setHighlightProject] = useState(null);
  const prevProjectNamesRef = React.useRef([]);

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

  // Detect newly created project to highlight and pin first
  useEffect(() => {
    const names = (projects || []).map(p => p.name);
    const prev = prevProjectNamesRef.current || [];
    const added = names.find(n => !prev.includes(n));
    if (added && names.length > prev.length) {
      setHighlightProject(added);
    }
    prevProjectNamesRef.current = names;
  }, [projects]);

  // Clear highlight when modal closes
  useEffect(() => {
    if (!isOpen && highlightProject) {
      setHighlightProject(null);
    }
  }, [isOpen]);

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

    // Type filter simplified (Vibe Kanban removed). Keep only basic filter.

    return true;
  });

  // Sort projects - newest first by default
  let sortedProjects = [...filteredProjects].sort((a, b) => {
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

  // If a project was just created, pin it to the front once
  if (highlightProject) {
    const idx = sortedProjects.findIndex(p => p.name === highlightProject);
    if (idx > 0) {
      const [item] = sortedProjects.splice(idx, 1);
      sortedProjects = [item, ...sortedProjects];
    }
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-5xl h-[62vh] min-h-[420px] p-0 bg-card border border-border mx-2 sm:mx-auto" onOpenChange={onClose}>
        <DialogHeader className="px-3 sm:px-5 pr-10 pt-3 pb-2 sm:pt-4 sm:pb-3 border-b border-border bg-card">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-lg font-semibold text-foreground">Select Project</DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">Choose from your recent projects</p>
            </div>
            <div className="flex items-center gap-2 mr-4">
              <button
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm transition-colors"
                onClick={() => setShowFolderPicker(true)}
                title="Browse and select a folder to create a new project"
              >
                <FolderSearch className="w-4 h-4" />
                <span className="hidden sm:inline">Browse Folder</span>
                <span className="sm:hidden">Browse</span>
              </button>
              
              <button
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-background hover:bg-accent text-sm transition-colors"
                onClick={() => setShowManualInput(!showManualInput)}
                title="Manually enter a folder path"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Manually</span>
                <span className="sm:hidden">Manual</span>
              </button>
            </div>
          </div>

          {/* Search and Manual Input */}
          <div className="mt-2 sm:mt-3 space-y-2">
            {showManualInput && (
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter folder path (e.g. /Users/name/projects/myapp)"
                  value={manualPath}
                  onChange={(e) => setManualPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && manualPath.trim()) {
                      e.preventDefault();
                      // Create project with manual path
                      setToast({ type: 'info', message: 'Creating project...' });
                      api.createProject(manualPath.trim())
                        .then(async (res) => {
                          if (res.ok) {
                            const created = await res.json();
                            setHighlightProject(created?.project?.name);
                            onRefresh?.();
                            setToast({ type: 'success', message: 'Project created!' });
                            setManualPath('');
                            setShowManualInput(false);
                            setTimeout(() => setToast(null), 2000);
                          } else {
                            const err = await res.text();
                            setToast({ type: 'error', message: err });
                            setTimeout(() => setToast(null), 3000);
                          }
                        })
                        .catch((e) => {
                          setToast({ type: 'error', message: 'Failed to create project' });
                          setTimeout(() => setToast(null), 3000);
                        });
                    } else if (e.key === 'Escape') {
                      setManualPath('');
                      setShowManualInput(false);
                    }
                  }}
                  className="flex-1 h-8 sm:h-9 bg-background border-border text-foreground rounded-lg"
                  autoFocus
                />
                <button
                  className="px-3 h-8 sm:h-9 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm"
                  onClick={() => {
                    if (manualPath.trim()) {
                      setToast({ type: 'info', message: 'Creating project...' });
                      api.createProject(manualPath.trim())
                        .then(async (res) => {
                          if (res.ok) {
                            const created = await res.json();
                            setHighlightProject(created?.project?.name);
                            onRefresh?.();
                            setToast({ type: 'success', message: 'Project created!' });
                            setManualPath('');
                            setShowManualInput(false);
                            setTimeout(() => setToast(null), 2000);
                          } else {
                            const err = await res.text();
                            setToast({ type: 'error', message: err });
                            setTimeout(() => setToast(null), 3000);
                          }
                        })
                        .catch((e) => {
                          setToast({ type: 'error', message: 'Failed to create project' });
                          setTimeout(() => setToast(null), 3000);
                        });
                    }
                  }}
                >
                  Create
                </button>
                <button
                  className="px-3 h-8 sm:h-9 rounded-md border border-border hover:bg-accent text-sm"
                  onClick={() => {
                    setManualPath('');
                    setShowManualInput(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
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

        <ScrollArea className="h-[calc(62vh-120px)] bg-card">
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
            <div className="grid gap-2 sm:gap-3 [grid-template-columns:repeat(auto-fill,minmax(260px,1fr))]">
              {sortedProjects.map((project, index) => {
                const projectSessions = project.sessions || [];
                const latestSession = projectSessions[0]; // Pega apenas a última sessão
                const totalSessions = project.sessionMeta?.total || projectSessions.length; // Usa o total real se disponível
                const isHighlighted = highlightProject && project.name === highlightProject;

                return (
                  <div 
                    key={project.name || `project-${index}`} 
                    className={cn(
                      "relative group rounded-lg border border-border bg-muted/20 hover:bg-muted/30 transition-colors flex flex-col min-h-[100px] sm:min-h-[110px]",
                      selectedProject?.name === project.name && "ring-1 ring-border",
                      isHighlighted && "ring-1 ring-primary border-primary/60 shadow-md"
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
                              <h3 className="text-xs sm:text-sm font-semibold text-foreground leading-tight truncate flex items-center gap-1">
                                {(() => {
                                  const pathSegments = project.path.split('/').filter(seg => seg);
                                  const lastTwo = pathSegments.slice(-2).join('/');
                                  return lastTwo || project.name;
                                })()}
                                {isHighlighted && (
                                  <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/30">New</span>
                                )}
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
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onNewSession?.(project); onClose(); }}
                            title="New session"
                          >
                            <Plus className="w-3 h-3" />
                            <span className="hidden sm:inline">New session</span>
                            <span className="sm:hidden">New</span>
                          </button>
                          {/* Index repo */}
                          <button
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded border border-border/60 bg-background/40 hover:bg-accent/20 text-foreground disabled:opacity-50"
                            disabled={!!indexing}
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setIndexing(project.name);
                              try {
                                await api.indexer.create(project.fullPath || project.path, project.name);
                                setToast({ type: 'success', message: 'Repository indexed successfully' });
                                setTimeout(() => setToast(null), 2000);
                              } catch (err) {
                                setToast({ type: 'error', message: 'Failed to index repository' });
                                setTimeout(() => setToast(null), 2500);
                              } finally {
                                setIndexing(null);
                              }
                            }}
                            title="Index repository for AI context"
                          >
                            {indexing === project.name ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <FolderSearch className="w-3 h-3" />
                            )}
                            Index repo
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
      isOpen={showFolderPicker}
      onClose={() => setShowFolderPicker(false)}
      onSelect={async (folderPath) => {
        console.log('Selected folder:', folderPath);
        setShowFolderPicker(false);
        
        // Show loading state
        setToast({ 
          type: 'info', 
          message: 'Creating project...' 
        });
        
        try {
          const create = await api.createProject(folderPath);
          if (create.ok) {
            const created = await create.json();
            // Ensure we refresh and highlight new project
            setHighlightProject(created?.project?.name);
            onRefresh?.();
            setToast({ 
              type: 'success', 
              message: 'Project created successfully!' 
            });
            setTimeout(() => setToast(null), 2000);
          } else {
            const err = await create.text();
            setToast({ 
              type: 'error', 
              message: `Failed to create project: ${err}` 
            });
            setTimeout(() => setToast(null), 3000);
          }
        } catch (e) {
          console.error('Create project error:', e);
          setToast({ 
            type: 'error', 
            message: 'Failed to create project: ' + e.message 
          });
          setTimeout(() => setToast(null), 3000);
        }
      }}
    />

    {toast && (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
        <div className={`px-3 py-2 text-xs border rounded-md shadow-sm ${
          toast.type === 'success' 
            ? 'bg-success/15 text-success border-success/30' 
            : toast.type === 'info'
            ? 'bg-primary/15 text-primary border-primary/30'
            : 'bg-destructive/15 text-destructive border-destructive/30'
        }`}>
          {toast.message}
        </div>
      </div>
    )}
    </>
  );
}

export default ProjectsModal;
