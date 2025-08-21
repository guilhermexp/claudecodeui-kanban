import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Folder, FolderOpen, File, FileText, FileCode, FilePlus, FolderPlus } from 'lucide-react';
import { cn } from '../lib/utils';
import CodeEditor from './CodeEditor';
import ImageViewer from './ImageViewer';
import { api } from '../utils/api';
import { formatFileSize, formatRelativeTime } from '../utils/formatters';

function FileTree({ selectedProject }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  // View mode removed - using simple list view only
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('file'); // 'file' or 'folder'
  const [createName, setCreateName] = useState('');
  const [createPath, setCreatePath] = useState(''); // Path where to create
  const [createError, setCreateError] = useState('');
  const [contextMenu, setContextMenu] = useState(null); // For right-click menu
  const fetchTimeoutRef = useRef(null);
  const lastFetchTime = useRef(0);
  const lastProjectPath = useRef(null);
  const MIN_FETCH_INTERVAL = 1000; // Minimum 1 second between fetches

  useEffect(() => {
    if (selectedProject) {
      // Skip if same project
      if (lastProjectPath.current === selectedProject.path) {
        return;
      }
      lastProjectPath.current = selectedProject.path;
      
      const now = Date.now();
      const timeSinceLastFetch = now - lastFetchTime.current;
      
      // If last fetch was too recent, delay more
      const delay = timeSinceLastFetch < MIN_FETCH_INTERVAL 
        ? MIN_FETCH_INTERVAL - timeSinceLastFetch 
        : 500; // Increased from 100ms to 500ms
      
      // Clear any pending fetch
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      
      fetchTimeoutRef.current = setTimeout(() => {
        lastFetchTime.current = Date.now();
        fetchFiles();
      }, delay);
    }
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [selectedProject]);
  
  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  // View mode preference removed - using simple list only

  const fetchFiles = async () => {
    if (loading) return; // Prevent multiple simultaneous fetches
    setLoading(true);
    try {
      const response = await api.getFiles(selectedProject.name);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ File fetch failed:', response.status, errorText);
        
        // Try to parse error as JSON for better error message
        let errorMessage = 'Failed to load files';
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          // Use raw error text if not JSON
          errorMessage = errorText;
        }
        
        // Show user-friendly error for inaccessible projects
        if (response.status === 404) {
          if (errorMessage.includes('not found')) {
            errorMessage = 'Project directory not accessible from current session';
          }
        }
        
        setFiles([{ 
          name: '⚠️ Error', 
          type: 'error',
          path: '__error__',
          children: [{ 
            name: errorMessage, 
            type: 'error-message',
            path: '__error_message__'
          }] 
        }]);
        return;
      }
      
      const data = await response.json();
      setFiles(data);
    } catch (error) {
      console.error('❌ Error fetching files:', error);
      setFiles([{ 
        name: '⚠️ Connection Error', 
        type: 'error',
        path: '__connection_error__',
        children: [{ 
          name: 'Unable to connect to server', 
          type: 'error-message',
          path: '__connection_error_message__'
        }] 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const toggleDirectory = useCallback((path) => {
    setExpandedDirs(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return newExpanded;
    });
  }, []);

  // View mode change removed - using simple list only


  const renderFileTree = useCallback((items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start py-1 px-2 h-auto font-normal text-left hover:bg-accent",
            "touch-manipulation active:bg-accent/80 min-h-[28px] md:min-h-0",
          )}
          style={{ paddingLeft: `${level * 10 + 8}px` }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (item.type === 'error-message') {
              // Don't do anything for error messages
              return;
            } else if (item.type === 'error') {
              // Allow expanding error items to show details
              toggleDirectory(item.path);
            } else if (item.type === 'directory') {
              toggleDirectory(item.path);
            } else if (isImageFile(item.name)) {
              // Open image in viewer
              setSelectedImage({
                name: item.name,
                path: item.path,
                projectPath: selectedProject.path,
                projectName: selectedProject.name
              });
              setShowFilePanel(true);
            } else {
              // Open file in editor
              setSelectedFile({
                name: item.name,
                path: item.path,
                projectPath: selectedProject.path,
                projectName: selectedProject.name
              });
              setShowFilePanel(true);
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (item.type === 'directory') {
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                item: item
              });
            }
          }}
        >
          <div className="flex items-center gap-2 min-w-0 w-full">
            {item.type === 'error' ? (
              <span className="w-4 h-4 text-red-500 flex-shrink-0">⚠️</span>
            ) : item.type === 'error-message' ? (
              <span className="w-4 h-4 text-orange-500 flex-shrink-0">•</span>
            ) : item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-3 h-3 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            <span className={cn(
              "text-xs truncate max-w-[150px]",
              item.type === 'error' ? "text-red-500 font-medium" :
              item.type === 'error-message' ? "text-orange-400 text-xs" :
              "text-foreground"
            )} title={item.name}>
              {item.name}
            </span>
          </div>
        </Button>
        
        {(item.type === 'directory' || item.type === 'error') && 
         expandedDirs.has(item.path) && 
         item.children && 
         item.children.length > 0 && (
          <div>
            {renderFileTree(item.children, level + 1)}
          </div>
        )}
      </div>
    ));
  }, [expandedDirs, selectedProject, setSelectedFile, setSelectedImage, setShowFilePanel, toggleDirectory]);

  const isImageFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    return imageExtensions.includes(ext);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const name = filename.toLowerCase();
    
    // Special files by name - smaller text size
    if (name === 'dockerfile') return <span className="text-xs flex-shrink-0">🐳</span>;
    if (name === '.dockerignore') return <span className="text-xs flex-shrink-0">🐳</span>;
    if (name === '.gitignore') return <span className="text-xs flex-shrink-0">🔸</span>;
    if (name === '.prettierrc' || name === '.prettierignore') return <span className="text-xs flex-shrink-0">🎨</span>;
    if (name === 'package.json' || name === 'package-lock.json') return <span className="text-xs flex-shrink-0">📦</span>;
    if (name === 'tsconfig.json' || name === 'tsconfig.buildinfo') return <span className="text-xs flex-shrink-0">🔷</span>;
    if (name === '.env' || name.startsWith('.env.')) return <span className="text-xs flex-shrink-0">🔐</span>;
    if (name === 'readme.md' || name === 'readme.txt') return <span className="text-xs flex-shrink-0">📘</span>;
    
    // Files by extension - smaller icons
    switch(ext) {
      // TypeScript
      case 'ts':
      case 'tsx':
        return <span className="text-[10px] text-blue-500 flex-shrink-0 font-bold">TS</span>;
      
      // JavaScript  
      case 'js':
      case 'jsx':
      case 'mjs':
        return <span className="text-[10px] text-yellow-500 flex-shrink-0 font-bold">JS</span>;
      
      // Config files
      case 'json':
        return <span className="text-xs flex-shrink-0">{name.includes('config') ? '⚙️' : '{ }'}</span>;
      case 'yaml':
      case 'yml':
        return <span className="text-xs flex-shrink-0">📋</span>;
      
      // Documentation
      case 'md':
        return <span className="text-xs flex-shrink-0">📝</span>;
      
      // SQL
      case 'sql':
        return <span className="text-xs flex-shrink-0">🗃️</span>;
      
      // Shell scripts
      case 'sh':
      case 'bash':
        return <span className="text-xs flex-shrink-0">🖥️</span>;
      
      // Images
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
      case 'ico':
        return <span className="text-xs flex-shrink-0">🖼️</span>;
      
      // Other code files
      case 'py':
        return <span className="text-xs flex-shrink-0">🐍</span>;
      case 'go':
        return <span className="text-[10px] text-cyan-500 flex-shrink-0">Go</span>;
      case 'rs':
        return <span className="text-xs flex-shrink-0">🦀</span>;
      case 'java':
        return <span className="text-xs flex-shrink-0">☕</span>;
      
      // Default
      default:
        return <File className="w-3 h-3 text-muted-foreground flex-shrink-0" />;
    }
  };

  // Handle create file/folder
  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateError('Name cannot be empty');
      return;
    }
    
    // Validate name
    const invalidChars = /[<>:"|?*\\]/g;
    if (invalidChars.test(createName)) {
      setCreateError('Invalid characters in name');
      return;
    }
    
    setCreateError('');
    
    try {
      const fullPath = createPath ? `${createPath}/${createName}` : createName;
      const response = await fetch('/api/files/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        },
        body: JSON.stringify({
          projectName: selectedProject.name,
          path: fullPath,
          type: createType
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        setCreateError(error.error || 'Failed to create');
        return;
      }
      
      // Success - refresh files and close modal
      setShowCreateModal(false);
      setCreateName('');
      setCreatePath('');
      fetchFiles();
    } catch (error) {
      console.error('Error creating:', error);
      setCreateError('Failed to create');
    }
  };

  // Render detailed view with table-like layout
  // Removed renderDetailedView and renderCompactView - using only simple list view

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-gray-500 dark:text-gray-400">
          Loading files...
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="h-full flex bg-card rounded-xl border border-border overflow-hidden">
      {/* Files List */}
      <div className={`flex flex-col transition-all duration-300 ease-in-out ${
        showFilePanel ? 'hidden md:flex md:w-[25%] lg:w-[20%] xl:w-[18%]' : 'flex-1'
      }`}>
      {/* View Mode Toggle */}
      <div className="py-3 px-3 md:px-4 border-b border-border flex items-center justify-between bg-gradient-to-r from-blue-900/10 to-purple-900/10">
        <h3 className="text-sm font-semibold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Files</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              setCreateType('file');
              setShowCreateModal(true);
              setCreatePath('');
              setCreateName('');
              setCreateError('');
            }}
            className="p-1 hover:bg-accent rounded-md transition-colors"
            title="New File"
          >
            <FilePlus className="w-4 h-4 text-muted-foreground" />
          </button>
          <button
            onClick={() => {
              setCreateType('folder');
              setShowCreateModal(true);
              setCreatePath('');
              setCreateName('');
              setCreateError('');
            }}
            className="p-1 hover:bg-accent rounded-md transition-colors"
            title="New Folder"
          >
            <FolderPlus className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Column Headers removed - using simple view */}
      {false && (
        <div className="px-3 md:px-4 pt-2 pb-1 border-b border-border">
          <div className="grid grid-cols-12 gap-2 px-1 md:px-2 text-xs font-medium text-muted-foreground">
            <div className="col-span-5">Name</div>
            <div className="col-span-2">Size</div>
            <div className="col-span-3">Modified</div>
            <div className="col-span-2">Permissions</div>
          </div>
        </div>
      )}
      
      <ScrollArea className="flex-1 p-4">
        {files.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
              <Folder className="w-6 h-6 text-muted-foreground" />
            </div>
            <h4 className="font-medium text-foreground mb-1">No files found</h4>
            <p className="text-sm text-muted-foreground">
              Check if the project path is accessible
            </p>
          </div>
        ) : (
          <div className="space-y-1" style={{ backfaceVisibility: 'hidden', transform: 'translateZ(0)' }}>
            {renderFileTree(files)}
          </div>
        )}
      </ScrollArea>
      </div>
      
      {/* File Viewer Panel - Integrated Side Panel */}
      <div className={`md:border-l border-border bg-background overflow-hidden transition-all duration-300 ease-in-out ${
        showFilePanel && (selectedFile || selectedImage) ? 'flex-1 opacity-100' : 'w-0 opacity-0 md:w-0'
      }`}>
          {selectedFile && (
            <div className="h-full flex flex-col">
              {/* File Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Back button for mobile */}
                  <button
                    onClick={() => {
                      setShowFilePanel(false);
                      setSelectedFile(null);
                    }}
                    className="p-1 hover:bg-accent rounded md:hidden"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  {getFileIcon(selectedFile.name)}
                  <span className="text-sm font-medium truncate">{selectedFile.name}</span>
                </div>
                <button
                  onClick={() => {
                    setShowFilePanel(false);
                    setSelectedFile(null);
                  }}
                  className="p-1 hover:bg-accent rounded hidden md:block"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Code Editor Inline */}
              <div className="flex-1 overflow-hidden">
                <CodeEditor
                  file={selectedFile}
                  onClose={() => {
                    setSelectedFile(null);
                    setShowFilePanel(false);
                  }}
                  projectPath={selectedFile.projectPath}
                  inline={true}
                />
              </div>
            </div>
          )}
          
          {selectedImage && (
            <div className="h-full flex flex-col">
              {/* Image Header */}
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  {/* Back button for mobile */}
                  <button
                    onClick={() => {
                      setShowFilePanel(false);
                      setSelectedImage(null);
                    }}
                    className="p-1 hover:bg-accent rounded md:hidden"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  {getFileIcon(selectedImage.name)}
                  <span className="text-sm font-medium truncate">{selectedImage.name}</span>
                </div>
                <button
                  onClick={() => {
                    setShowFilePanel(false);
                    setSelectedImage(null);
                  }}
                  className="p-1 hover:bg-accent rounded hidden md:block"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              {/* Image Viewer Inline */}
              <div className="flex-1 overflow-auto">
                <ImageViewer
                  file={selectedImage}
                  onClose={() => {
                    setSelectedImage(null);
                    setShowFilePanel(false);
                  }}
                  inline={true}
                />
              </div>
            </div>
          )}
      </div>
    </div>
    
    {/* Context Menu */}
    {contextMenu && (
      <div
        style={{
          position: 'fixed',
          top: contextMenu.y,
          left: contextMenu.x,
          zIndex: 100
        }}
        className="bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px]"
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCreateType('file');
            setCreatePath(contextMenu.item.path);
            setShowCreateModal(true);
            setCreateName('');
            setCreateError('');
            setContextMenu(null);
          }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
        >
          <FilePlus className="w-4 h-4" />
          New File
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setCreateType('folder');
            setCreatePath(contextMenu.item.path);
            setShowCreateModal(true);
            setCreateName('');
            setCreateError('');
            setContextMenu(null);
          }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
        >
          <FolderPlus className="w-4 h-4" />
          New Folder
        </button>
      </div>
    )}
    
    {/* Create File/Folder Modal */}
    {showCreateModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-background border border-border rounded-lg p-6 w-96 max-w-[90vw]">
          <h3 className="text-lg font-semibold mb-4">
            Create New {createType === 'file' ? 'File' : 'Folder'}
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground">Name</label>
              <input
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') setShowCreateModal(false);
                }}
                className="w-full mt-1 px-3 py-2 bg-muted border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder={createType === 'file' ? 'filename.js' : 'folder-name'}
                autoFocus
              />
            </div>
            
            {createPath && (
              <div className="text-sm text-muted-foreground">
                Creating in: <span className="font-mono">{createPath}</span>
              </div>
            )}
            
            {createError && (
              <div className="text-sm text-red-500">
                {createError}
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateName('');
                  setCreatePath('');
                  setCreateError('');
                }}
                className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

// Memoize component to prevent unnecessary re-renders
export default React.memo(FileTree, (prevProps, nextProps) => {
  // Only re-render if selectedProject actually changed
  return prevProps.selectedProject?.path === nextProps.selectedProject?.path &&
         prevProps.selectedProject?.name === nextProps.selectedProject?.name;
});