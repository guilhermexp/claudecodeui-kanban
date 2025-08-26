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
      todo: 'bg-muted',
      inprogress: 'bg-info',
      inreview: 'bg-warning',
      done: 'bg-success',
      cancelled: 'bg-destructive'
    };
    return statusColors[normalized] || 'bg-muted';
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-card border border-border rounded-lg overflow-hidden relative max-w-full min-w-0">
      {/* Header - matching Files and Source Control modals */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-border">
        <h3 className="text-foreground font-medium">Tasks</h3>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
          title="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content - matching other modals background */}
      <div className="flex-1 overflow-y-auto bg-card">
        <div className="p-4 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
          </div>
        )}

        {error && (
          <div className="p-2 bg-[#f85149]/10 border border-[#f85149]/20 rounded-md">
            <p className="text-xs text-[#f85149]">{error}</p>
            <button 
              onClick={fetchProjects}
              className="mt-1.5 px-2 py-1 bg-[#f85149]/20 hover:bg-[#f85149]/30 text-[#f85149] text-xs rounded transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-6">
            <div className="w-10 h-10 mx-auto mb-3 bg-[#161b22] rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-[#7d8590]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
              </svg>
            </div>
            <h4 className="text-sm font-medium text-[#e6edf3] mb-2">No Projects</h4>
            <p className="text-xs text-[#7d8590]">
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
                className="w-full px-2.5 py-1.5 bg-input border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring focus:border-transparent"
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
              <div className="p-2 bg-secondary rounded-md border border-border">
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
                        className="w-full text-left p-2 bg-muted/50 hover:bg-muted rounded-md transition-all duration-200 border border-border hover:border-accent"
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
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all duration-200 font-medium text-sm"
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
                    Open Kanban
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        </div>
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