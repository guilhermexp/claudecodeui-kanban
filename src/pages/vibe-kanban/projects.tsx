import { useParams, useNavigate } from 'react-router-dom';
import { ProjectList } from '../../components/vibe-kanban/projects/project-list';
import { ProjectDetail } from '../../components/vibe-kanban/projects/project-detail';

export function Projects() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const handleBack = () => {
    navigate('/vibe-kanban/projects');
  };

  if (projectId) {
    return <ProjectDetail projectId={projectId} onBack={handleBack} />;
  }

  return <ProjectList />;
}
