import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';

import { FolderOpen, Folder, Plus, MessageSquare, Clock, ChevronDown, ChevronRight, Edit3, Check, X, Trash2, Settings, FolderPlus, RefreshCw, Sparkles, Moon, Sun, Trello, Search, Star, Edit2, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import ClaudeLogo from './ClaudeLogo';
import { api } from '../utils/api';
import { useTheme } from '../contexts/ThemeContext';

// Helper function to detect VibeKanban projects
const isVibeKanbanProject = (project) => {
  return project.fullPath && (
    project.fullPath.includes('/vibe-kanban/') ||
    project.fullPath.includes('\\vibe-kanban\\') ||
    project.name.startsWith('vk-') ||
    project.fullPath.includes('/T/vibe-kanban/') ||
    project.fullPath.includes('\\T\\vibe-kanban\\') ||
    project.fullPath.includes('/vk-') ||
    project.fullPath.includes('\\vk-')
  );
};

// Move formatTimeAgo outside component to avoid recreation on every render
const formatTimeAgo = (dateString, currentTime) => {
  const date = new Date(dateString);
  const now = currentTime;
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return 'Unknown';
  }
  
  const diffInMs = now - date;
  const diffInSeconds = Math.floor(diffInMs / 1000);
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
  
  if (diffInSeconds < 60) return 'Just now';
  if (diffInMinutes === 1) return '1 min ago';
  if (diffInMinutes < 60) return `${diffInMinutes} mins ago`;
  if (diffInHours === 1) return '1 hour ago';
  if (diffInHours < 24) return `${diffInHours} hours ago`;
  if (diffInDays === 1) return '1 day ago';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  return date.toLocaleDateString();
};

