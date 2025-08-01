import React, { useState, useEffect, useCallback } from 'react';
import { projectsApi, tasksApi } from '../lib/vibe-kanban/api';
import { TaskFormDialog } from './vibe-kanban/tasks/TaskFormDialog';
import { ConfigProvider } from './vibe-kanban/config-provider';

function VibeTaskPanel({ isVisible, onClose }) {
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);

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
      console.error('Failed to fetch projects:', err);
      setError('Failed to load projects. Make sure Vibe Kanban backend is running.');
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);

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
      console.error('Failed to create task:', err);
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
      // Could add a success toast here
    } catch (err) {
      console.error('Failed to create and start task:', err);
      setError('Failed to create and start task: ' + (err.message || ''));
    }
  }, [selectedProject]);

  if (!isVisible) {
    return null;
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Vibe Kanban</h3>
            <p className="text-xs text-muted-foreground mt-1">Create tasks quickly</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            title="Close panel"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 space-y-3">
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
              <div className="p-2 bg-muted/30 rounded-md">
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

            {/* Create Task Button */}
            {selectedProject && (
              <div className="space-y-2">
                <button
                  onClick={() => setIsTaskDialogOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-all duration-200 font-medium text-sm"
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
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Open in Vibe Kanban
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
    </div>
  );
}

export default VibeTaskPanel;