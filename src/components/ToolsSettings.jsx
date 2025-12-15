import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { X, Settings, AlertTriangle, Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

function ToolsSettings({ isOpen, onClose }) {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const [skipPermissions, setSkipPermissions] = useState(false);
  const [autoStartClaudeCode, setAutoStartClaudeCode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [projectSortOrder, setProjectSortOrder] = useState('name');

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
        setSkipPermissions(localData.skipPermissions || false);
        setAutoStartClaudeCode(localData.autoStartClaudeCode || false);
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
        setSkipPermissions(data.skipPermissions || false);
        setAutoStartClaudeCode(data.autoStartClaudeCode || false);
        setProjectSortOrder(data.projectSortOrder || 'name');
        // Update localStorage with backend data
        localStorage.setItem('claude-tools-settings', JSON.stringify({
          skipPermissions: data.skipPermissions || false,
          autoStartClaudeCode: data.autoStartClaudeCode || false,
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
      const settingsData = { skipPermissions, autoStartClaudeCode, projectSortOrder };

      localStorage.setItem('claude-tools-settings', JSON.stringify(settingsData));

      // Also save to backend
      const token = localStorage.getItem('auth-token');
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        // Maintain compatibility with servers that expect tool arrays
        body: JSON.stringify({ allowedTools: [], disallowedTools: [], ...settingsData })
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl border border-border shadow-sm w-full max-w-3xl max-h-[85vh] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center space-x-2">
            <Settings className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-accent rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex flex-col h-[calc(85vh-4rem)]">
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Permission behavior */}
            <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-warning mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-foreground">Skip Permission Requests</h3>
                      <p className="text-sm text-muted-foreground mt-1">Execute safe actions without asking every time.</p>
                    </div>
                    <button
                      onClick={() => setSkipPermissions(!skipPermissions)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${skipPermissions ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${skipPermissions ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Auto-start Claude Code */}
            <div className="border border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-foreground">Auto-start Claude Code</h3>
                  <p className="text-sm text-muted-foreground mt-1">Automatically run "claude code" when connecting to Shell</p>
                </div>
                <button
                  onClick={() => setAutoStartClaudeCode(!autoStartClaudeCode)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoStartClaudeCode ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoStartClaudeCode ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>

            {/* Theme */}
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium text-foreground mb-1">Theme</h3>
                  <p className="text-sm text-muted-foreground">Choose between light and dark mode</p>
                </div>
                <button onClick={toggleDarkMode} className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors">
                  {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Project sort */}
            <div>
              <h3 className="text-lg font-medium text-foreground mb-1">Project Sort Order</h3>
              <p className="text-sm text-muted-foreground mb-4">How projects are sorted in the sidebar</p>
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

            {/* Codex connector info */}
            <div>
              <h3 className="text-lg font-medium text-foreground mb-1">Codex Connector</h3>
              <p className="text-sm text-muted-foreground mb-3">Using Codex CLI authentication from this machine (mirrors your terminal).</p>
              <div className="text-xs text-muted-foreground">To change, use the Codex CLI login on your terminal. The app will follow automatically.</div>
            </div>
          </div>

          <div className="border-t border-border px-4 py-3 flex justify-end items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={saveSettings} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
            {saveStatus === 'success' && (
              <span className="text-sm text-success">Saved!</span>
            )}
            {saveStatus === 'error' && (
              <span className="text-sm text-destructive">Error saving</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ToolsSettings;
