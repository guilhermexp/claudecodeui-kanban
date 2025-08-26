import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { projectsApi } from '../../lib/vibe-kanban/api';
import { Project } from '../../lib/vibe-kanban/shared-types';
import { Loader } from './ui/loader';

export function AutoRedirectToProject() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const result = await projectsApi.getAll();
        setProjects(result);
        
        if (result.length > 0) {
          // Redireciona para o primeiro projeto disponível
          const firstProject = result[0];
          navigate(`/vibe-kanban/projects/${firstProject.id}/tasks`, { replace: true });
        } else {
          // Se não houver projetos, vai para a tela de criação de projetos
          navigate('/vibe-kanban/projects', { replace: true });
        }
      } catch (error) {
        console.error('Error fetching projects:', error);
        // Em caso de erro, vai para a tela de projetos
        navigate('/vibe-kanban/projects', { replace: true });
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader message="Loading vibeclaude..." size={32} />
      </div>
    );
  }

  // Se não há projetos, mostra uma mensagem
  if (projects.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground mb-2">No projects found</h2>
          <p className="text-muted-foreground">Redirecting to project creation...</p>
        </div>
      </div>
    );
  }

  return null;
}