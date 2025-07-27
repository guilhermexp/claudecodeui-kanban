import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Badge } from '../ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';
import {
  Calendar,
  Edit,
  ExternalLink,
  FolderOpen,
  MoreHorizontal,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../../../lib/vibe-kanban/api.ts';
import { Project } from '../../../lib/vibe-kanban/shared-types';
import { useEffect, useRef } from 'react';

type Props = {
  project: Project;
  isFocused: boolean;
  fetchProjects: () => void;
  setError: (error: string) => void;
  setEditingProject: (project: Project) => void;
  setShowForm: (show: boolean) => void;
  hasActiveTasks?: boolean;
};

function ProjectCard({
  project,
  isFocused,
  fetchProjects,
  setError,
  setEditingProject,
  setShowForm,
  hasActiveTasks = false,
}: Props) {
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      ref.current.focus();
    }
  }, [isFocused]);

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Are you sure you want to delete "${name}"? This action cannot be undone.`
      )
    )
      return;

    try {
      await projectsApi.delete(id);
      fetchProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
      setError('Failed to delete project');
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleOpenInIDE = async (projectId: string) => {
    try {
      await projectsApi.openEditor(projectId);
    } catch (error) {
      console.error('Failed to open project in IDE:', error);
      setError('Failed to open project in IDE');
    }
  };

  return (
    <Card
      className={`hover:shadow-md transition-all cursor-pointer focus:ring-2 focus:ring-primary outline-none relative ${
        hasActiveTasks ? 'ring-2 ring-green-500 ring-opacity-50 shadow-lg shadow-green-500/20' : ''
      }`}
      onClick={() => navigate(`/vibe-kanban/projects/${project.id}/tasks`)}
      tabIndex={isFocused ? 0 : -1}
      ref={ref}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg">{project.name}</CardTitle>
          <div className="flex items-center gap-2">
            {hasActiveTasks && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5">
                      <div className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                      </div>
                      <Badge className="bg-green-500 hover:bg-green-600 text-white border-green-600">
                        Ativa
                      </Badge>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Este projeto tem tarefas em andamento</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/vibe-kanban/projects/${project.id}`);
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  View Project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenInIDE(project.id);
                  }}
                >
                  <FolderOpen className="mr-2 h-4 w-4" />
                  Open in IDE
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEdit(project);
                  }}
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(project.id, project.name);
                  }}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <CardDescription className="flex items-center">
          <Calendar className="mr-1 h-3 w-3" />
          Created {new Date(project.created_at).toLocaleDateString()}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export default ProjectCard;
