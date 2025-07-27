import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useKanbanKeyboardNavigation,
  useKeyboardShortcuts,
} from '../../../lib/vibe-kanban/keyboard-shortcuts';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Alert, AlertDescription } from '../ui/alert';
import { Project } from '../../../lib/vibe-kanban/shared-types';
import { ProjectForm } from './project-form';
import { projectsApi, tasksApi } from '../../../lib/vibe-kanban/api';
import { AlertCircle, Loader2, Plus } from 'lucide-react';
import ProjectCard from './ProjectCard';

export function ProjectList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [error, setError] = useState('');
  const [focusedProjectId, setFocusedProjectId] = useState<string | null>(null);
  const [focusedColumn, setFocusedColumn] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [projectsWithActiveTasks, setProjectsWithActiveTasks] = useState<Set<string>>(new Set());

  const fetchProjects = async () => {
    setLoading(true);
    setError('');

    try {
      const result = await projectsApi.getAll();
      setProjects(result);
      
      // Fetch tasks for each project to check for active tasks
      const activeProjects = new Set<string>();
      await Promise.all(
        result.map(async (project) => {
          try {
            const tasks = await tasksApi.getAll(project.id);
            // Check if any task has an active status or in-progress attempt
            const hasActive = tasks.some(
              task => task.status === 'inprogress' || task.has_in_progress_attempt
            );
            if (hasActive) {
              activeProjects.add(project.id);
            }
          } catch (error) {
            console.error(`Failed to fetch tasks for project ${project.id}:`, error);
          }
        })
      );
      setProjectsWithActiveTasks(activeProjects);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setError('Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    setEditingProject(null);
    fetchProjects();
  };

  // Group projects by grid columns (3 columns for lg, 2 for md, 1 for sm)
  const getGridColumns = () => {
    const screenWidth = window.innerWidth;
    if (screenWidth >= 1024) return 3; // lg
    if (screenWidth >= 768) return 2; // md
    return 1; // sm
  };

  const groupProjectsByColumns = (projects: Project[], columns: number) => {
    const grouped: Record<string, Project[]> = {};
    for (let i = 0; i < columns; i++) {
      grouped[`column-${i}`] = [];
    }

    projects.forEach((project, index) => {
      const columnIndex = index % columns;
      grouped[`column-${columnIndex}`].push(project);
    });

    return grouped;
  };

  const columns = getGridColumns();
  const groupedProjects = groupProjectsByColumns(projects, columns);
  const allColumnKeys = Object.keys(groupedProjects);

  // Set initial focus when projects are loaded
  useEffect(() => {
    if (projects.length > 0 && !focusedProjectId) {
      setFocusedProjectId(projects[0].id);
      setFocusedColumn('column-0');
    }
  }, [projects, focusedProjectId]);

  const handleViewProjectDetails = (project: Project) => {
    navigate(`/vibe-kanban/projects/${project.id}/tasks`);
  };

  // Setup keyboard navigation
  useKanbanKeyboardNavigation({
    focusedTaskId: focusedProjectId,
    setFocusedTaskId: setFocusedProjectId,
    focusedStatus: focusedColumn,
    setFocusedStatus: setFocusedColumn,
    groupedTasks: groupedProjects,
    filteredTasks: projects,
    allTaskStatuses: allColumnKeys,
    onViewTaskDetails: handleViewProjectDetails,
    preserveIndexOnColumnSwitch: true,
  });

  useKeyboardShortcuts({
    ignoreEscape: true,
    onC: () => setShowForm(true),
    navigate,
    currentPath: '/vibe-kanban/projects',
  });

  // Handle window resize to update column layout
  useEffect(() => {
    const handleResize = () => {
      // Reset focus when layout changes
      if (focusedProjectId && projects.length > 0) {
        const newColumns = getGridColumns();

        // Find which column the focused project should be in
        const focusedProject = projects.find((p) => p.id === focusedProjectId);
        if (focusedProject) {
          const projectIndex = projects.indexOf(focusedProject);
          const newColumnIndex = projectIndex % newColumns;
          setFocusedColumn(`column-${newColumnIndex}`);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [focusedProjectId, projects]);

  useEffect(() => {
    fetchProjects();
    
    // Set up periodic refresh to update active task status every 30 seconds
    const interval = setInterval(() => {
      fetchProjects();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6 lg:p-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Projects</h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Manage your projects and track their progress
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} size={isMobile ? "sm" : "default"}>
          <Plus className="h-4 w-4" />
          <span className="ml-2 hidden sm:inline">Create Project</span>
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <Card className="border-gray-200 dark:border-gray-700">
          <CardContent className="py-8 sm:py-12 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
              <Plus className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900 dark:text-white">No projects yet</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Get started by creating your first project.
            </p>
            <Button className="mt-4" onClick={() => setShowForm(true)} size={isMobile ? "sm" : "default"}>
              <Plus className="h-4 w-4" />
              <span className="ml-2">Create your first project</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              isFocused={focusedProjectId === project.id}
              setError={setError}
              setEditingProject={setEditingProject}
              setShowForm={setShowForm}
              fetchProjects={fetchProjects}
              hasActiveTasks={projectsWithActiveTasks.has(project.id)}
            />
          ))}
        </div>
      )}

      <ProjectForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditingProject(null);
        }}
        onSuccess={handleFormSuccess}
        project={editingProject}
      />
    </div>
  );
}
