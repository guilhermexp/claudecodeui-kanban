import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Kanban, ChevronDown, Loader2, Folder, X, CheckCircle2, Circle, Clock, ListTodo, LayoutGrid } from 'lucide-react';
import KanbanModalContent from './KanbanModalContent';
import VibeTaskPanel from './VibeTaskPanel';
import { projectsApi, tasksApi } from '../lib/vibe-kanban/api';
import { api } from '../utils/api';
import { cn } from '../lib/utils';

function KanbanModal({ 
  isOpen, 
  onClose, 
  selectedProject: initialProject,
  isMobile 
}) {
  const [selectedProject, setSelectedProject] = useState(null);
  const [vibeProjects, setVibeProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [taskCounts, setTaskCounts] = useState({});
  const [activeTab, setActiveTab] = useState('kanban'); // 'kanban' or 'tasks'

  useEffect(() => {
    if (isOpen) {
      loadVibeProjects();
    }
  }, [isOpen]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      return () => document.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, onClose]);

  // Load only Vibe Kanban projects
  const loadVibeProjects = async () => {
    try {
      setLoadingProjects(true);
      
      // Load Vibe Kanban projects only
      try {
        // Debug: Loading Vibe projects
        const vibeProjectsData = await projectsApi.getAll();
        // Debug: Vibe projects loaded
        setVibeProjects(vibeProjectsData || []);
        
        // Load task counts for each project
        if (vibeProjectsData && vibeProjectsData.length > 0) {
          const counts = {};
          await Promise.all(
            vibeProjectsData.map(async (project) => {
              try {
                const tasks = await tasksApi.getProjectTasks(project.id);
                const tasksByStatus = {
                  todo: 0,
                  'in-progress': 0,
                  done: 0,
                  total: tasks.length
                };
                
                tasks.forEach(task => {
                  if (task.status === 'todo') tasksByStatus.todo++;
                  else if (task.status === 'in-progress') tasksByStatus['in-progress']++;
                  else if (task.status === 'done') tasksByStatus.done++;
                });
                
                counts[project.id] = tasksByStatus;
              } catch (error) {
                console.error(`[KanbanModal] Error loading tasks for project ${project.id}:`, error);
                counts[project.id] = { todo: 0, 'in-progress': 0, done: 0, total: 0 };
              }
            })
          );
          setTaskCounts(counts);
          
          // If there are projects and none is selected, select the first one
          if (!selectedProject) {
            setSelectedProject(vibeProjectsData[0]);
          }
        }
      } catch (error) {
        console.error('[KanbanModal] Error loading Vibe projects:', error);
        // Log more details about the error
        if (error.response) {
          console.error('[KanbanModal] Response status:', error.response.status);
          console.error('[KanbanModal] Response data:', error.response.data);
        }
        setVibeProjects([]);
      }
    } catch (error) {
      console.error('[KanbanModal] Unexpected error loading projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose} backdropClassName="bg-black/50">
      <DialogContent className="w-full max-w-6xl max-h-[85vh] p-0 bg-card border border-border mx-2 sm:mx-auto">
        <DialogHeader className="px-3 sm:px-5 pr-12 pt-3 pb-2 sm:pt-4 sm:pb-3 border-b border-border bg-card">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Kanban className="w-5 h-5 text-primary/70" />
              <DialogTitle className="text-lg font-semibold text-foreground">
                Task Management
              </DialogTitle>
              
              {/* Tab Navigation */}
              <div className="ml-6 flex items-center gap-1 p-1 bg-accent/30 rounded-lg">
                <button
                  onClick={() => setActiveTab('kanban')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all",
                    activeTab === 'kanban' 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>Kanban Board</span>
                </button>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-all",
                    activeTab === 'tasks' 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ListTodo className="w-4 h-4" />
                  <span>Background Tasks</span>
                </button>
              </div>
              
              {/* Project Dropdown - Only show for Kanban tab */}
              {activeTab === 'kanban' && (
                <div className="ml-4 relative">
                <button
                  onClick={() => {
                    // Debug: Dropdown clicked
                    setDropdownOpen(!dropdownOpen);
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-accent/50 hover:bg-accent transition-colors"
                >
                  <span className="text-foreground">
                    {selectedProject ? selectedProject.name : (initialProject ? (initialProject.displayName || initialProject.name) : 'Select Project')}
                  </span>
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform",
                    dropdownOpen && "rotate-180"
                  )} />
                </button>
                
                {/* Dropdown Menu - Grid Layout */}
                {dropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-[600px] bg-card border border-border rounded-xl shadow-2xl z-50 p-4">
                    <div className="mb-3">
                      <h3 className="text-sm font-semibold text-foreground">Select Project</h3>
                      <p className="text-xs text-muted-foreground mt-1">Choose a project to view its task board</p>
                    </div>
                    
                    {loadingProjects ? (
                      <div className="py-8 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                        <span className="ml-2 text-sm text-muted-foreground">Loading projects...</span>
                      </div>
                    ) : vibeProjects.length > 0 ? (
                      <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        <div>
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Vibe Kanban Projects</h4>
                          <div className="grid grid-cols-2 gap-3">
                            {vibeProjects.map(project => {
                              const createdDate = new Date(project.created_at);
                              const formattedDate = `${createdDate.getMonth() + 1}/${createdDate.getDate()}/${createdDate.getFullYear()}`;
                              const counts = taskCounts[project.id] || { todo: 0, 'in-progress': 0, done: 0, total: 0 };
                              
                              return (
                                <button
                                  key={project.id}
                                  onClick={() => {
                                    setSelectedProject(project);
                                    setDropdownOpen(false);
                                  }}
                                  className={cn(
                                    "relative p-4 rounded-xl border bg-card/50 hover:bg-card/80 transition-all duration-200 text-left group",
                                    "hover:shadow-md hover:border-primary/20",
                                    selectedProject?.id === project.id && "bg-card border-primary/50 shadow-md"
                                  )}
                                >
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-foreground text-sm truncate flex-1">
                                      {project.name}
                                    </h4>
                                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                      <ChevronDown className="w-4 h-4 text-muted-foreground rotate-[-90deg]" />
                                    </div>
                                  </div>
                                  
                                  {project.description && (
                                    <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                                      {project.description}
                                    </p>
                                  )}
                                  
                                  {/* Task Status Summary */}
                                  {counts.total > 0 ? (
                                    <div className="flex items-center gap-2 mb-2 p-2 bg-muted/30 rounded-lg">
                                      <div className="flex items-center gap-1" title="To Do">
                                        <Circle className="w-3 h-3 text-blue-500" />
                                        <span className="text-xs font-semibold text-foreground">{counts.todo}</span>
                                      </div>
                                      <span className="text-muted-foreground/30">•</span>
                                      <div className="flex items-center gap-1" title="In Progress">
                                        <Clock className="w-3 h-3 text-yellow-500" />
                                        <span className="text-xs font-semibold text-foreground">{counts['in-progress']}</span>
                                      </div>
                                      <span className="text-muted-foreground/30">•</span>
                                      <div className="flex items-center gap-1" title="Done">
                                        <CheckCircle2 className="w-3 h-3 text-green-500" />
                                        <span className="text-xs font-semibold text-foreground">{counts.done}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-1 mb-2 p-2 bg-muted/30 rounded-lg text-xs text-muted-foreground">
                                      <Kanban className="w-3 h-3" />
                                      <span>No tasks yet</span>
                                    </div>
                                  )}
                                  
                                  {/* Total Tasks Badge */}
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center text-xs text-muted-foreground">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                      Created {formattedDate}
                                    </div>
                                    {counts.total > 0 && (
                                      <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                                        {counts.total} {counts.total === 1 ? 'task' : 'tasks'}
                                      </div>
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <p className="text-sm text-muted-foreground mb-3">No Vibe Kanban projects found</p>
                        <p className="text-xs text-muted-foreground">Create a new project in Vibe Kanban to get started</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              )}
            </div>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-lg hover:bg-accent/50 transition-colors group"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
            </button>
          </div>
        </DialogHeader>

        <div className="h-[calc(85vh-4rem)] overflow-hidden bg-card">
          {activeTab === 'kanban' ? (
            <KanbanModalContent 
              selectedProject={selectedProject}
              onClose={onClose}
            />
          ) : (
            <div className="h-full p-4">
              <VibeTaskPanel 
                isVisible={true}
                onClose={() => {}} 
                embedded={true}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KanbanModal;
