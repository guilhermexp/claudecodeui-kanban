import { useState, useEffect } from 'react';
import { X, Settings, Volume2, Key, Loader2, Server, Plus, Play, Edit3, Trash2, Terminal, Globe, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { useConfig } from './config-provider';
import { EDITOR_LABELS, EDITOR_TYPES, EXECUTOR_LABELS, EXECUTOR_TYPES, SOUND_FILES, SOUND_LABELS } from '../../lib/vibe-kanban/shared-types';
import type { EditorType, SoundFile } from '../../lib/vibe-kanban/shared-types';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { config, updateConfig, saveConfig, loading } = useConfig();
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('mcp');
  
  // MCP Server states
  const [mcpServers, setMcpServers] = useState<any[]>([]);
  const [mcpLoading, setMcpLoading] = useState(false);
  const [mcpTestResults, setMcpTestResults] = useState<Record<string, any>>({});
  
  // Claude Hooks states
  const [hooksConfig, setHooksConfig] = useState<any>(null);
  const [availableSounds, setAvailableSounds] = useState<any>({ system: [], custom: [] });
  const [hooksLoading, setHooksLoading] = useState(false);

  if (!open) return null;

  const playSound = async (soundFile: SoundFile) => {
    const audio = new Audio(`/api/sounds/${soundFile}.wav`);
    try {
      await audio.play();
    } catch (err) {
      console.error('Failed to play sound:', err);
    }
  };

  // MCP Server functions
  const fetchMcpServers = async () => {
    setMcpLoading(true);
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
        
        // Auto-test all servers to check their status
        if (data.servers && data.servers.length > 0) {
          data.servers.forEach((server: any) => {
            handleMcpTest(server.id);
          });
        }
      }
    } catch (error) {
      console.error('Error fetching MCP servers:', error);
    } finally {
      setMcpLoading(false);
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
        await fetchMcpServers(); // Refresh the list after deletion
      }
    } catch (error) {
      console.error('Error deleting MCP server:', error);
    }
  };

  // Claude Hooks functions
  const fetchHooksConfig = async () => {
    setHooksLoading(true);
    try {
      const token = localStorage.getItem('auth-token');
      
      // Fetch config and available sounds
      const [configResponse, soundsResponse] = await Promise.all([
        fetch('/api/claude-hooks/config', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/claude-hooks/sounds', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);
      
      if (configResponse.ok) {
        const configData = await configResponse.json();
        setHooksConfig(configData.config);
      }
      
      if (soundsResponse.ok) {
        const soundsData = await soundsResponse.json();
        setAvailableSounds(soundsData.sounds);
      }
      
    } catch (error) {
      console.error('Error fetching hooks config:', error);
    } finally {
      setHooksLoading(false);
    }
  };

  const handleHooksToggle = async (enabled: boolean) => {
    try {
      const token = localStorage.getItem('auth-token');
      
      if (enabled) {
        const response = await fetch('/api/claude-hooks/setup', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            soundType: 'system',
            soundName: 'Glass',
            enableStopHook: true,
            enableNotificationHook: true,
            includeVisualNotification: true
          })
        });
        
        if (response.ok) {
          await fetchHooksConfig();
        }
      } else {
        const response = await fetch('/api/claude-hooks/remove', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          await fetchHooksConfig();
        }
      }
    } catch (error) {
      console.error('Error toggling hooks:', error);
    }
  };

  const handleTestHookSound = async (soundType: string, soundName: string) => {
    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/claude-hooks/test-sound', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ soundType, soundName })
      });
      
      const data = await response.json();
      if (!data.success) {
        console.error('Error testing sound:', data.error);
      }
    } catch (error) {
      console.error('Error testing hook sound:', error);
    }
  };

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await saveConfig();
      onClose();
    } catch (err) {
      console.error('Error saving config:', err);
    } finally {
      setSaving(false);
    }
  };

  // Fetch MCP servers when modal opens and set up auto-refresh
  useEffect(() => {
    if (open) {
      fetchMcpServers();
      fetchHooksConfig();
      
      // Set up auto-refresh every 3 seconds for MCP servers
      const interval = setInterval(() => {
        fetchMcpServers();
      }, 3000);
      
      return () => clearInterval(interval);
    }
  }, [open]);

  if (loading || !config) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-card border border-border rounded-lg p-6">
          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-lg w-full max-w-2xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            <h2 className="text-lg font-semibold">Settings</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="border-b border-border">
          <div className="flex">
            {[
              { id: 'tools', label: 'Tools', icon: Settings },
              { id: 'mcp', label: 'MCP Servers', icon: Server },
              { id: 'claude-hooks', label: 'Claude Hooks', icon: Volume2 }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Tools Tab */}
          {activeTab === 'tools' && (
            <div className="space-y-4">
              {/* Task Execution */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Default Executor</Label>
                <Select
                  value={config.executor.type}
                  onValueChange={(value: 'echo' | 'claude' | 'amp') =>
                    updateConfig({ executor: { type: value } })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXECUTOR_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {EXECUTOR_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Editor */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Preferred Editor</Label>
                <Select
                  value={config.editor.editor_type}
                  onValueChange={(value: EditorType) =>
                    updateConfig({
                      editor: {
                        ...config.editor,
                        editor_type: value,
                        custom_command: value === 'custom' ? config.editor.custom_command : null,
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EDITOR_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {EDITOR_LABELS[type]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {config.editor.editor_type === 'custom' && (
                  <Input
                    placeholder="Custom command (e.g., code, subl)"
                    value={config.editor.custom_command || ''}
                    onChange={(e) =>
                      updateConfig({
                        editor: {
                          ...config.editor,
                          custom_command: e.target.value || null,
                        },
                      })
                    }
                    className="h-9 text-sm"
                  />
                )}
              </div>

              {/* GitHub Token */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1">
                  <Key className="w-3 h-3" />
                  GitHub Token
                </Label>
                <Input
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
                  className="h-9 text-sm"
                />
              </div>

              {/* Notifications */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="sound-alerts"
                    checked={config.sound_alerts}
                    onCheckedChange={(checked: boolean) =>
                      updateConfig({ sound_alerts: checked })
                    }
                  />
                  <Label htmlFor="sound-alerts" className="text-sm cursor-pointer">
                    Sound alerts
                  </Label>
                </div>

                {config.sound_alerts && (
                  <div className="flex items-center gap-2 ml-6">
                    <Select
                      value={config.sound_file}
                      onValueChange={(value: SoundFile) =>
                        updateConfig({ sound_file: value })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm flex-1">
                        <SelectValue />
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
                      variant="ghost"
                      size="sm"
                      onClick={() => playSound(config.sound_file)}
                      className="h-8 w-8 p-0"
                    >
                      <Volume2 className="h-3 w-3" />
                    </Button>
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
                  <Label htmlFor="push-notifications" className="text-sm cursor-pointer">
                    Push notifications
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="analytics-enabled"
                    checked={config.analytics_enabled ?? false}
                    onCheckedChange={(checked: boolean) =>
                      updateConfig({ analytics_enabled: checked })
                    }
                  />
                  <Label htmlFor="analytics-enabled" className="text-sm cursor-pointer">
                    Anonymous analytics
                  </Label>
                </div>
              </div>
            </div>
          )}

          {/* MCP Servers Tab */}
          {activeTab === 'mcp' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <Server className="w-4 h-4" />
                    MCP Servers
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Model Context Protocol servers provide additional tools and data sources
                  </p>
                </div>
              </div>

              {mcpLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading MCP servers...
                </div>
              ) : mcpServers.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground text-sm">
                  No MCP servers configured
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {mcpServers.map((server) => (
                    <div key={server.id} className="bg-muted/30 border border-border rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {server.type === 'stdio' ? <Terminal className="w-3 h-3" /> :
                             server.type === 'sse' ? <Zap className="w-3 h-3" /> :
                             <Globe className="w-3 h-3" />}
                            <span className="font-medium text-sm truncate">{server.name}</span>
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                              {server.type}
                            </span>
                            {/* Status indicator */}
                            <div 
                              className={`w-2 h-2 rounded-full ${
                                mcpTestResults[server.id]?.success === true ? 'bg-green-500' :
                                mcpTestResults[server.id]?.success === false ? 'bg-red-500' :
                                'bg-gray-400'
                              }`} 
                              title={
                                mcpTestResults[server.id]?.success === true ? 'Active' :
                                mcpTestResults[server.id]?.success === false ? 'Inactive' :
                                'Unknown'
                              } 
                            />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {server.type === 'stdio' && server.config.command && (
                              <div className="truncate">Command: <code className="bg-muted px-1 rounded">{server.config.command}</code></div>
                            )}
                            {(server.type === 'sse' || server.type === 'http') && server.config.url && (
                              <div className="truncate">URL: <code className="bg-muted px-1 rounded">{server.config.url}</code></div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            onClick={() => handleMcpTest(server.id)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            title="Test connection"
                          >
                            <Play className="w-3 h-3" />
                          </Button>
                          <Button
                            onClick={() => handleMcpDelete(server.id)}
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-red-500 hover:text-red-600"
                            title="Delete server"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                      {mcpTestResults[server.id] && (
                        <div className="mt-2 p-2 rounded text-xs bg-muted/50 text-muted-foreground">
                          <div className="font-medium">{mcpTestResults[server.id].message}</div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Claude Hooks Tab */}
          {activeTab === 'claude-hooks' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium flex items-center gap-2">
                    <Volume2 className="w-4 h-4" />
                    Claude Code Hooks
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Configure native Claude Code CLI hooks for sound notifications when tasks complete
                  </p>
                </div>
              </div>

              {hooksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Loading hooks configuration...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Hooks Status */}
                  <div className="bg-muted/30 border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-3 h-3 rounded-full ${
                            hooksConfig?.stopHook || hooksConfig?.notificationHook ? 'bg-green-500' : 'bg-gray-400'
                          }`}
                        />
                        <span className="font-medium text-sm">
                          Sound Notifications: {hooksConfig?.stopHook || hooksConfig?.notificationHook ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleHooksToggle(!(hooksConfig?.stopHook || hooksConfig?.notificationHook))}
                          className="h-7"
                        >
                          {hooksConfig?.stopHook || hooksConfig?.notificationHook ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </div>
                    
                    {hooksConfig?.currentSound && (
                      <div className="text-xs text-muted-foreground">
                        Current Sound: <code className="bg-muted px-1 rounded">{hooksConfig.currentSound}</code>
                      </div>
                    )}
                  </div>

                  {/* Available Sounds */}
                  {(availableSounds.system.length > 0 || availableSounds.custom.length > 0) && (
                    <div className="space-y-3">
                      <h4 className="text-sm font-medium">Available Sounds</h4>
                      
                      {/* System Sounds */}
                      {availableSounds.system.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-2">System Sounds (macOS)</h5>
                          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                            {availableSounds.system.map((sound: any) => (
                              <div key={sound.name} className="flex items-center justify-between bg-muted/20 rounded p-2">
                                <span className="text-xs truncate">{sound.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTestHookSound('system', sound.name)}
                                  className="h-6 w-6 p-0"
                                  title="Test sound"
                                >
                                  <Play className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Custom Sounds */}
                      {availableSounds.custom.length > 0 && (
                        <div>
                          <h5 className="text-xs font-medium text-muted-foreground mb-2">Custom Sounds</h5>
                          <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                            {availableSounds.custom.map((sound: any) => (
                              <div key={sound.name} className="flex items-center justify-between bg-muted/20 rounded p-2">
                                <span className="text-xs truncate">{sound.name}</span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleTestHookSound('custom', sound.name)}
                                  className="h-6 w-6 p-0"
                                  title="Test sound"
                                >
                                  <Play className="w-3 h-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Hooks Info */}
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <Terminal className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200">How it works</p>
                        <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                          Hooks are configured directly in Claude Code CLI (~/.claude/config.json). 
                          Sound notifications will play whenever Claude completes a task, regardless of which interface you're using.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose} className="h-9">
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="h-9">
            {saving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}