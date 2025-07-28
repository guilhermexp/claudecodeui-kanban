import { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Navbar } from '../components/vibe-kanban/layout/navbar';
import { Projects } from '../pages/vibe-kanban/projects.tsx';
import { ProjectTasks } from '../pages/vibe-kanban/project-tasks.tsx';
import { Settings } from '../pages/vibe-kanban/Settings.tsx';
import { McpServers } from '../pages/vibe-kanban/McpServers.tsx';
import { VibeChat } from '../pages/vibe-kanban/vibe-chat.tsx';
import { DisclaimerDialog } from '../components/vibe-kanban/DisclaimerDialog';
import { OnboardingDialog } from '../components/vibe-kanban/OnboardingDialog';
import { PrivacyOptInDialog } from '../components/vibe-kanban/PrivacyOptInDialog';
import { ConfigProvider, useConfig } from '../components/vibe-kanban/config-provider';
import { ThemeProvider } from '../components/vibe-kanban/theme-provider';
import { Loader } from '../components/vibe-kanban/ui/loader';
import { GitHubLoginDialog } from '../components/vibe-kanban/GitHubLoginDialog';
import { configApi } from '../lib/vibe-kanban/api';
import { useTheme as useClaudeTheme } from '../contexts/ThemeContext';

function AppContent() {
  const { config, updateConfig, loading } = useConfig();
  const { isDarkMode } = useClaudeTheme(); // Get theme from Claude Code UI
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPrivacyOptIn, setShowPrivacyOptIn] = useState(false);
  const [showGitHubLogin, setShowGitHubLogin] = useState(false);
  const showNavbar = true;

  useEffect(() => {
    if (config) {
      setShowDisclaimer(!config.disclaimer_acknowledged);
      if (config.disclaimer_acknowledged) {
        setShowOnboarding(!config.onboarding_acknowledged);
        if (config.onboarding_acknowledged) {
          if (!config.github_login_acknowledged) {
            setShowGitHubLogin(true);
          } else if (!config.telemetry_acknowledged) {
            setShowPrivacyOptIn(true);
          }
        }
      }
    }
  }, [config]);

  const handleDisclaimerAccept = async () => {
    if (!config) return;

    updateConfig({ disclaimer_acknowledged: true });

    try {
      await configApi.saveConfig({ ...config, disclaimer_acknowledged: true });
      setShowDisclaimer(false);
      setShowOnboarding(!config.onboarding_acknowledged);
    } catch (err) {
      console.error('Error saving config:', err);
    }
  };

  const handleOnboardingComplete = async (onboardingConfig) => {
    if (!config) return;

    const updatedConfig = {
      ...config,
      onboarding_acknowledged: true,
      executor: onboardingConfig.executor,
      editor: onboardingConfig.editor,
    };

    updateConfig(updatedConfig);

    try {
      await configApi.saveConfig(updatedConfig);
      setShowOnboarding(false);
    } catch (err) {
      console.error('Error saving config:', err);
    }
  };

  const handlePrivacyOptInComplete = async (telemetryEnabled) => {
    if (!config) return;

    const updatedConfig = {
      ...config,
      telemetry_acknowledged: true,
      analytics_enabled: telemetryEnabled,
    };

    updateConfig(updatedConfig);

    try {
      await configApi.saveConfig(updatedConfig);
      setShowPrivacyOptIn(false);
    } catch (err) {
      console.error('Error saving config:', err);
    }
  };

  const handleGitHubLoginComplete = async () => {
    try {
      // Refresh the config to get the latest GitHub authentication state
      const latestConfig = await configApi.getConfig();
      updateConfig(latestConfig);
      setShowGitHubLogin(false);

      // If user skipped (no GitHub token), we need to manually set the acknowledgment
      const updatedConfig = {
        ...latestConfig,
        github_login_acknowledged: true,
      };
      updateConfig(updatedConfig);
      await configApi.saveConfig(updatedConfig);
    } catch (err) {
      console.error('Error refreshing config:', err);
    } finally {
      if (!config?.telemetry_acknowledged) {
        setShowPrivacyOptIn(true);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader message="Loading VibeKanban..." size={32} />
      </div>
    );
  }

  return (
    <ThemeProvider initialTheme={isDarkMode ? 'dark' : 'light'}>
      <div className="min-h-screen flex flex-col bg-background">
        <GitHubLoginDialog
          open={showGitHubLogin}
          onOpenChange={handleGitHubLoginComplete}
        />
        <DisclaimerDialog
          open={showDisclaimer}
          onAccept={handleDisclaimerAccept}
        />
        <OnboardingDialog
          open={showOnboarding}
          onComplete={handleOnboardingComplete}
        />
        <PrivacyOptInDialog
          open={showPrivacyOptIn}
          onComplete={handlePrivacyOptInComplete}
        />
        {showNavbar && <Navbar />}
        <div className="flex-1 overflow-y-auto pb-safe">
          <Routes>
            <Route path="/" element={<VibeChat />} />
            <Route path="/chat" element={<VibeChat />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:projectId" element={<Projects />} />
            <Route
              path="/projects/:projectId/tasks"
              element={<ProjectTasks />}
            />
            <Route
              path="/projects/:projectId/tasks/:taskId"
              element={<ProjectTasks />}
            />
            <Route path="/settings" element={<Settings />} />
            <Route path="/mcp-servers" element={<McpServers />} />
          </Routes>
        </div>
      </div>
    </ThemeProvider>
  );
}

function VibeKanbanApp() {
  return (
    <ConfigProvider>
      <AppContent />
    </ConfigProvider>
  );
}

export default VibeKanbanApp;