import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Kanban, ChevronDown, Loader2, Folder, X, CheckCircle2, Circle, Clock, ListTodo, LayoutGrid, Plus } from 'lucide-react';
import { Loader } from './vibe-kanban/ui/loader';
import TaskKanbanBoard from './vibe-kanban/tasks/TaskKanbanBoard';
import VibeTaskPanel from './VibeTaskPanel';
import { projectsApi, tasksApi } from '../lib/vibe-kanban/api';
import { api } from '../utils/api';
import { cn } from '../lib/utils';
import { Button } from './vibe-kanban/ui/button';

function KanbanModalUnified({ 
  isOpen, 
  onClose, 
  selectedProject: initialProject,
  isMobile 
}) {
  // Project selection state
  const [selectedProject, setSelectedProject] = useState(null);
  const [vibeProjects, setVibeProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [taskCounts, setTaskCounts] = useState({});
  const [activeTab, setActiveTab] = useState('kanban');
  
  // Kanban content state
  const [tasks, setTasks] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load projects on open
  useEffect(() => {
    if (isOpen) {
      loadVibeProjects();
    }
  }, [isOpen]);

  // Handle ESC key
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

  // Load project data when selected project changes
  useEffect(() => {
    if (!selectedProject?.id) {
      setLoading(false);
      return;
    }

    if (!selectedProject.id.toString().startsWith('temp-')) {
      loadProjectData();
    } else {
      setTasks([]);
      setProject(selectedProject);
      setLoading(false);
    }
  }, [selectedProject?.id]);

  const loadVibeProjects = async () => {
    try {
      setLoadingProjects(true);
      
      const response = await projectsApi.getAll();
      const projects = response || [];
      setVibeProjects(projects);
      
      // Load task counts
      const counts = {};
      for (const project of projects) {
        try {
          const tasks = await tasksApi.getProjectTasks(project.id);
          counts[project.id] = {
            todo: tasks.filter(t => t.status === 'todo').length,
            in_progress: tasks.filter(t => t.status === 'in_progress').length,
            done: tasks.filter(t => t.status === 'done').length,
            total: tasks.length
          };
        } catch {
          counts[project.id] = { todo: 0, in_progress: 0, done: 0, total: 0 };
        }
      }
      setTaskCounts(counts);
      
      // Set initial project
      if (projects.length > 0 && !selectedProject) {
        const defaultProject = projects.find(p => p.is_default) || projects[0];
        setSelectedProject(defaultProject);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadProjectData = async () => {
    if (!selectedProject?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const projectData = await projectsApi.getById(selectedProject.id);
      setProject(projectData);
      
      const tasksData = await tasksApi.getProjectTasks(selectedProject.id);
      setTasks(tasksData || []);
    } catch (err) {
      console.error('Error loading project data:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (project) => {
    setSelectedProject(project);
    setDropdownOpen(false);
  };

  const handleTaskUpdate = async (taskId, updates) => {
    try {
      const updatedTask = await tasksApi.updateTask(taskId, updates);
      setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));
      
      // Update task counts
      const updatedCounts = { ...taskCounts };
      const projectTasks = tasks.map(t => t.id === taskId ? updatedTask : t);
      updatedCounts[selectedProject.id] = {
        todo: projectTasks.filter(t => t.status === 'todo').length,
        in_progress: projectTasks.filter(t => t.status === 'in_progress').length,
        done: projectTasks.filter(t => t.status === 'done').length,
        total: projectTasks.length
      };
      setTaskCounts(updatedCounts);
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleCreateTask = async (newTask) => {
    try {
      const createdTask = await tasksApi.createTask({
        ...newTask,
        project_id: selectedProject.id
      });
      setTasks(prev => [...prev, createdTask]);
      
      // Update counts
      const updatedCounts = { ...taskCounts };
      updatedCounts[selectedProject.id] = {
        ...updatedCounts[selectedProject.id],
        [createdTask.status]: (updatedCounts[selectedProject.id]?.[createdTask.status] || 0) + 1,
        total: (updatedCounts[selectedProject.id]?.total || 0) + 1
      };
      setTaskCounts(updatedCounts);
    } catch (err) {
      console.error('Failed to create task:', err);
    }
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await tasksApi.deleteTask(taskId);
      const deletedTask = tasks.find(t => t.id === taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
      
      // Update counts
      if (deletedTask) {
        const updatedCounts = { ...taskCounts };
        updatedCounts[selectedProject.id] = {
          ...updatedCounts[selectedProject.id],
          [deletedTask.status]: Math.max(0, (updatedCounts[selectedProject.id]?.[deletedTask.status] || 0) - 1),
          total: Math.max(0, (updatedCounts[selectedProject.id]?.total || 0) - 1)
        };
        setTaskCounts(updatedCounts);
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const getTaskCountIcon = (status) => {
    switch(status) {
      case 'todo': return <Circle className="w-3 h-3" />;
      case 'in_progress': return <Clock className="w-3 h-3" />;
      case 'done': return <CheckCircle2 className="w-3 h-3" />;
      default: return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn(
          "max-w-7xl w-full p-0 gap-0 h-[90vh] flex flex-col",
          isMobile && "h-full max-h-full rounded-none"
        )}
      >
        <DialogHeader className="px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Kanban className="w-5 h-5 text-primary" />
              <DialogTitle className="text-lg">Task Management</DialogTitle>
              
              {/* Project Selector */}
              <div className="relative">
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-accent transition-colors"
                  disabled={loadingProjects}
                >
                  {loadingProjects ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : selectedProject ? (
                    <>
                      <Folder className="w-4 h-4" />
                      <span className="max-w-[200px] truncate">{selectedProject.name}</span>
                      {taskCounts[selectedProject.id] && (
                        <span className="text-xs text-muted-foreground">
                          ({taskCounts[selectedProject.id].total})
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Select project</span>
                  )}
                  <ChevronDown className={cn(
                    "w-4 h-4 transition-transform",
                    dropdownOpen && "rotate-180"
                  )} />
                </button>
                
                {dropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-64 bg-popover border rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
                    {vibeProjects.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">No projects available</div>
                    ) : (
                      vibeProjects.map((project) => (
                        <button
                          key={project.id}
                          onClick={() => handleProjectSelect(project)}
                          className={cn(
                            "w-full px-3 py-2 text-left hover:bg-accent transition-colors flex items-center justify-between group",
                            selectedProject?.id === project.id && "bg-accent"
                          )}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <Folder className="w-4 h-4 flex-shrink-0" />
                            <span className="truncate">{project.name}</span>
                          </div>
                          {taskCounts[project.id] && taskCounts[project.id].total > 0 && (
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              {taskCounts[project.id].todo > 0 && (
                                <span className="flex items-center gap-0.5">
                                  {getTaskCountIcon('todo')}
                                  {taskCounts[project.id].todo}
                                </span>
                              )}
                              {taskCounts[project.id].in_progress > 0 && (
                                <span className="flex items-center gap-0.5">
                                  {getTaskCountIcon('in_progress')}
                                  {taskCounts[project.id].in_progress}
                                </span>
                              )}
                              {taskCounts[project.id].done > 0 && (
                                <span className="flex items-center gap-0.5">
                                  {getTaskCountIcon('done')}
                                  {taskCounts[project.id].done}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Tab Switcher */}
            <div className="flex items-center gap-2">
              <div className="flex bg-muted rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('kanban')}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-2",
                    activeTab === 'kanban' 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <LayoutGrid className="w-4 h-4" />
                  Kanban
                </button>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded transition-colors flex items-center gap-2",
                    activeTab === 'tasks' 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <ListTodo className="w-4 h-4" />
                  List
                </button>
              </div>
              
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-accent rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          {!selectedProject ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Folder className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Select a project to view tasks</p>
              </div>
            </div>
          ) : loading ? (
            <div className="h-full flex items-center justify-center">
              <Loader />
            </div>
          ) : error ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <p className="text-destructive mb-2">{error}</p>
                <Button onClick={loadProjectData} variant="outline" size="sm">
                  Retry
                </Button>
              </div>
            </div>
          ) : activeTab === 'kanban' ? (
            <div className="h-full overflow-auto p-6">
              <TaskKanbanBoard
                tasks={tasks}
                projectId={selectedProject?.id}
                onTaskUpdate={handleTaskUpdate}
                onTaskCreate={handleCreateTask}
                onTaskDelete={handleDeleteTask}
              />
            </div>
          ) : (
            <div className="h-full overflow-auto">
              <VibeTaskPanel
                selectedProject={selectedProject}
                embedded={true}
                className="h-full"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KanbanModalUnified;