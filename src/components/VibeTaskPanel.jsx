import React, { useState, useEffect, useCallback } from 'react';
import { projectsApi, tasksApi } from '../lib/vibe-kanban/api';
import { TaskFormDialog } from './vibe-kanban/tasks/TaskFormDialog';
import { ConfigProvider } from './vibe-kanban/config-provider';
import { TaskDetailsPanel } from './vibe-kanban/tasks/TaskDetailsPanel';

function VibeTaskPanel({ isVisible, onClose }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  
  // Task listing and details
  const [tasks, setTasks] = useState([]);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTaskList, setShowTaskList] = useState(true); // Control whether to show task list or details

  // Fetch projects on mount
  useEffect(() => {
    if (isVisible) {
      fetchProjects();
    }
  }, [isVisible]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await projectsApi.getAll();
      setProjects(result);
      
      // Auto-select first project if available
      if (result.length > 0 && !selectedProject) {
        setSelectedProject(result[0]);
      }
    } catch (err) {
      // Failed to fetch projects
      setError('Failed to load projects. Make sure Vibe Kanban backend is running.');
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

  // Fetch tasks when project is selected
  const fetchTasks = useCallback(async () => {
    if (!selectedProject) return;
    
    setTasksLoading(true);
    try {
      const result = await tasksApi.getAll(selectedProject.id);
      setTasks(result);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [selectedProject]);

  // Fetch tasks when project changes
  useEffect(() => {
    if (selectedProject && isVisible) {
      fetchTasks();
    }
  }, [selectedProject, isVisible, fetchTasks]);

  const handleCreateTask = useCallback(async (title, description) => {
    if (!selectedProject) return;
    
    try {
      await tasksApi.create(selectedProject.id, {
        project_id: selectedProject.id,
        title,
        description: description || null,
        parent_task_attempt: null,
      });
      
      // Show success message
      setError(null);
      // Could add a success toast here
    } catch (err) {
      // Failed to create task
      setError('Failed to create task: ' + (err.message || ''));
    }
  }, [selectedProject]);

  const handleCreateAndStartTask = useCallback(async (title, description, executor) => {
    if (!selectedProject) return;
    
    try {
      await tasksApi.createAndStart(selectedProject.id, {
        project_id: selectedProject.id,
        title,
        description: description || null,
        parent_task_attempt: null,
        executor: executor || null,
      });
      
      // Show success message
      setError(null);
      // Refresh tasks list
      fetchTasks();
    } catch (err) {
      // Failed to create and start task
      setError('Failed to create and start task: ' + (err.message || ''));
    }
  }, [selectedProject, fetchTasks]);

  // Handle task selection
  const handleTaskClick = useCallback((task) => {
    setSelectedTask(task);
    setShowTaskDetails(true);
    setShowTaskList(false); // Hide task list when showing details
  }, []);

  // Handle closing task details
  const handleCloseTaskDetails = useCallback(() => {
    setShowTaskDetails(false);
    setSelectedTask(null);
    setShowTaskList(true); // Show task list again
    // Refresh tasks in case status changed
    fetchTasks();
  }, [fetchTasks]);

  // Get task status color
  const getStatusColor = (status) => {
    const normalized = (status || '').toLowerCase();
    const statusColors = {
      todo: 'bg-gradient-to-r from-gray-400 to-gray-500',
      inprogress: 'bg-gradient-to-r from-blue-500 to-cyan-500',
      inreview: 'bg-gradient-to-r from-amber-500 to-orange-500',
      done: 'bg-gradient-to-r from-green-500 to-emerald-500',
      cancelled: 'bg-gradient-to-r from-red-500 to-pink-500'
    };
    return statusColors[normalized] || 'bg-gradient-to-r from-gray-400 to-gray-500';
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-background relative max-w-full min-w-0">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border h-12 md:h-14 px-3 md:px-4 flex items-center bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">Vibe Kanban</h3>
            <p className="text-xs text-muted-foreground mt-1">Create tasks quickly</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            title="Close panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 md:p-3 space-y-3 min-w-0">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        )}

        {error && (
          <div className="p-2 bg-destructive/10 border border-destructive/20 rounded-md">
            <p className="text-xs text-destructive">{error}</p>
            <button 
              onClick={fetchProjects}
              className="mt-1.5 px-2 py-1 bg-destructive/20 hover:bg-destructive/30 text-destructive text-xs rounded transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-6">
            <div className="w-10 h-10 mx-auto mb-3 bg-muted rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h4 className="text-sm font-medium text-foreground mb-2">No Projects</h4>
            <p className="text-xs text-muted-foreground">
              Create projects in Vibe Kanban first.
            </p>
          </div>
        )}

        {!loading && !error && projects.length > 0 && (
          <>
            {/* Project Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground">Project</label>
              <select
                value={selectedProject?.id || ''}
                onChange={(e) => {
                  const project = projects.find(p => p.id === e.target.value);
                  setSelectedProject(project);
                }}
                className="w-full px-2.5 py-1.5 bg-background border border-input rounded-md text-xs focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent"
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Selected Project Info */}
            {selectedProject && (
              <div className="p-2 bg-gradient-to-r from-blue-500/5 to-cyan-500/5 rounded-md border border-blue-500/10">
                <h4 className="text-xs font-medium text-foreground">{selectedProject.name}</h4>
                {selectedProject.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{selectedProject.description}</p>
                )}
                <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  <span>ID: {selectedProject.id.slice(0, 6)}...</span>
                  <span>{new Date(selectedProject.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            )}

            {/* Tasks List */}
            {selectedProject && showTaskList && (
              <div className="space-y-2 mt-3">
                <div className="flex items-center justify-between">
                  <h5 className="text-xs font-medium text-foreground">Tasks</h5>
                  <button
                    onClick={fetchTasks}
                    className="p-1 text-muted-foreground hover:text-foreground rounded transition-colors"
                    title="Refresh tasks"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                
                {tasksLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                    <span className="ml-2 text-xs text-muted-foreground">Loading tasks...</span>
                  </div>
                ) : tasks.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground">No tasks yet</p>
                  </div>
                ) : (
                  <div className="max-h-96 overflow-y-auto space-y-1">
                    {tasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => handleTaskClick(task)}
                        className="w-full text-left p-2 bg-muted/20 hover:bg-gradient-to-r hover:from-blue-500/10 hover:to-cyan-500/10 rounded-md transition-all duration-200 border border-transparent hover:border-blue-500/20"
                      >
                        <div className="flex items-start gap-2">
                          <div className={`w-3 h-3 rounded-full mt-1 ${getStatusColor(task.status)} shadow-sm`} />
                          <div className="flex-1 min-w-0">
                            <h6 className="text-xs font-medium text-foreground truncate">{task.title}</h6>
                            {task.description && (
                              <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground capitalize">{task.status}</span>
                              {task.created_at && (
                                <span className="text-xs text-muted-foreground">
                                  {new Date(task.created_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Create Task Button */}
            {selectedProject && (
              <div className="space-y-2">
                <button
                  onClick={() => setIsTaskDialogOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-md hover:from-blue-600 hover:to-cyan-600 transition-all duration-200 font-medium text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Task
                </button>
                
                <p className="text-xs text-muted-foreground text-center">
                  Tasks will appear in Vibe Kanban
                </p>
              </div>
            )}

            {/* Quick Actions */}
            {selectedProject && (
              <div className="pt-3 border-t border-border">
                <h5 className="text-xs font-medium text-foreground mb-2">Quick Actions</h5>
                <div className="space-y-1">
                  <button 
                    onClick={() => window.open(`/vibe-kanban/projects/${selectedProject.id}/tasks`, '_blank')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                    </svg>
                    Kanban
                  </button>
                  
                  <button 
                    onClick={() => window.open('/vibe-kanban/projects', '_blank')}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    All Projects
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Task Creation Dialog */}
      {selectedProject && (
        <ConfigProvider>
          <TaskFormDialog
            isOpen={isTaskDialogOpen}
            onOpenChange={setIsTaskDialogOpen}
            projectId={selectedProject.id}
            onCreateTask={handleCreateTask}
            onCreateAndStartTask={handleCreateAndStartTask}
          />
        </ConfigProvider>
      )}

      {/* Task Details Panel - Inline within the same panel */}
      {showTaskDetails && selectedTask && selectedProject && (
        <div className="absolute inset-0 bg-background z-10">
          <ConfigProvider>
            <TaskDetailsPanel
              task={selectedTask}
              projectId={selectedProject.id}
              onClose={handleCloseTaskDetails}
              isDialogOpen={false}
            />
          </ConfigProvider>
        </div>
      )}
    </div>
  );
}

export default VibeTaskPanel;