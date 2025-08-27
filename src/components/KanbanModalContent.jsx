import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader } from './vibe-kanban/ui/loader';
import TaskKanbanBoard from './vibe-kanban/tasks/TaskKanbanBoard';
import { projectsApi, tasksApi } from '../lib/vibe-kanban/api';
import { Plus } from 'lucide-react';
import { Button } from './vibe-kanban/ui/button';

function KanbanModalContent({ selectedProject, onClose }) {
  const [tasks, setTasks] = useState([]);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedProject?.id) {
      setLoading(false);
      return;
    }

    // Only load if it's a real Vibe project (not temporary)
    if (!selectedProject.id.toString().startsWith('temp-')) {
      loadProjectData();
    } else {
      // For temporary projects, just show empty state
      setTasks([]);
      setProject(selectedProject);
      setLoading(false);
    }
  }, [selectedProject?.id]);

  const loadProjectData = async () => {
    if (!selectedProject?.id) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Load project details
      const projectData = await projectsApi.getById(selectedProject.id);
      setProject(projectData);
      
      // Load tasks
      const tasksData = await tasksApi.getProjectTasks(selectedProject.id);
      setTasks(tasksData || []);
    } catch (err) {
      console.error('Error loading project data:', err);
      setError('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const taskId = active.id;
    const newStatus = over.id;

    // Optimistic update
    setTasks(prev => prev.map(task => 
      task.id === taskId ? { ...task, status: newStatus } : task
    ));

    try {
      await tasksApi.updateTask(taskId, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task status:', err);
      // Revert on error
      loadProjectData();
    }
  };

  const handleEditTask = (task) => {
    // Navigate to task details or open edit dialog
    navigate(`/vibe-kanban/projects/${selectedProject.id}/tasks/${task.id}`);
    onClose();
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    
    try {
      await tasksApi.deleteTask(taskId);
      setTasks(prev => prev.filter(t => t.id !== taskId));
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleViewTaskDetails = (task) => {
    navigate(`/vibe-kanban/projects/${selectedProject.id}/tasks/${task.id}`);
    onClose();
  };

  const handleAddTask = () => {
    navigate(`/vibe-kanban/projects/${selectedProject.id}`);
    onClose();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader className="w-8 h-8" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <p>{error}</p>
      </div>
    );
  }

  if (!selectedProject?.id) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-muted-foreground">
        <p>No project selected</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      {/* Header with Add Task button */}
      <div className="flex justify-between items-center mb-4 px-4">
        <h3 className="text-lg font-semibold">
          {project?.name || selectedProject.displayName || selectedProject.name}
        </h3>
        <Button
          size="sm"
          onClick={handleAddTask}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      {/* Kanban Board */}
      <div className="px-4 pb-4">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-muted-foreground mb-4">No tasks found for this project.</p>
            <Button onClick={handleAddTask} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Create First Task
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[900px] max-w-[1400px]">
              <TaskKanbanBoard
                tasks={tasks}
                onDragEnd={handleDragEnd}
                onEditTask={handleEditTask}
                onDeleteTask={handleDeleteTask}
                onViewTaskDetails={handleViewTaskDetails}
                isPanelOpen={false}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default KanbanModalContent;