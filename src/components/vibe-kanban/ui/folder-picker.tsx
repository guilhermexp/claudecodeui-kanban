import React, { useEffect, useMemo, useState } from 'react';
import { Button } from './button';
import { Input } from './input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { X } from 'lucide-react';
import { Alert, AlertDescription } from './alert';
import { ScrollArea } from '../../ui/scroll-area';
import {
  AlertCircle,
  ChevronUp,
  ChevronRight,
  File,
  Folder,
  FolderOpen,
  FolderGit2,
  Home,
  Search,
  Loader2,
  HardDrive,
  FolderPlus,
  History,
  Star,
} from 'lucide-react';
import { fileSystemApi } from '../../../lib/vibe-kanban/api';
import { DirectoryEntry } from '../../lib/vibe-kanban/shared-types';
import { cn } from '../../../lib/utils';

interface FolderPickerProps {
  open: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  value?: string;
  title?: string;
  description?: string;
}

export function FolderPicker({
  open,
  onClose,
  onSelect,
  value = '',
  title = 'Select Project Folder',
  description = 'Navigate to the folder where you want to create your project',
}: FolderPickerProps) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [entries, setEntries] = useState<DirectoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manualPath, setManualPath] = useState(value);
  const [searchTerm, setSearchTerm] = useState('');
  const [recentPaths] = useState<string[]>([
    '/Users/guilhermevarela/Documents/Repositorios',
    '/Users/guilhermevarela/Desktop',
  ]);
  const [selectedEntry, setSelectedEntry] = useState<DirectoryEntry | null>(null);

  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return entries;
    return entries.filter((entry) =>
      entry.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [entries, searchTerm]);

  // Sort entries: directories first, then files, alphabetically
  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      if (a.is_directory && !b.is_directory) return -1;
      if (!a.is_directory && b.is_directory) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredEntries]);

  useEffect(() => {
    if (open) {
      setManualPath(value);
      setSearchTerm('');
      setSelectedEntry(null);
      loadDirectory(value || undefined);
    }
  }, [open, value]);

  const loadDirectory = async (path?: string) => {
    setLoading(true);
    setError('');
    setSearchTerm('');

    try {
      const result = await fileSystemApi.list(path);

      if (!result || typeof result !== 'object') {
        throw new Error('Invalid response from file system API');
      }
      
      const entries = Array.isArray(result.entries) ? result.entries : [];
      setEntries(entries);
      const newPath = result.current_path || '';
      setCurrentPath(newPath);
      
      if (path !== undefined) {
        setManualPath(newPath);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load directory');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFolderClick = (entry: DirectoryEntry) => {
    if (entry.is_directory) {
      setSelectedEntry(entry);
      loadDirectory(entry.path);
      setManualPath(entry.path);
    }
  };

  const handleParentDirectory = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/');
    const newPath = parentPath || '/';
    loadDirectory(newPath);
    setManualPath(newPath);
  };

  const handleHomeDirectory = () => {
    loadDirectory();
    setManualPath('');
  };

  const handleManualPathSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (manualPath.trim()) {
      loadDirectory(manualPath);
    }
  };

  const handleSelectPath = () => {
    const pathToSelect = manualPath || currentPath;
    if (pathToSelect) {
      onSelect(pathToSelect);
      onClose();
    }
  };

  const handleRecentPath = (path: string) => {
    setManualPath(path);
    loadDirectory(path);
  };

  const handleClose = () => {
    setError('');
    setSearchTerm('');
    onClose();
  };

  // Get breadcrumb parts
  const breadcrumbs = currentPath ? currentPath.split('/').filter(Boolean) : [];

  // Custom Dialog without dark overlay
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Lighter overlay */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm"
        onClick={handleClose}
      />
      {/* Dialog content */}
      <div className="relative z-[10000] max-w-[95vw] sm:max-w-[850px] w-full h-[90vh] sm:h-[600px] bg-card rounded-xl border border-border shadow-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-border/50 bg-card/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
                <FolderPlus className="w-4 sm:w-5 h-4 sm:h-5 text-primary/70" />
                <span className="truncate">{title}</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 hidden sm:block">
                {description}
              </p>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-1 hover:bg-accent transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground hover:text-foreground" />
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row flex-1 overflow-hidden">
          {/* Sidebar - Hidden on mobile, shown on sm and up */}
          <div className="hidden sm:block w-56 border-r border-border/50 bg-background/30 p-3 space-y-4">
            {/* Quick Access */}
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Quick Access
              </h3>
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-8 px-2 hover:bg-accent/50"
                  onClick={handleHomeDirectory}
                >
                  <Home className="w-4 h-4 mr-2 text-muted-foreground" />
                  <span className="text-sm">Home</span>
                </Button>
                
                {recentPaths.map((path, idx) => (
                  <Button
                    key={idx}
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start h-8 px-2 hover:bg-accent/50"
                    onClick={() => handleRecentPath(path)}
                  >
                    <History className="w-4 h-4 mr-2 text-muted-foreground" />
                    <span className="text-sm truncate">{path.split('/').pop()}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Current Selection */}
            {manualPath && (
              <div className="pt-3 border-t border-border/30">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Selected Path
                </h3>
                <div className="p-2 bg-primary/10 rounded-md border border-primary/20">
                  <p className="text-xs text-foreground break-all">{manualPath}</p>
                </div>
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile Quick Access - Shown only on mobile */}
            <div className="sm:hidden px-4 py-2 border-b border-border/50 bg-background/30">
              <div className="flex gap-2 overflow-x-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 flex-shrink-0 text-xs"
                  onClick={handleHomeDirectory}
                >
                  <Home className="w-3 h-3 mr-1" />
                  Home
                </Button>
                {recentPaths.map((path, idx) => (
                  <Button
                    key={idx}
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 flex-shrink-0 text-xs"
                    onClick={() => handleRecentPath(path)}
                  >
                    <History className="w-3 h-3 mr-1" />
                    {path.split('/').pop()}
                  </Button>
                ))}
              </div>
            </div>

            {/* Toolbar */}
            <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-border/50 bg-background/30 space-y-2 sm:space-y-3">
              {/* Breadcrumb Navigation */}
              <div className="flex items-center gap-1 text-xs sm:text-sm">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 sm:h-7 sm:w-7 hover:bg-accent/50 flex-shrink-0"
                  onClick={handleParentDirectory}
                  disabled={!currentPath || currentPath === '/'}
                >
                  <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4" />
                </Button>
                
                <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto">
                  <HardDrive className="w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground flex-shrink-0" />
                  {breadcrumbs.length === 0 ? (
                    <span className="text-muted-foreground">Root</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      {breadcrumbs.map((part, idx) => (
                        <React.Fragment key={idx}>
                          <ChevronRight className="w-2 h-2 sm:w-3 sm:h-3 text-muted-foreground flex-shrink-0" />
                          <span className={cn(
                            "px-1 sm:px-1.5 py-0.5 rounded whitespace-nowrap",
                            idx === breadcrumbs.length - 1 
                              ? "bg-accent/50 text-foreground font-medium" 
                              : "text-muted-foreground hidden sm:inline"
                          )}>
                            {part}
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Search and Manual Path */}
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-muted-foreground" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search..."
                    className="h-8 sm:h-9 pl-7 sm:pl-9 bg-card border-border text-xs sm:text-sm"
                  />
                </div>
                
                <form onSubmit={handleManualPathSubmit} className="flex gap-2 flex-1">
                  <Input
                    value={manualPath}
                    onChange={(e) => setManualPath(e.target.value)}
                    placeholder="Enter path..."
                    className="h-8 sm:h-9 bg-card border-border text-xs sm:text-sm"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    variant="outline"
                    className="h-8 sm:h-9 px-2 sm:px-3"
                  >
                    Go
                  </Button>
                </form>
              </div>
            </div>

            {/* Directory Listing */}
            <ScrollArea className="flex-1 p-3 sm:p-4">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="w-6 sm:w-8 h-6 sm:h-8 animate-spin mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm">Loading directory...</p>
                </div>
              ) : error ? (
                <Alert variant="destructive" className="mx-auto max-w-md">
                  <AlertCircle className="h-3 sm:h-4 w-3 sm:w-4" />
                  <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
                </Alert>
              ) : sortedEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Folder className="w-10 sm:w-12 h-10 sm:h-12 mb-2 sm:mb-3 opacity-50" />
                  <p className="text-xs sm:text-sm">
                    {searchTerm.trim() ? 'No matches found' : 'Empty folder'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {sortedEntries.map((entry, index) => (
                    <button
                      key={index}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-left",
                        "hover:bg-accent/50",
                        entry.is_directory 
                          ? "cursor-pointer hover:bg-accent" 
                          : "opacity-50 cursor-not-allowed",
                        selectedEntry?.path === entry.path && "bg-accent border-l-2 border-primary"
                      )}
                      onClick={() => entry.is_directory && handleFolderClick(entry)}
                      disabled={!entry.is_directory}
                      title={entry.path}
                    >
                      <div className="flex-shrink-0">
                        {entry.is_directory ? (
                          entry.is_git_repo ? (
                            <FolderGit2 className="w-5 h-5 text-green-500" />
                          ) : (
                            <Folder className="w-5 h-5 text-primary/70" />
                          )
                        ) : (
                          <File className="w-5 h-5 text-muted-foreground/50" />
                        )}
                      </div>
                      <span className="text-sm flex-1 truncate">
                        {entry.name}
                      </span>
                      {entry.is_git_repo && (
                        <div className="px-2 py-0.5 bg-green-500/20 text-green-600 rounded text-xs flex-shrink-0">
                          git
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-border/50 bg-card/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-3">
            <div className="text-xs sm:text-sm text-muted-foreground order-2 sm:order-1 text-center sm:text-left">
              {sortedEntries.filter(e => e.is_directory).length} folders, {' '}
              {sortedEntries.filter(e => !e.is_directory).length} files
            </div>
            <div className="flex gap-2 order-1 sm:order-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={handleClose}
                className="flex-1 sm:flex-none min-w-[80px] text-xs sm:text-sm h-9 sm:h-10"
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSelectPath} 
                disabled={!manualPath && !currentPath}
                className="flex-1 sm:flex-none min-w-[120px] bg-primary hover:bg-primary/90 text-xs sm:text-sm h-9 sm:h-10"
              >
                <FolderPlus className="w-3 sm:w-4 h-3 sm:h-4 mr-1 sm:mr-2" />
                Select Folder
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}