function Sidebar({ 
  projects, 
  selectedProject, 
  selectedSession, 
  onProjectSelect, 
  onSessionSelect, 
  onNewSession,
  onSessionDelete,
  onProjectDelete,
  isLoading,
  onRefresh,
  onShowSettings,
  updateAvailable,
  latestVersion,
  currentVersion,
  onShowVersionModal,
  onSidebarClose
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
  const [editingSession, setEditingSession] = useState(null);
  const [editingSessionName, setEditingSessionName] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState({});
  const [searchFilter, setSearchFilter] = useState('');
  const { isDarkMode, toggleDarkMode } = useTheme();

  // Starred projects state - persisted in localStorage
  const [starredProjects, setStarredProjects] = useState(() => {
    try {
      const saved = localStorage.getItem('starredProjects');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch (error) {
      // Error: 'Error loading starred projects:', error
      return new Set();
    }
  });

  // Touch handler to prevent double-tap issues on iPad (only for buttons, not scroll areas)
  const handleTouchClick = (callback) => {
    return (e) => {
      // Only prevent default for buttons/clickable elements, not scrollable areas
      if (e.target.closest('.overflow-y-auto') || e.target.closest('[data-scroll-container]')) {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      callback();
    };
  };

  // Auto-update timestamps every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every 60 seconds

    return () => clearInterval(timer);
  }, []);

  // Clear additional sessions when projects list changes (e.g., after refresh)
  useEffect(() => {
    setAdditionalSessions({});
    setInitialSessionsLoaded(new Set());
  }, [projects]);

  // Auto-expand project folder when a session is selected
  useEffect(() => {
    if (selectedSession && selectedProject) {
      setExpandedProjects(prev => new Set([...prev, selectedProject.name]));
    }
  }, [selectedSession, selectedProject]);

  // Mark sessions as loaded when projects come in
  useEffect(() => {
    if (projects.length > 0 && !isLoading) {
      const newLoaded = new Set();
      projects.forEach(project => {
        if (project.sessions && project.sessions.length >= 0) {
          newLoaded.add(project.name);
        }
      });
      setInitialSessionsLoaded(newLoaded);
    }
  }, [projects, isLoading]);

  // Load project sort order from settings
  useEffect(() => {
    const loadSortOrder = () => {
      try {
        const savedSettings = localStorage.getItem('claude-tools-settings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          setProjectSortOrder(settings.projectSortOrder || 'name');
        }
      } catch (error) {
        // Error: 'Error loading sort order:', error
      }
    };

    // Load initially
    loadSortOrder();

    // Listen for storage changes
    const handleStorageChange = (e) => {
      if (e.key === 'claude-tools-settings') {
        loadSortOrder();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also check periodically when component is focused (for same-tab changes)
    const checkInterval = setInterval(() => {
      if (document.hasFocus()) {
        loadSortOrder();
      }
    }, 1000);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, []);

  const toggleProject = (projectName) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectName)) {
      newExpanded.delete(projectName);
    } else {
      newExpanded.add(projectName);
    }
    setExpandedProjects(newExpanded);
  };

  // Starred projects utility functions
  const toggleStarProject = (projectName) => {
    const newStarred = new Set(starredProjects);
    if (newStarred.has(projectName)) {
      newStarred.delete(projectName);
    } else {
      newStarred.add(projectName);
    }
    setStarredProjects(newStarred);
    
    // Persist to localStorage
    try {
      localStorage.setItem('starredProjects', JSON.stringify([...newStarred]));
    } catch (error) {
      // Error: 'Error saving starred projects:', error
    }
  };

  const isProjectStarred = (projectName) => {
    return starredProjects.has(projectName);
  };

  // Helper function to get all sessions for a project (initial + additional)
  const getAllSessions = (project) => {
    const initialSessions = project.sessions || [];
    const additional = additionalSessions[project.name] || [];
    return [...initialSessions, ...additional];
  };

  // Helper function to get displayed sessions (limited to 2 initially)
  const getDisplayedSessions = (project) => {
    const allSessions = getAllSessions(project);
    const hasAdditional = additionalSessions[project.name]?.length > 0;
    
    // If we haven't loaded additional sessions yet, show only first 2
    if (!hasAdditional) {
      return allSessions.slice(0, 2);
    }
    
    // If we have additional sessions, show all
    return allSessions;
  };

  // Helper function to check if project has active sessions
  const hasActiveSessions = (project) => {
    const allSessions = getAllSessions(project);
    return allSessions.some(session => {
      const sessionDate = new Date(session.lastActivity);
      const diffInMinutes = Math.floor((currentTime - sessionDate) / (1000 * 60));
      return diffInMinutes < 10; // Active if within last 10 minutes
    });
  };

  // Helper function to get the last activity date for a project
  const getProjectLastActivity = (project) => {
    const allSessions = getAllSessions(project);
    if (allSessions.length === 0) {
      return new Date(0); // Return epoch date for projects with no sessions
    }
    
    // Find the most recent session activity
    const mostRecentDate = allSessions.reduce((latest, session) => {
      const sessionDate = new Date(session.lastActivity);
      return sessionDate > latest ? sessionDate : latest;
    }, new Date(0));
    
    return mostRecentDate;
  };

  // Combined sorting: starred projects first, then by selected order
  const sortedProjects = [...projects].sort((a, b) => {
    const aStarred = isProjectStarred(a.name);
    const bStarred = isProjectStarred(b.name);
    
    // First, sort by starred status
    if (aStarred && !bStarred) return -1;
    if (!aStarred && bStarred) return 1;
    
    // For projects with same starred status, sort by selected order
    if (projectSortOrder === 'date') {
      // Sort by most recent activity (descending)
      return getProjectLastActivity(b) - getProjectLastActivity(a);
    } else {
      // Sort by display name (user-defined) or fallback to name (ascending)
      const nameA = a.displayName || a.name;
      const nameB = b.displayName || b.name;
      return nameA.localeCompare(nameB);
    }
  });

  const startEditing = (project) => {
    setEditingProject(project.name);
    setEditingName(project.displayName);
  };

  const cancelEditing = () => {
    setEditingProject(null);
    setEditingName('');
  };

  const saveProjectName = async (projectName) => {
    try {
      const response = await api.renameProject(projectName, editingName);

      if (response.ok) {
        // Refresh projects to get updated data
        if (window.refreshProjects) {
          window.refreshProjects();
        } else {
          window.location.reload();
        }
      } else {
        // Error: 'Failed to rename project'
      }
    } catch (error) {
      // Error: 'Error renaming project:', error
    }
    
    setEditingProject(null);
    setEditingName('');
  };

  const deleteSession = async (projectName, sessionId) => {
    if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.deleteSession(projectName, sessionId);

      if (response.ok) {
        // Call parent callback if provided
        if (onSessionDelete) {
          onSessionDelete(sessionId);
        }
      } else {
        // Error: 'Failed to delete session'
        alert('Failed to delete session. Please try again.');
      }
    } catch (error) {
      // Error: 'Error deleting session:', error
      alert('Error deleting session. Please try again.');
    }
  };

  const deleteProject = async (projectName) => {
    if (!confirm('Are you sure you want to delete this empty project? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await api.deleteProject(projectName);

      if (response.ok) {
        // Call parent callback if provided
        if (onProjectDelete) {
          onProjectDelete(projectName);
        }
      } else {
        const error = await response.json();
        // Error: 'Failed to delete project'
        alert(error.error || 'Failed to delete project. Please try again.');
      }
    } catch (error) {
      // Error: 'Error deleting project:', error
      alert('Error deleting project. Please try again.');
    }
  };

  const createNewProject = async () => {
    if (!newProjectPath.trim()) {
      alert('Please enter a project path');
      return;
    }

    setCreatingProject(true);
    
    try {
      const response = await api.createProject(newProjectPath.trim());

      if (response.ok) {
        const result = await response.json();
        setShowNewProject(false);
        setNewProjectPath('');
        
        // Refresh projects to show the new one
        if (window.refreshProjects) {
          window.refreshProjects();
        } else {
          window.location.reload();
        }
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create project. Please try again.');
      }
    } catch (error) {
      // Error: 'Error creating project:', error
      alert('Error creating project. Please try again.');
    } finally {
      setCreatingProject(false);
    }
  };

  const cancelNewProject = () => {
    setShowNewProject(false);
    setNewProjectPath('');
  };

  const updateSessionSummary = async (projectName, sessionId, newSummary) => {
    try {
      const response = await api.updateSession(projectName, sessionId, { summary: newSummary });
      if (response.ok) {
        // Refresh to show updated summary
        if (window.refreshProjects) {
          window.refreshProjects();
        }
      }
    } catch (error) {
      // Error: 'Error updating session summary:', error
    } finally {
      setEditingSession(null);
      setEditingSessionName('');
    }
  };

  const loadMoreSessions = async (project) => {
    // Check if we can load more sessions
    const canLoadMore = project.sessionMeta?.hasMore !== false;
    
    if (!canLoadMore || loadingSessions[project.name]) {
      return;
    }

    setLoadingSessions(prev => ({ ...prev, [project.name]: true }));

    try {
      const currentSessionCount = (project.sessions?.length || 0) + (additionalSessions[project.name]?.length || 0);
      const response = await api.sessions(project.name, 2, currentSessionCount);
      
      if (response.ok) {
        const result = await response.json();
        
        // Store additional sessions locally
        setAdditionalSessions(prev => ({
          ...prev,
          [project.name]: [
            ...(prev[project.name] || []),
            ...result.sessions
          ]
        }));
        
        // Update project metadata if needed
        if (result.hasMore === false) {
          // Mark that there are no more sessions to load
          project.sessionMeta = { ...project.sessionMeta, hasMore: false };
        }
      }
    } catch (error) {
      // Error: 'Error loading more sessions:', error
    } finally {
      setLoadingSessions(prev => ({ ...prev, [project.name]: false }));
    }
  };

  // Filter projects based on search input
  const filteredProjects = sortedProjects.filter(project => {
    if (!searchFilter.trim()) return true;
    
    const searchLower = searchFilter.toLowerCase();
    const displayName = (project.displayName || project.name).toLowerCase();
    const projectName = project.name.toLowerCase();
    
    // Search in both display name and actual project name/path
    return displayName.includes(searchLower) || projectName.includes(searchLower);
  });

  return (
    <div className="h-full flex flex-col bg-card border-r border-border md:select-none">
      {/* Header */}
      <div className="p-3 md:p-4 border-b border-border">
        {/* Desktop Header */}
        <div className="hidden md:flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-foreground">Claude Code UI</h1>
              <p className="text-xs text-muted-foreground">AI coding assistant</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
              onClick={async () => {
                setIsRefreshing(true);
                try {
                  await onRefresh();
                } finally {
                  setIsRefreshing(false);
                }
              }}
              disabled={isRefreshing}
              title="Refresh projects and sessions (Ctrl+R)"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="default"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowNewProject(true)}
              title="Create new project (Ctrl+N)"
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
            {onSidebarClose && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 hover:bg-accent hover:text-accent-foreground"
                onClick={onSidebarClose}
                title="Close sidebar"
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Mobile Header */}
        <div className="md:hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-primary/10 rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-semibold text-foreground">Claude Code UI</h1>
                <p className="text-xs text-muted-foreground">Projects</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={async () => {
                  setIsRefreshing(true);
                  try {
                    await onRefresh();
                  } finally {
                    setIsRefreshing(false);
                  }
                }}
                disabled={isRefreshing}
                title="Refresh projects"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button
                variant="default"
                size="icon"
                className="h-9 w-9"
                onClick={() => setShowNewProject(true)}
                title="New project"
              >
                <FolderPlus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* New Project Form */}
      {showNewProject && (
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          {/* Desktop Form */}
          <div className="hidden md:block space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <FolderPlus className="w-4 h-4" />
              Create New Project
            </div>
            <Input
              value={newProjectPath}
              onChange={(e) => setNewProjectPath(e.target.value)}
              placeholder="/path/to/project or relative/path"
              className="text-sm focus:ring-2 focus:ring-primary/20"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') createNewProject();
                if (e.key === 'Escape') cancelNewProject();
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={createNewProject}
                disabled={!newProjectPath.trim() || creatingProject}
                className="flex-1 h-8 text-xs hover:bg-primary/90 transition-colors"
              >
                {creatingProject ? 'Creating...' : 'Create Project'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={cancelNewProject}
                disabled={creatingProject}
                className="h-8 text-xs hover:bg-accent transition-colors"
              >
                Cancel
              </Button>
            </div>
          </div>
          
          {/* Mobile Form - Simple Overlay */}
          <div className="md:hidden fixed inset-0 z-50 bg-black/80">
            <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-lg border-t border-border p-4 space-y-4 animate-in slide-in-from-bottom duration-300">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-muted rounded-xl flex items-center justify-center">
                    <FolderPlus className="w-3 h-3 text-muted-foreground" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-foreground">New Project</h2>
                  </div>
                </div>
                <button
                  onClick={cancelNewProject}
                  disabled={creatingProject}
                  className="w-6 h-6 rounded-md bg-muted flex items-center justify-center active:scale-95 transition-transform"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              
              <div className="space-y-3">
                <Input
                  value={newProjectPath}
                  onChange={(e) => setNewProjectPath(e.target.value)}
                  placeholder="/path/to/project or relative/path"
                  className="text-sm h-10 rounded-xl"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') createNewProject();
                    if (e.key === 'Escape') cancelNewProject();
                  }}
                />
                
                <div className="flex gap-2">
                  <Button
                    onClick={cancelNewProject}
                    disabled={creatingProject}
                    variant="outline"
                    className="flex-1 h-9 text-sm rounded-xl active:scale-95 transition-transform"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={createNewProject}
                    disabled={!newProjectPath.trim() || creatingProject}
                    className="flex-1 h-9 text-sm rounded-xl active:scale-95 transition-all"
                  >
                    {creatingProject ? 'Creating...' : 'Create'}
                  </Button>
                </div>
              </div>
              
              {/* Safe area for mobile */}
              <div className="h-4" />
            </div>
          </div>
        </div>
      )}
      
      {/* Search Filter */}
      {projects.length > 0 && !isLoading && (
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search projects..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="pl-9 h-8 text-sm bg-background border-input"
            />
            {searchFilter && (
              <button
                onClick={() => setSearchFilter('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-accent rounded"
              >
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>
      )}
      
      {/* Projects List */}
      <ScrollArea className="flex-1 px-3 py-2 overflow-y-auto overscroll-contain">
        <div className="space-y-1 pb-safe-area-inset-bottom">
          {isLoading ? (
            <div className="text-center py-12 md:py-8 px-4">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                <div className="w-6 h-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-2">Loading projects...</h3>
              <p className="text-sm text-muted-foreground">
                Fetching your Claude projects and sessions
              </p>
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 md:py-8 px-4">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                <Folder className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-2">No projects found</h3>
              <p className="text-sm text-muted-foreground">
                Run Claude CLI in a project directory to get started
              </p>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="text-center py-12 md:py-8 px-4">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-4">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-medium text-foreground mb-2">No matching projects</h3>
              <p className="text-sm text-muted-foreground">
                Try adjusting your search term
              </p>
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isExpanded = expandedProjects.has(project.name);
              const isSelected = selectedProject?.name === project.name;
              const isStarred = isProjectStarred(project.name);
              const hasActive = hasActiveSessions(project);
              
              return (
                <div key={project.name} className="md:space-y-1">
                  {/* Project Header */}
                  <div className="group md:group">
                    {/* Mobile Project Item */}
                    <div className="md:hidden">
                      <div
                        className={cn(
                          "p-3 mx-3 my-1 rounded-lg border border-border active:scale-[0.98] transition-all duration-150 relative",
                          isVibeKanbanProject(project) && !isSelected && "bg-gray-100 dark:bg-black/30",
                          !isVibeKanbanProject(project) && !isSelected && "bg-card",
                          isSelected && "bg-accent",
                          isStarred && !isSelected && !isVibeKanbanProject(project) && "bg-blue-50/30 dark:bg-blue-900/10",
                          isStarred && !isSelected && isVibeKanbanProject(project) && "bg-gray-200 dark:bg-black/50"
                        )}
                        onClick={() => {
                          // On mobile, just toggle the folder - don't select the project
                          toggleProject(project.name);
                        }}
                        onTouchEnd={handleTouchClick(() => toggleProject(project.name))}
                      >
                        {/* Active session indicator for mobile */}
                        {hasActive && (
                          <div className="absolute top-2 right-2">
                            <Loader2 className="h-3 w-3 animate-spin text-green-500" />
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className={cn(
                              "w-8 h-8 rounded-2xl flex items-center justify-center transition-colors",
                              isExpanded ? "bg-muted" : "bg-muted/50"
                            )}>
                              {isVibeKanbanProject(project) ? (
                                <Trello className="w-4 h-4 text-muted-foreground" />
                              ) : isExpanded ? (
                                <FolderOpen className="w-4 h-4 text-primary" />
                              ) : (
                                <Folder className="w-4 h-4 text-muted-foreground" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              {editingProject === project.name ? (
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="w-full px-3 py-2 text-sm border-2 border-primary/40 focus:border-primary rounded-lg bg-background text-foreground shadow-gray-200/30 dark:shadow-gray-800/30 focus:shadow-primary/20 transition-all duration-200 focus:outline-none"
                                  placeholder="Project name"
                                  autoFocus
                                  autoComplete="off"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveProjectName(project.name);
                                    if (e.key === 'Escape') cancelEditing();
                                  }}
                                  style={{
                                    fontSize: '16px', // Prevents zoom on iOS
                                    WebkitAppearance: 'none',
                                    borderRadius: '8px'
                                  }}
                                />
                              ) : (
                                <>
                                  <h3 className="text-sm font-medium text-foreground truncate">
                                    {project.displayName}
                                  </h3>
                                  <p className="text-xs text-muted-foreground">
                                    {(() => {
                                      const sessionCount = getAllSessions(project).length;
                                      const hasMore = project.sessionMeta?.hasMore !== false;
                                      const count = hasMore && sessionCount >= 2 ? `${sessionCount}+` : sessionCount;
                                      return `${count} session${count === 1 ? '' : 's'}`;
                                    })()}
                                  </p>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            {editingProject === project.name ? (
                              <>
                                <button
                                  className="w-8 h-8 rounded-lg bg-green-500 dark:bg-green-600 flex items-center justify-center active:scale-90 transition-all duration-150 shadow-green-200/50 dark:shadow-green-800/50 active:shadow-none"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    saveProjectName(project.name);
                                  }}
                                >
                                  <Check className="w-4 h-4 text-white" />
                                </button>
                                <button
                                  className="w-8 h-8 rounded-lg bg-gray-500 dark:bg-gray-600 flex items-center justify-center active:scale-90 transition-all duration-150 shadow-gray-200/50 dark:shadow-gray-800/50 active:shadow-none"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    cancelEditing();
                                  }}
                                >
                                  <X className="w-4 h-4 text-white" />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* Star button */}
                                <button
                                  className={cn(
                                    "w-8 h-8 rounded-lg flex items-center justify-center active:scale-90 transition-all duration-150 border",
                                    isStarred 
                                      ? "bg-blue-500/10 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800" 
                                      : "bg-gray-500/10 dark:bg-black/20 border-gray-200 dark:border-gray-900"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleStarProject(project.name);
                                  }}
                                  onTouchEnd={handleTouchClick(() => toggleStarProject(project.name))}
                                  title={isStarred ? "Remove from favorites" : "Add to favorites"}
                                >
                                  <Star className={cn(
                                    "w-4 h-4 transition-colors",
                                    isStarred 
                                      ? "text-blue-600 dark:text-blue-400 fill-current" 
                                      : "text-gray-600 dark:text-gray-400"
                                  )} />
                                </button>
                                {getAllSessions(project).length === 0 && (
                                  <button
                                    className="w-8 h-8 rounded-lg bg-red-500/10 dark:bg-red-900/30 flex items-center justify-center active:scale-90 border border-red-200 dark:border-red-800"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteProject(project.name);
                                    }}
                                    onTouchEnd={handleTouchClick(() => deleteProject(project.name))}
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  </button>
                                )}
                                <button
                                  className="w-8 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 flex items-center justify-center active:scale-90 border border-primary/20 dark:border-primary/30"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    startEditing(project);
                                  }}
                                  onTouchEnd={handleTouchClick(() => startEditing(project))}
                                >
                                  <Edit3 className="w-4 h-4 text-primary" />
                                </button>
                                <div className="w-6 h-6 rounded-md bg-muted/30 flex items-center justify-center">
                                  {isExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Desktop Project Item */}
                    <Button
                      variant="ghost"
                      className={cn(
                        "hidden md:flex w-full justify-between px-3 py-2 h-auto font-normal hover:text-accent-foreground relative rounded-lg",
                        isVibeKanbanProject(project) && !isSelected && "bg-gray-100 dark:bg-black/30 hover:bg-gray-200 dark:hover:bg-black/40",
                        !isVibeKanbanProject(project) && !isSelected && "hover:bg-accent",
                        isSelected && "bg-accent text-accent-foreground",
                        isStarred && !isSelected && !isVibeKanbanProject(project) && "bg-blue-50/30 dark:bg-blue-900/10 hover:bg-blue-100/30 dark:hover:bg-blue-900/20",
                        isStarred && !isSelected && isVibeKanbanProject(project) && "bg-gray-200 dark:bg-black/50 hover:bg-gray-300 dark:hover:bg-black/60"
                      )}
                      onClick={() => {
                        // Desktop behavior: select project and toggle
                        if (selectedProject?.name !== project.name) {
                          onProjectSelect(project);
                        }
                        toggleProject(project.name);
                      }}
                      onTouchEnd={handleTouchClick(() => {
                        if (selectedProject?.name !== project.name) {
                          onProjectSelect(project);
                        }
                        toggleProject(project.name);
                      })}
                    >
                      {/* Active session indicator for desktop */}
                      {hasActive && (
                        <div className="absolute top-1 right-1">
                          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
                        </div>
                      )}
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {isVibeKanbanProject(project) ? (
                          <Trello className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        ) : isExpanded ? (
                          <FolderOpen className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : (
                          <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0 flex-1 text-left">
                          {editingProject === project.name ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-foreground focus:ring-2 focus:ring-primary/20"
                                placeholder="Project name"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveProjectName(project.name);
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                              />
                              <div className="text-xs text-muted-foreground truncate" title={project.fullPath}>
                                {project.fullPath}
                              </div>
                            </div>
                          ) : (
                            <div>
                              <div className="text-sm font-semibold truncate text-foreground" title={project.displayName}>
                                {project.displayName}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {(() => {
                                  const sessionCount = getAllSessions(project).length;
                                  const hasMore = project.sessionMeta?.hasMore !== false;
                                  return hasMore && sessionCount >= 2 ? `${sessionCount}+` : sessionCount;
                                })()}
                                {project.fullPath !== project.displayName && (
                                  <span className="ml-1 opacity-60" title={project.fullPath}>
                                    • {project.fullPath.length > 25 ? '...' + project.fullPath.slice(-22) : project.fullPath}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {editingProject === project.name ? (
                          <>
                            <div
                              className="w-6 h-6 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center justify-center rounded cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                saveProjectName(project.name);
                              }}
                            >
                              <Check className="w-3 h-3" />
                            </div>
                            <div
                              className="w-6 h-6 text-gray-500 hover:text-gray-700 hover:bg-gray-50 dark:hover:bg-gray-900 flex items-center justify-center rounded cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                cancelEditing();
                              }}
                            >
                              <X className="w-3 h-3" />
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Star button */}
                            <div
                              className={cn(
                                "w-5 h-5 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center rounded cursor-pointer touch:opacity-100",
                                isStarred 
                                  ? "hover:bg-blue-50 dark:hover:bg-blue-900/20 opacity-100" 
                                  : "hover:bg-accent"
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleStarProject(project.name);
                              }}
                              title={isStarred ? "Remove from favorites" : "Add to favorites"}
                            >
                              <Star className={cn(
                                "w-3 h-3 transition-colors",
                                isStarred 
                                  ? "text-blue-600 dark:text-blue-400 fill-current" 
                                  : "text-muted-foreground"
                              )} />
                            </div>
                            <div
                              className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-accent flex items-center justify-center rounded cursor-pointer touch:opacity-100"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(project);
                              }}
                              title="Rename project (F2)"
                            >
                              <Edit3 className="w-3 h-3" />
                            </div>
                            {getAllSessions(project).length === 0 && (
                              <div
                                className="w-5 h-5 opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center rounded cursor-pointer touch:opacity-100"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteProject(project.name);
                                }}
                                title="Delete empty project (Delete)"
                              >
                                <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                              </div>
                            )}
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                            )}
                          </>
                        )}
                      </div>
                    </Button>
                  </div>

                  {/* Sessions List */}
                  {isExpanded && (
                    <div className="ml-4 space-y-1 border-l border-border pl-4">
                      {!initialSessionsLoaded.has(project.name) ? (
                        // Loading skeleton for sessions
                        Array.from({ length: 3 }).map((_, i) => (
                          <div key={i} className="p-2 rounded-md">
                            <div className="flex items-start gap-2">
                              <div className="w-3 h-3 bg-muted rounded-full animate-pulse mt-0.5" />
                              <div className="flex-1 space-y-1">
                                <div className="h-3 bg-muted rounded animate-pulse" style={{ width: `${60 + i * 15}%` }} />
                                <div className="h-2 bg-muted rounded animate-pulse w-1/2" />
                              </div>
                            </div>
                          </div>
                        ))
                      ) : getAllSessions(project).length === 0 && !loadingSessions[project.name] ? (
                        <div className="py-2 px-4 text-left">
                          <p className="text-xs text-muted-foreground">No sessions yet</p>
                        </div>
                      ) : (
                        getDisplayedSessions(project).map((session) => {
                          // Calculate if session is active (within last 10 minutes)
                          const sessionDate = new Date(session.lastActivity);
                          const diffInMinutes = Math.floor((currentTime - sessionDate) / (1000 * 60));
                          const isActive = diffInMinutes < 10;
                          
                          return (
                          <div key={session.id} className="group relative">
                            {/* Mobile Session Item */}
                            <div className="md:hidden">
                              <div
                                className={cn(
                                  "p-1 mx-3 my-0.5 rounded-sm bg-transparent hover:bg-card/30 border-0 hover:border active:scale-[0.98] transition-all duration-150 relative",
                                  selectedSession?.id === session.id ? "bg-primary/5 border-primary/20 shadow-primary/5" :
                                  isActive ? "border-green-500/30 bg-green-50/5 dark:bg-green-900/5 shadow-green-200/20 dark:shadow-green-800/20" : "border-border/30 hover:shadow-gray-200/30 dark:hover:shadow-gray-800/30"
                                )}
                                onClick={() => {
                                  onProjectSelect(project);
                                  onSessionSelect(session);
                                }}
                                onTouchEnd={handleTouchClick(() => {
                                  onProjectSelect(project);
                                  onSessionSelect(session);
                                })}
                              >
                                <div className="flex items-center gap-1.5">
                                  <div className={cn(
                                    "w-3 h-3 rounded-sm flex items-center justify-center flex-shrink-0",
                                    selectedSession?.id === session.id ? "bg-primary/10" : "bg-muted/30"
                                  )}>
                                    <MessageSquare className={cn(
                                      "w-2 h-2",
                                      selectedSession?.id === session.id ? "text-primary" : "text-muted-foreground"
                                    )} />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-normal truncate text-muted-foreground leading-tight">
                                      {session.summary || 'New Session'}
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Clock className="w-2 h-2 text-muted-foreground/70" />
                                      <span className="text-xs text-muted-foreground/70 leading-none">
                                        {formatTimeAgo(session.lastActivity, currentTime)}
                                      </span>
                                      {/* Active session indicator */}
                                      {isActive && (
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1" />
                                      )}
                                      {session.messageCount > 0 && (
                                        <Badge variant="secondary" className="text-xs px-1 py-0 ml-auto opacity-60">
                                          {session.messageCount}
                                        </Badge>
                                      )}
                                      {/* Mobile delete button na mesma linha */}
                                      <div
                                        className="w-4 h-4 rounded-sm bg-red-50/50 dark:bg-red-900/10 flex items-center justify-center active:scale-95 transition-transform opacity-60 ml-1 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          deleteSession(project.name, session.id);
                                        }}
                                        onTouchEnd={handleTouchClick(() => deleteSession(project.name, session.id))}
                                      >
                                        <Trash2 className="w-2 h-2 text-red-600/70 dark:text-red-400/70" />
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                            
                            {/* Desktop Session Item */}
                            <div className="hidden md:block relative">
                              <div
                                className={cn(
                                  "w-full px-3 py-1.5 rounded-md cursor-pointer hover:bg-accent/30 transition-colors duration-200 group",
                                  selectedSession?.id === session.id && "bg-accent text-accent-foreground"
                                )}
                                onClick={() => onSessionSelect(session)}
                                onTouchEnd={handleTouchClick(() => onSessionSelect(session))}
                              >
                                <div className="flex items-start gap-1.5 min-w-0 w-full">
                                  <MessageSquare className="w-3 h-3 text-muted-foreground/70 mt-0.5 flex-shrink-0" />
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-normal truncate text-muted-foreground leading-tight">
                                      {session.summary || 'New Session'}
                                    </div>
                                    <div className="flex items-center gap-1 mt-0.5">
                                      <Clock className="w-3 h-3 text-muted-foreground/70" />
                                      <span className="text-xs text-muted-foreground/70 leading-none">
                                        {formatTimeAgo(session.lastActivity, currentTime)}
                                      </span>
                                      {/* Active session indicator */}
                                      {isActive && (
                                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-1" />
                                      )}
                                      {session.messageCount > 0 && (
                                        <Badge variant="secondary" className="text-xs px-1 py-0 ml-auto opacity-60">
                                          {session.messageCount}
                                        </Badge>
                                      )}
                                      {/* Ícones de ação na mesma linha */}
                                      <div className="flex items-center gap-0.5 ml-1 opacity-60 group-hover:opacity-100 transition-all duration-200">
                                        {editingSession === session.id ? (
                                          <>
                                            <button
                                              className="w-4 h-4 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded flex items-center justify-center"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateSessionSummary(project.name, session.id, editingSessionName);
                                              }}
                                              title="Save"
                                            >
                                              <Check className="w-2 h-2 text-green-600 dark:text-green-400" />
                                            </button>
                                            <button
                                              className="w-4 h-4 bg-gray-50 hover:bg-gray-100 dark:bg-black/20 dark:hover:bg-black/40 rounded flex items-center justify-center"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSession(null);
                                                setEditingSessionName('');
                                              }}
                                              title="Cancel"
                                            >
                                              <X className="w-2 h-2 text-gray-600 dark:text-gray-400" />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              className="w-4 h-4 bg-gray-50 hover:bg-gray-100 dark:bg-black/20 dark:hover:bg-black/40 rounded flex items-center justify-center"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingSession(session.id);
                                                setEditingSessionName(session.summary || 'New Session');
                                              }}
                                              title="Edit session name"
                                            >
                                              <Edit2 className="w-2 h-2 text-gray-600 dark:text-gray-400" />
                                            </button>
                                            <button
                                              className="w-4 h-4 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded flex items-center justify-center"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                deleteSession(project.name, session.id);
                                              }}
                                              title="Delete session"
                                            >
                                              <Trash2 className="w-2 h-2 text-red-600 dark:text-red-400" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              {/* Campo de edição quando em modo de edição */}
                              {editingSession === session.id && (
                                <div className="absolute inset-0 bg-background/95 backdrop-blur-sm rounded flex items-center px-2">
                                  <input
                                    type="text"
                                    value={editingSessionName}
                                    onChange={(e) => setEditingSessionName(e.target.value)}
                                    onKeyDown={(e) => {
                                      e.stopPropagation();
                                      if (e.key === 'Enter') {
                                        updateSessionSummary(project.name, session.id, editingSessionName);
                                      } else if (e.key === 'Escape') {
                                        setEditingSession(null);
                                        setEditingSessionName('');
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                    autoFocus
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                          );
                        })
                      )}

                      {/* Show More Sessions Button */}
                      {(() => {
                        const allSessions = getAllSessions(project);
                        const displayedSessions = getDisplayedSessions(project);
                        const hasMoreToShow = allSessions.length > displayedSessions.length;
                        const hasMoreFromServer = project.sessionMeta?.hasMore !== false;
                        
                        return (hasMoreToShow || hasMoreFromServer) && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-center gap-2 mt-2 h-8"
                            onClick={() => loadMoreSessions(project)}
                            disabled={loadingSessions[project.name]}
                          >
                            {loadingSessions[project.name] ? (
                              <>
                                <div className="w-3 h-3 animate-spin rounded-full border border-muted-foreground border-t-transparent" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3 h-3" />
                                Show more sessions
                              </>
                            )}
                          </Button>
                        );
                      })()}
                      
                      {/* New Session Button */}
                      <div className="md:hidden px-3 pb-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full h-8 text-xs"
                          onClick={() => {
                            onProjectSelect(project);
                            onNewSession(project);
                          }}
                        >
                          <Plus className="w-3 h-3" />
                          New Session
                        </Button>
                      </div>
                      
                      <Button
                        variant="default"
                        size="sm"
                        className="hidden md:flex w-full justify-start gap-2 mt-2 h-8 text-sm"
                        onClick={() => onNewSession(project)}
                      >
                        <Plus className="w-3 h-3" />
                        New Session
                      </Button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      
      {/* Version Update Notification */}
      {updateAvailable && (
        <div className="md:px-3 md:py-2 border-t border-border/50 flex-shrink-0">
          {/* Desktop Version Notification */}
          <div className="hidden md:block">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-3 py-2 h-auto font-normal text-left hover:bg-accent transition-colors duration-200 border border-border rounded-2xl"
              onClick={onShowVersionModal}
            >
              <div className="relative">
                <svg className="w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">Update Available</div>
                <div className="text-xs text-muted-foreground">Version {latestVersion} is ready</div>
              </div>
            </Button>
          </div>
          
          {/* Mobile Version Notification */}
          <div className="md:hidden p-3 pb-2">
            <button
              className="w-full h-12 bg-accent border border-border rounded-2xl flex items-center justify-start gap-3 px-4 active:scale-[0.98] transition-all duration-150"
              onClick={onShowVersionModal}
            >
              <div className="relative">
                <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                </svg>
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              </div>
              <div className="min-w-0 flex-1 text-left">
                <div className="text-sm font-medium text-foreground">Update Available</div>
                <div className="text-xs text-muted-foreground">Version {latestVersion} is ready</div>
              </div>
            </button>
          </div>
        </div>
      )}
      
      {/* Footer Section */}
      <div className="border-t border-border flex-shrink-0">
        {/* Desktop Footer */}
        <div className="hidden md:block p-3 space-y-2">
          {/* VibeKanban Button */}
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 h-8"
            onClick={() => navigate('/vibe-kanban')}
          >
            <Trello className="w-4 h-4" />
            <span>Vibe Kanban</span>
          </Button>
          
          {/* Settings and Theme Row */}
          <div className="flex gap-2">
            {/* Tools Settings Button */}
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-2 h-8"
              onClick={onShowSettings}
            >
              <Settings className="w-4 h-4" />
              <span>Tools Settings</span>
            </Button>
            
            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Mobile Footer */}
        <div className="md:hidden p-3 pb-safe-area-inset-bottom space-y-2">
          {/* VibeKanban Button */}
          <Button
            variant="outline"
            className="w-full h-10 justify-center gap-2"
            onClick={() => navigate('/vibe-kanban')}
          >
            <Trello className="w-4 h-4" />
            <span>Vibe Kanban</span>
          </Button>
          
          {/* Settings and Theme Row */}
          <div className="flex gap-2">
            {/* Tools Settings Button */}
            <Button
              variant="ghost"
              className="flex-1 h-10 justify-center gap-2"
              onClick={onShowSettings}
            >
              <Settings className="w-4 h-4" />
              <span>Tools Settings</span>
            </Button>
            
            {/* Theme Toggle Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10"
              onClick={toggleDarkMode}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <Sun className="w-4 h-4" />
              ) : (
                <Moon className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Sidebar;