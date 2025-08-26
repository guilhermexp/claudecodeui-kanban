import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import SetupForm from './SetupForm';
import ModernLoginForm from './ModernLoginForm';
import { MessageSquare } from 'lucide-react';

const LoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center p-4">
    <div className="text-center">
      <div className="flex justify-center mb-6">
        <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg">
          <img 
            src="/icons/claude-ai-icon.svg" 
            alt="Claude AI" 
            className="w-full h-full object-cover"
          />
        </div>
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-4">vibeclaude</h1>
      <div className="flex items-center justify-center space-x-1 mb-2">
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <p className="text-muted-foreground">Loading...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, isLoading, needsSetup } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
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