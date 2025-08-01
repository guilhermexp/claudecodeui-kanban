import { useCallback, useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/vibe-kanban/ui/card';
import { Button } from '../../components/vibe-kanban/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/vibe-kanban/ui/select';
import { Label } from '../../components/vibe-kanban/ui/label';
import { Alert, AlertDescription } from '../../components/vibe-kanban/ui/alert';
import { Checkbox } from '../../components/vibe-kanban/ui/checkbox';
import { Input } from '../../components/vibe-kanban/ui/input';
import { Key, Loader2, Volume2, Server, Plus, Play, Settings as SettingsIcon, Edit3, Trash2, X, Terminal, Globe, Zap } from 'lucide-react';
import type { EditorType, SoundFile } from '../../lib/vibe-kanban/shared-types';
import { cn } from '../../lib/vibe-kanban/utils';
import {
  EDITOR_LABELS,
  EDITOR_TYPES,
  EXECUTOR_LABELS,
  EXECUTOR_TYPES,
  SOUND_FILES,
  SOUND_LABELS,
} from '../../lib/vibe-kanban/shared-types';
import { useConfig } from '../../components/vibe-kanban/config-provider';
import { GitHubLoginDialog } from '../../components/vibe-kanban/GitHubLoginDialog';
import { TaskTemplateManager } from '../../components/vibe-kanban/TaskTemplateManager';

export function Settings() {
  const { config, updateConfig, saveConfig, loading, updateAndSaveConfig } =
    useConfig();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showGitHubLogin, setShowGitHubLogin] = useState(false);
  
  // MCP Server states
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [showMcpForm, setShowMcpForm] = useState(false);
  const [editingMcpServer, setEditingMcpServer] = useState<any>(null);
  const [mcpFormData, setMcpFormData] = useState({
    name: '',
    type: 'stdio',
    scope: 'user',
    config: {
      command: '',
      args: [] as string[],
      env: {} as Record<string, string>,
      url: '',
      headers: {} as Record<string, string>,
      timeout: 30000
    }
  });
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpTestResults, setMcpTestResults] = useState<Record<string, any>>({});

  const playSound = async (soundFile: SoundFile) => {
    const audio = new Audio(`/api/sounds/${soundFile}.wav`);
    try {
      await audio.play();
    } catch (err) {
      console.error('Failed to play sound:', err);
    }
  };

  const handleSave = async () => {
    if (!config) return;

    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      // Save the main configuration
      const success = await saveConfig();

      if (success) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      } else {
        setError('Failed to save configuration');
      }
    } catch (err) {
      setError('Failed to save configuration');
      console.error('Error saving config:', err);
    } finally {
      setSaving(false);
    }
  };

  const resetDisclaimer = async () => {
    if (!config) return;

    updateConfig({ disclaimer_acknowledged: false });
  };

  const resetOnboarding = async () => {
    if (!config) return;

    updateConfig({ onboarding_acknowledged: false });
  };

  // MCP Server functions
  const fetchMcpServers = async () => {
    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/mcp/servers?scope=user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMcpServers(data.servers || []);
      }
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
    }
  };

  const handleMcpTest = async (serverId: string) => {
    try {
      const token = localStorage.getItem('auth-token');
      setMcpTestResults({ ...mcpTestResults, [serverId]: { loading: true } });
      
      const response = await fetch(`/api/mcp/servers/${serverId}/test?scope=user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setMcpTestResults({ ...mcpTestResults, [serverId]: data.testResult });
      }
    } catch (error) {
      setMcpTestResults({ 
        ...mcpTestResults, 
        [serverId]: { 
          success: false, 
          message: 'Test failed',
          details: []
        } 
      });
    }
  };

  const handleMcpDelete = async (serverId: string) => {
    if (!confirm('Are you sure you want to delete this MCP server?')) return;
    
    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch(`/api/mcp/cli/remove/${serverId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await fetchMcpServers();
      }
    } catch (error) {
      console.error('Error deleting MCP server:', error);
    }
  };

  useEffect(() => {
    fetchMcpServers();
  }, []);

  const isAuthenticated = !!(config?.github?.username && config?.github?.token);

  const handleLogout = useCallback(async () => {
    if (!config) return;
    updateAndSaveConfig({
      github: {
        ...config.github,
        token: null,
        username: null,
        primary_email: null,
      },
    });
  }, [config, updateAndSaveConfig]);

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Loading settings...</span>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertDescription>Failed to load settings. {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Configure your preferences and application settings.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
            <AlertDescription className="font-medium">
              ✓ Settings saved successfully!
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Appearance</CardTitle>
              <CardDescription className="text-sm">
                Theme is synchronized with Claude Code UI.
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <p className="text-sm text-muted-foreground">
                To change between light and dark mode, use the theme toggle in the Claude Code UI interface.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Task Execution</CardTitle>
              <CardDescription className="text-sm">
                Configure how tasks are executed and processed.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <div className="space-y-2">
                <Label htmlFor="executor" className="text-sm sm:text-base">Default Executor</Label>
                <Select
                  value={config.executor.type}
                  onValueChange={(value: 'echo' | 'claude' | 'amp') =>
                    updateConfig({ executor: { type: value } })
                  }
                >
                  <SelectTrigger id="executor">
                    <SelectValue placeholder="Select executor" />
                  </SelectTrigger>
                  <SelectContent>
                    {EXECUTOR_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {EXECUTOR_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Choose the default executor for running tasks.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Editor</CardTitle>
              <CardDescription className="text-sm">
                Configure which editor to open when viewing task attempts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <div className="space-y-2">
                <Label htmlFor="editor">Preferred Editor</Label>
                <Select
                  value={config.editor.editor_type}
                  onValueChange={(value: EditorType) =>
                    updateConfig({
                      editor: {
                        ...config.editor,
                        editor_type: value,
                        custom_command:
                          value === 'custom'
                            ? config.editor.custom_command
                            : null,
                      },
                    })
                  }
                >
                  <SelectTrigger id="editor">
                    <SelectValue placeholder="Select editor" />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITOR_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {EDITOR_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  Choose your preferred code editor for opening task attempts.
                </p>
              </div>

              {config.editor.editor_type === 'custom' && (
                <div className="space-y-2">
                  <Label htmlFor="custom-command">Custom Command</Label>
                  <Input
                    id="custom-command"
                    placeholder="e.g., code, subl, vim"
                    value={config.editor.custom_command || ''}
                    onChange={(e) =>
                      updateConfig({
                        editor: {
                          ...config.editor,
                          custom_command: e.target.value || null,
                        },
                      })
                    }
                  />
                  <p className="text-sm text-muted-foreground">
                    Enter the command to run your custom editor. Use spaces for
                    arguments (e.g., "code --wait").
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Key className="h-4 w-4 sm:h-5 sm:w-5" />
                GitHub Integration
              </CardTitle>
              <CardDescription className="text-sm">
                Configure GitHub settings for creating pull requests from task
                attempts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <div className="space-y-2">
                <Label htmlFor="github-token">Personal Access Token</Label>
                <Input
                  id="github-token"
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={config.github.pat || ''}
                  onChange={(e) =>
                    updateConfig({
                      github: {
                        ...config.github,
                        pat: e.target.value || null,
                      },
                    })
                  }
                />
                <p className="text-xs sm:text-sm text-muted-foreground">
                  GitHub Personal Access Token with 'repo' permissions. Required
                  for creating pull requests.{' '}
                  <a
                    href="https://github.com/settings/tokens"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Create token here
                  </a>
                </p>
              </div>
              {config && isAuthenticated ? (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <Label className="text-sm">Signed in as</Label>
                    <div className="text-base sm:text-lg font-mono">
                      {config.github.username}
                    </div>
                  </div>
                  <Button variant="outline" onClick={handleLogout} className="w-full sm:w-auto">
                    Log out
                  </Button>
                </div>
              ) : (
                <Button onClick={() => setShowGitHubLogin(true)} className="w-full sm:w-auto">
                  Sign in with GitHub
                </Button>
              )}
              <GitHubLoginDialog
                open={showGitHubLogin}
                onOpenChange={setShowGitHubLogin}
              />
              <div className="space-y-2 pt-4">
                <Label htmlFor="default-pr-base">Default PR Base Branch</Label>
                <Input
                  id="default-pr-base"
                  placeholder="main"
                  value={config.github.default_pr_base || ''}
                  onChange={(e) =>
                    updateConfig({
                      github: {
                        ...config.github,
                        default_pr_base: e.target.value || null,
                      },
                    })
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Default base branch for pull requests. Defaults to 'main' if
                  not specified.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Notifications</CardTitle>
              <CardDescription className="text-sm">
                Configure how you receive notifications about task completion.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="sound-alerts"
                  checked={config.sound_alerts}
                  onCheckedChange={(checked: boolean) =>
                    updateConfig({ sound_alerts: checked })
                  }
                />
                <div className="space-y-0.5">
                  <Label htmlFor="sound-alerts" className="cursor-pointer">
                    Sound Alerts
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Play a sound when task attempts finish running.
                  </p>
                </div>
              </div>

              {config.sound_alerts && (
                <div className="space-y-2 ml-6">
                  <Label htmlFor="sound-file">Sound</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      value={config.sound_file}
                      onValueChange={(value: SoundFile) =>
                        updateConfig({ sound_file: value })
                      }
                    >
                      <SelectTrigger id="sound-file" className="flex-1">
                        <SelectValue placeholder="Select sound" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOUND_FILES.map((soundFile) => (
                          <SelectItem key={soundFile} value={soundFile}>
                            {SOUND_LABELS[soundFile]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => playSound(config.sound_file)}
                      className="px-3"
                    >
                      <Volume2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Choose the sound to play when tasks complete. Click the
                    volume button to preview.
                  </p>
                </div>
              )}
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="push-notifications"
                  checked={config.push_notifications}
                  onCheckedChange={(checked: boolean) =>
                    updateConfig({ push_notifications: checked })
                  }
                />
                <div className="space-y-0.5">
                  <Label
                    htmlFor="push-notifications"
                    className="cursor-pointer"
                  >
                    Push Notifications
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Show system notifications when task attempts finish running.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Privacy</CardTitle>
              <CardDescription className="text-sm">
                Help improve Vibe-Kanban by sharing anonymous usage data.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 px-4 sm:px-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="analytics-enabled"
                  checked={config.analytics_enabled ?? false}
                  onCheckedChange={(checked: boolean) =>
                    updateConfig({ analytics_enabled: checked })
                  }
                />
                <div className="space-y-0.5">
                  <Label htmlFor="analytics-enabled" className="cursor-pointer">
                    Enable Telemetry
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Enables anonymous usage events tracking to help improve the
                    application. No prompts or project information are
                    collected.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Task Templates</CardTitle>
              <CardDescription className="text-sm">
                Manage global task templates that can be used across all
                projects.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TaskTemplateManager isGlobal={true} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Server className="w-5 h-5" />
                MCP Servers
              </CardTitle>
              <CardDescription className="text-sm">
                Model Context Protocol servers provide additional tools and data sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setEditingMcpServer(null);
                    setShowMcpForm(true);
                  }}
                  size="sm"
                  className="bg-muted hover:bg-muted/80"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add MCP Server
                </Button>
              </div>

              {mcpServers.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No MCP servers configured
                </div>
              ) : (
                <div className="space-y-2">
                  {mcpServers.map((server) => (
                    <div key={server.id} className="bg-muted/50 border border-border rounded-2xl p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {server.type === 'stdio' ? <Terminal className="w-4 h-4" /> :
                             server.type === 'sse' ? <Zap className="w-4 h-4" /> :
                             <Globe className="w-4 h-4" />}
                            <span className="font-medium">{server.name}</span>
                            <span className="text-xs bg-muted px-2 py-0.5 rounded-2xl">
                              {server.type}
                            </span>
                          </div>
                          <div className="text-sm text-muted-foreground space-y-1">
                            {server.type === 'stdio' && server.config.command && (
                              <div>Command: <code className="bg-muted px-1 rounded text-xs">{server.config.command}</code></div>
                            )}
                            {(server.type === 'sse' || server.type === 'http') && server.config.url && (
                              <div>URL: <code className="bg-muted px-1 rounded text-xs">{server.config.url}</code></div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleMcpTest(server.id)}
                            variant="ghost"
                            size="sm"
                            title="Test connection"
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              setEditingMcpServer(server);
                              setMcpFormData({
                                name: server.name,
                                type: server.type,
                                scope: server.scope,
                                config: { ...server.config }
                              });
                              setShowMcpForm(true);
                            }}
                            variant="ghost"
                            size="sm"
                          >
                            <Edit3 className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => handleMcpDelete(server.id)}
                            variant="ghost"
                            size="sm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      {mcpTestResults[server.id] && (
                        <div className={`mt-2 p-2 rounded-2xl text-xs ${
                          mcpTestResults[server.id].success 
                            ? 'bg-muted/50 text-muted-foreground border border-border' 
                            : 'bg-muted/50 text-muted-foreground border border-border'
                        }`}>
                          <div className="font-medium">{mcpTestResults[server.id].message}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg sm:text-xl">Safety & Disclaimers</CardTitle>
              <CardDescription className="text-sm">
                Manage safety warnings and acknowledgments.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Disclaimer Status</Label>
                    <p className="text-sm text-muted-foreground">
                      {config.disclaimer_acknowledged
                        ? 'You have acknowledged the safety disclaimer.'
                        : 'The safety disclaimer has not been acknowledged.'}
                    </p>
                  </div>
                  <Button
                    onClick={resetDisclaimer}
                    variant="outline"
                    size="sm"
                    disabled={!config.disclaimer_acknowledged}
                  >
                    Reset Disclaimer
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Resetting the disclaimer will require you to acknowledge the
                  safety warning again.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Onboarding Status</Label>
                    <p className="text-sm text-muted-foreground">
                      {config.onboarding_acknowledged
                        ? 'You have completed the onboarding process.'
                        : 'The onboarding process has not been completed.'}
                    </p>
                  </div>
                  <Button
                    onClick={resetOnboarding}
                    variant="outline"
                    size="sm"
                    disabled={!config.onboarding_acknowledged}
                  >
                    Reset Onboarding
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Resetting the onboarding will show the setup screen again.
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Telemetry Acknowledgment</Label>
                    <p className="text-sm text-muted-foreground">
                      {config.telemetry_acknowledged
                        ? 'You have acknowledged the telemetry notice.'
                        : 'The telemetry notice has not been acknowledged.'}
                    </p>
                  </div>
                  <Button
                    onClick={() =>
                      updateConfig({ telemetry_acknowledged: false })
                    }
                    variant="outline"
                    size="sm"
                    disabled={!config.telemetry_acknowledged}
                  >
                    Reset Acknowledgment
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Resetting the acknowledgment will require you to acknowledge
                  the telemetry notice again.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sticky save button */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-3 sm:p-4 z-10">
          <div className="container mx-auto max-w-4xl flex justify-end px-3 sm:px-4">
            <Button
              onClick={handleSave}
              disabled={saving || success}
              className={cn(
                "w-full sm:w-auto",
                success ? 'bg-green-600 hover:bg-green-700' : ''
              )}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {success && <span className="mr-2">✓</span>}
              {success ? 'Settings Saved!' : 'Save Settings'}
            </Button>
          </div>
        </div>

        {/* Spacer to prevent content from being hidden behind sticky button */}
        <div className="h-20"></div>
      </div>

      {/* MCP Server Form Modal */}
      {showMcpForm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="text-lg font-medium">
                {editingMcpServer ? 'Edit MCP Server' : 'Add MCP Server'}
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => {
                  setShowMcpForm(false);
                  setEditingMcpServer(null);
                  setMcpFormData({
                    name: '',
                    type: 'stdio',
                    scope: 'user',
                    config: {
                      command: '',
                      args: [],
                      env: {},
                      url: '',
                      headers: {},
                      timeout: 30000
                    }
                  });
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <form onSubmit={async (e) => {
              e.preventDefault();
              setMcpLoading(true);
              
              try {
                const token = localStorage.getItem('auth-token');
                const response = await fetch('/api/mcp/cli/add', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    name: mcpFormData.name,
                    type: mcpFormData.type,
                    command: mcpFormData.config?.command,
                    args: mcpFormData.config?.args || [],
                    url: mcpFormData.config?.url,
                    headers: mcpFormData.config?.headers || {},
                    env: mcpFormData.config?.env || {}
                  })
                });
                
                if (response.ok) {
                  await fetchMcpServers();
                  setShowMcpForm(false);
                }
              } catch (error) {
                console.error('Error saving MCP server:', error);
              } finally {
                setMcpLoading(false);
              }
            }} className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Server Name *</Label>
                  <Input
                    value={mcpFormData.name}
                    onChange={(e) => setMcpFormData(prev => ({...prev, name: e.target.value}))}
                    placeholder="my-server"
                    required
                  />
                </div>
                
                <div>
                  <Label>Transport Type *</Label>
                  <Select 
                    value={mcpFormData.type} 
                    onValueChange={(value) => setMcpFormData(prev => ({...prev, type: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stdio">stdio</SelectItem>
                      <SelectItem value="sse">SSE</SelectItem>
                      <SelectItem value="http">HTTP</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {mcpFormData.type === 'stdio' && (
                <div className="space-y-4">
                  <div>
                    <Label>Command *</Label>
                    <Input
                      value={mcpFormData.config.command}
                      onChange={(e) => setMcpFormData(prev => ({
                        ...prev,
                        config: { ...prev.config, command: e.target.value }
                      }))}
                      placeholder="/path/to/mcp-server"
                      required
                    />
                  </div>
                  
                  <div>
                    <Label>Arguments (one per line)</Label>
                    <textarea
                      value={mcpFormData.config.args?.join('\n') || ''}
                      onChange={(e) => setMcpFormData(prev => ({
                        ...prev,
                        config: { ...prev.config, args: e.target.value.split('\n').filter(arg => arg.trim()) }
                      }))}
                      className="w-full px-3 py-2 border border-border bg-background rounded-2xl focus:ring-ring focus:border-ring"
                      rows={3}
                      placeholder="--api-key&#10;abc123"
                    />
                  </div>
                </div>
              )}

              {(mcpFormData.type === 'sse' || mcpFormData.type === 'http') && (
                <div>
                  <Label>URL *</Label>
                  <Input
                    value={mcpFormData.config.url}
                    onChange={(e) => setMcpFormData(prev => ({
                      ...prev,
                      config: { ...prev.config, url: e.target.value }
                    }))}
                    placeholder="https://api.example.com/mcp"
                    type="url"
                    required
                  />
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setShowMcpForm(false)}>
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={mcpLoading}
                  className="bg-muted hover:bg-muted/80"
                >
                  {mcpLoading ? 'Saving...' : (editingMcpServer ? 'Update Server' : 'Add Server')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <GitHubLoginDialog
        open={showGitHubLogin}
        onOpenChange={setShowGitHubLogin}
        onSuccess={() => {
          setShowGitHubLogin(false);
        }}
      />
    </div>
  );
}
