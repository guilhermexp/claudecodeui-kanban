import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { X, Plus, Settings, Shield, AlertTriangle, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

function ToolsSettings({ isOpen, onClose }) {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [allowedTools, setAllowedTools] = useState([]);
  const [disallowedTools, setDisallowedTools] = useState([]);
  const [newAllowedTool, setNewAllowedTool] = useState('');
  const [newDisallowedTool, setNewDisallowedTool] = useState('');
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [projectSortOrder, setProjectSortOrder] = useState('name');
  const [activeTab, setActiveTab] = useState('tools');

  // Common tool patterns
  const commonTools = [
    'Bash(git log:*)',
    'Bash(git diff:*)',
    'Bash(git status:*)',
    'Write',
    'Read',
    'Edit',
    'Glob',
    'Grep',
    'MultiEdit',
    'Task',
    'TodoWrite',
    'TodoRead',
    'WebFetch',
    'WebSearch'
  ];

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      // First try to load from localStorage
      const savedSettings = localStorage.getItem('claude-tools-settings');
      if (savedSettings) {
        const localData = JSON.parse(savedSettings);
        setAllowedTools(localData.allowedTools || []);
        setDisallowedTools(localData.disallowedTools || []);
        setSkipPermissions(localData.skipPermissions || false);
        setProjectSortOrder(localData.projectSortOrder || 'name');
      }
      
      // Then try to load from backend (which may be more up-to-date)
      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setAllowedTools(data.allowedTools || []);
        setDisallowedTools(data.disallowedTools || []);
        setSkipPermissions(data.skipPermissions || false);
        setProjectSortOrder(data.projectSortOrder || 'name');
        
        // Update localStorage with backend data
        localStorage.setItem('claude-tools-settings', JSON.stringify({
          allowedTools: data.allowedTools || [],
          disallowedTools: data.disallowedTools || [],
          skipPermissions: data.skipPermissions || false,
          projectSortOrder: data.projectSortOrder || 'name'
        }));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      // Save to localStorage immediately for components to read
      const settingsData = {
        allowedTools,
        disallowedTools,
        skipPermissions,
        projectSortOrder
      };
      
      localStorage.setItem('claude-tools-settings', JSON.stringify(settingsData));
      
      // Also save to backend
      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(settingsData)
      });
      
      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(null), 2000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const addAllowedTool = () => {
    if (newAllowedTool && !allowedTools.includes(newAllowedTool)) {
      setAllowedTools([...allowedTools, newAllowedTool]);
      setNewAllowedTool('');
    }
  };

  const removeAllowedTool = (tool) => {
    setAllowedTools(allowedTools.filter(t => t !== tool));
  };

  const addDisallowedTool = () => {
    if (newDisallowedTool && !disallowedTools.includes(newDisallowedTool)) {
      setDisallowedTools([...disallowedTools, newDisallowedTool]);
      setNewDisallowedTool('');
    }
  };

  const removeDisallowedTool = (tool) => {
    setDisallowedTools(disallowedTools.filter(t => t !== tool));
  };

  const addCommonTool = (tool) => {
    if (!allowedTools.includes(tool)) {
      setAllowedTools([...allowedTools, tool]);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col h-[calc(90vh-8rem)]">
          {/* Tab Navigation */}
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('tools')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'tools'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Tool Permissions
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'preferences'
                  ? 'border-foreground text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Preferences
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Tools Tab */}
            {activeTab === 'tools' && (
              <div className="space-y-6 md:space-y-8">
                {/* Skip Permissions Toggle */}
                <div className="bg-warning/10 border border-warning/50 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-foreground">Skip Permission Requests</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            When enabled, Claude will execute allowed tools without asking for permission
                          </p>
                        </div>
                        <button
                          onClick={() => setSkipPermissions(!skipPermissions)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            skipPermissions ? 'bg-primary' : 'bg-muted'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              skipPermissions ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Allowed Tools */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Shield className="w-5 h-5 text-green-500" />
                    <h3 className="text-lg font-medium text-foreground">Allowed Tools</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    These tools can be executed without permission when skip permissions is enabled
                  </p>
                  
                  {/* Common Tools */}
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2">Quick add common tools:</p>
                    <div className="flex flex-wrap gap-2">
                      {commonTools.map((tool) => (
                        <button
                          key={tool}
                          onClick={() => addCommonTool(tool)}
                          disabled={allowedTools.includes(tool)}
                          className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {tool}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-2 mb-4">
                    <Input
                      value={newAllowedTool}
                      onChange={(e) => setNewAllowedTool(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addAllowedTool()}
                      placeholder="e.g., Bash(ls:*), Read, Write"
                      className="flex-1"
                    />
                    <Button onClick={addAllowedTool} size="sm">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Tool
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {allowedTools.map((tool) => (
                      <Badge
                        key={tool}
                        variant="secondary"
                        className="py-1 pl-2 pr-1 flex items-center space-x-1"
                      >
                        <span>{tool}</span>
                        <button
                          onClick={() => removeAllowedTool(tool)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    {allowedTools.length === 0 && (
                      <p className="text-sm text-muted-foreground">No allowed tools configured</p>
                    )}
                  </div>
                </div>

                {/* Disallowed Tools */}
                <div>
                  <div className="flex items-center space-x-2 mb-4">
                    <Shield className="w-5 h-5 text-red-500" />
                    <h3 className="text-lg font-medium text-foreground">Disallowed Tools</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    These tools will always require permission, even if skip permissions is enabled
                  </p>
                  
                  <div className="flex flex-col md:flex-row gap-2 mb-4">
                    <Input
                      value={newDisallowedTool}
                      onChange={(e) => setNewDisallowedTool(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addDisallowedTool()}
                      placeholder="e.g., Bash(rm:*), Bash(sudo:*)"
                      className="flex-1"
                    />
                    <Button onClick={addDisallowedTool} size="sm" variant="destructive">
                      <Plus className="w-4 h-4 mr-1" />
                      Add Tool
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {disallowedTools.map((tool) => (
                      <Badge
                        key={tool}
                        variant="destructive"
                        className="py-1 pl-2 pr-1 flex items-center space-x-1"
                      >
                        <span>{tool}</span>
                        <button
                          onClick={() => removeDisallowedTool(tool)}
                          className="ml-1 hover:text-background"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    {disallowedTools.length === 0 && (
                      <p className="text-sm text-muted-foreground">No disallowed tools configured</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                {/* Theme Toggle */}
                <div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-foreground mb-1">Theme</h3>
                      <p className="text-sm text-muted-foreground">
                        Choose between light and dark mode
                      </p>
                    </div>
                    <button
                      onClick={toggleDarkMode}
                      className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
                    >
                      {isDarkMode ? (
                        <Sun className="w-5 h-5" />
                      ) : (
                        <Moon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Project Sort Order */}
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-1">Project Sort Order</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    How projects are sorted in the sidebar
                  </p>
                  <select
                    value={projectSortOrder}
                    onChange={(e) => setProjectSortOrder(e.target.value)}
                    className="w-full md:w-48 px-3 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="name">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                    <option value="recent">Most Recent</option>
                    <option value="oldest">Oldest First</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          <div className="border-t p-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={saveSettings} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
            {saveStatus === 'success' && (
              <span className="text-sm text-green-500 self-center ml-2">Saved!</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-red-500 self-center ml-2">Error saving</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ToolsSettings;