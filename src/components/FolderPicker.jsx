import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { 
  Folder, 
  FolderOpen, 
  File, 
  Home, 
  ChevronRight, 
  ArrowLeft,
  HardDrive,
  Loader2 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../utils/api';

function FolderPicker({ isOpen, onClose, onSelect }) {
  // Start in user's home directory
  const defaultPath = `/Users/${window.location.hostname === 'localhost' ? 'guilhermevarela' : 'user'}`;
  const [currentPath, setCurrentPath] = useState(defaultPath);
  const [folders, setFolders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [manualPath, setManualPath] = useState('');
  const [selectedFolder, setSelectedFolder] = useState(null);

  // Load folders when path changes
  useEffect(() => {
    if (isOpen) {
      loadFolders(currentPath);
    }
  }, [currentPath, isOpen]);

  const loadFolders = async (folderPath) => {
    setIsLoading(true);
    setError(null);
    try {
      // Use authenticatedFetch directly for the new endpoint
      const response = await api.authenticatedFetch(`/api/files/list-dirs?path=${encodeURIComponent(folderPath)}`);
      if (response.ok) {
        const data = await response.json();
        setFolders(data.files || []);
      } else {
        const errData = await response.json().catch(() => ({}));
        setError(errData.error || 'Failed to load folders');
      }
    } catch (err) {
      setError('Failed to load folders: ' + err.message);
    }
    setIsLoading(false);
  };

  const navigateToFolder = (folderPath) => {
    setCurrentPath(folderPath);
    setSelectedFolder(folderPath);
  };

  const goUp = () => {
    if (currentPath === '/') return;
    const parts = currentPath.split('/').filter(p => p);
    parts.pop();
    const newPath = '/' + parts.join('/');
    setCurrentPath(newPath || '/');
  };

  const goHome = () => {
    // Go directly to user's home directory
    const username = window.location.hostname === 'localhost' ? 'guilhermevarela' : 'user';
    setCurrentPath(`/Users/${username}`);
  };

  const handleSelect = () => {
    const pathToUse = selectedFolder || currentPath;
    if (pathToUse && pathToUse !== '/') {
      onSelect(pathToUse);
      onClose();
    }
  };

  const handleManualPath = () => {
    if (manualPath.trim()) {
      onSelect(manualPath.trim());
      onClose();
    }
  };

  // Get breadcrumbs
  const getBreadcrumbs = () => {
    if (currentPath === '/') return ['Root'];
    const parts = currentPath.split('/').filter(p => p);
    return ['Root', ...parts];
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      {/* Make the dialog a flex column so the middle area can scroll */}
      <DialogContent className="w-full max-w-3xl h-[70vh] p-0 bg-card border border-border flex flex-col">
        <DialogHeader className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold">Select Project Folder</DialogTitle>
            <button
              onClick={onClose}
              className="rounded-lg p-1 hover:bg-accent transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </DialogHeader>

        <div className="px-4 py-2 border-b border-border">
          {/* Breadcrumb navigation */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground mb-2">
            {getBreadcrumbs().map((crumb, index, arr) => (
              <React.Fragment key={index}>
                <button
                  className="hover:text-foreground transition-colors"
                  onClick={() => {
                    if (index === 0) {
                      setCurrentPath('/');
                    } else {
                      const pathParts = currentPath.split('/').filter(p => p).slice(0, index);
                      setCurrentPath('/' + pathParts.join('/'));
                    }
                  }}
                >
                  {crumb}
                </button>
                {index < arr.length - 1 && <ChevronRight className="w-3 h-3" />}
              </React.Fragment>
            ))}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goUp}
              disabled={currentPath === '/'}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Up
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goHome}
            >
              <Home className="w-4 h-4 mr-1" />
              Home
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPath('/')}
            >
              <HardDrive className="w-4 h-4 mr-1" />
              Root
            </Button>
            <div className="flex-1" />
            <Input
              type="text"
              placeholder="Or enter path manually..."
              value={manualPath}
              onChange={(e) => setManualPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleManualPath();
                }
              }}
              className="w-64 h-8"
            />
          </div>
        </div>

        {/* Folder list */}
        <ScrollArea className="flex-1 px-4 py-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-destructive">
              {error}
            </div>
          ) : folders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No folders in this directory
            </div>
          ) : (
            <div className="grid gap-1">
              {folders.map((folder) => (
                <div
                  key={folder.name}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors",
                    "hover:bg-accent",
                    selectedFolder === folder.path && "bg-accent"
                  )}
                  onClick={() => setSelectedFolder(folder.path)}
                  onDoubleClick={() => navigateToFolder(folder.path)}
                >
                  <Folder className="w-4 h-4 text-primary" />
                  <span className="text-sm">{folder.name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">
                    Double-click to open
                  </span>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedFolder ? (
              <span>Selected: <code className="text-foreground">{selectedFolder}</code></span>
            ) : (
              <span>Current: <code className="text-foreground">{currentPath}</code></span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSelect}
              disabled={!selectedFolder && currentPath === '/'}
            >
              Select This Folder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FolderPicker;
