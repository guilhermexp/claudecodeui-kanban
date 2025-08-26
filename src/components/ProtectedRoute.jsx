import { useAuth } from '../contexts/AuthContext';
import SetupForm from './SetupForm';
import ModernLoginForm from './ModernLoginForm';

const ProtectedRoute = ({ children }) => {
  const { user, isLoading, needsSetup } = useAuth();

  if (isLoading) {
    return null; // Simple loading state, no visual
  }

  if (needsSetup) {
    return <SetupForm />;
  }

  if (!user) {
    return <ModernLoginForm />;
  }

  return children;
};

export default ProtectedRoute;