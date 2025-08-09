import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Folder, FolderOpen, File, FileText, FileCode, List, TableProperties, Eye } from 'lucide-react';
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
  const [viewMode, setViewMode] = useState('detailed'); // 'simple', 'detailed', 'compact'
  const [showFilePanel, setShowFilePanel] = useState(false);
  const fetchTimeoutRef = useRef(null);

  useEffect(() => {
    if (selectedProject) {
      // Debounce fetchFiles to avoid multiple calls
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      fetchTimeoutRef.current = setTimeout(() => {
        fetchFiles();
      }, 100);
    }
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [selectedProject]);

  // Load view mode preference from localStorage
  useEffect(() => {
    const savedViewMode = localStorage.getItem('file-tree-view-mode');
    if (savedViewMode && ['simple', 'detailed', 'compact'].includes(savedViewMode)) {
      setViewMode(savedViewMode);
    }
  }, []);

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

  // Change view mode and save preference
  const changeViewMode = useCallback((mode) => {
    setViewMode(mode);
    localStorage.setItem('file-tree-view-mode', mode);
  }, []);


  const renderFileTree = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none">
        <Button
          variant="ghost"
          className={cn(
            "w-full justify-start p-2 md:p-2 h-auto font-normal text-left hover:bg-accent",
            "touch-manipulation active:bg-accent/80 min-h-[44px] md:min-h-0",
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
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
        >
          <div className="flex items-center gap-2 min-w-0 w-full">
            {item.type === 'error' ? (
              <span className="w-4 h-4 text-red-500 flex-shrink-0">⚠️</span>
            ) : item.type === 'error-message' ? (
              <span className="w-4 h-4 text-orange-500 flex-shrink-0">•</span>
            ) : item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            <span className={cn(
              "text-sm truncate",
              item.type === 'error' ? "text-red-500 font-medium" :
              item.type === 'error-message' ? "text-orange-400 text-xs" :
              "text-foreground"
            )}>
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
  };

  const isImageFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    return imageExtensions.includes(ext);
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'php', 'rb', 'go', 'rs'];
    const docExtensions = ['md', 'txt', 'doc', 'pdf'];
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    
    if (codeExtensions.includes(ext)) {
      return <FileCode className="w-4 h-4 text-green-500 flex-shrink-0" />;
    } else if (docExtensions.includes(ext)) {
      return <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />;
    } else if (imageExtensions.includes(ext)) {
      return <File className="w-4 h-4 text-purple-500 flex-shrink-0" />;
    } else {
      return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
    }
  };

  // Render detailed view with table-like layout
  const renderDetailedView = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none">
        <div
          className={cn(
            "grid grid-cols-12 gap-2 p-2 hover:bg-accent cursor-pointer items-center",
            "touch-manipulation active:bg-accent/80 min-h-[44px] md:min-h-0",
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (item.type === 'directory') {
              toggleDirectory(item.path);
            } else if (isImageFile(item.name)) {
              setSelectedImage({
                name: item.name,
                path: item.path,
                projectPath: selectedProject.path,
                projectName: selectedProject.name
              });
              setShowFilePanel(true);
            } else {
              setSelectedFile({
                name: item.name,
                path: item.path,
                projectPath: selectedProject.path,
                projectName: selectedProject.name
              });
              setShowFilePanel(true);
            }
          }}
        >
          <div className="col-span-5 flex items-center gap-2 min-w-0">
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            <span className="text-sm truncate text-foreground">
              {item.name}
            </span>
          </div>
          <div className="col-span-2 text-sm text-muted-foreground">
            {item.type === 'file' ? formatFileSize(item.size) : '-'}
          </div>
          <div className="col-span-3 text-sm text-muted-foreground">
            {formatRelativeTime(item.modified)}
          </div>
          <div className="col-span-2 text-sm text-muted-foreground font-mono">
            {item.permissionsRwx || '-'}
          </div>
        </div>
        
        {item.type === 'directory' && 
         expandedDirs.has(item.path) && 
         item.children && 
         renderDetailedView(item.children, level + 1)}
      </div>
    ));
  };

  // Render compact view with inline details
  const renderCompactView = (items, level = 0) => {
    return items.map((item) => (
      <div key={item.path} className="select-none">
        <div
          className={cn(
            "flex items-center justify-between p-2 hover:bg-accent cursor-pointer",
            "touch-manipulation active:bg-accent/80 min-h-[44px] md:min-h-0",
          )}
          style={{ paddingLeft: `${level * 16 + 12}px` }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (item.type === 'directory') {
              toggleDirectory(item.path);
            } else if (isImageFile(item.name)) {
              setSelectedImage({
                name: item.name,
                path: item.path,
                projectPath: selectedProject.path,
                projectName: selectedProject.name
              });
              setShowFilePanel(true);
            } else {
              setSelectedFile({
                name: item.name,
                path: item.path,
                projectPath: selectedProject.path,
                projectName: selectedProject.name
              });
              setShowFilePanel(true);
            }
          }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {item.type === 'directory' ? (
              expandedDirs.has(item.path) ? (
                <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              getFileIcon(item.name)
            )}
            <span className="text-sm truncate text-foreground">
              {item.name}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {item.type === 'file' && (
              <>
                <span>{formatFileSize(item.size)}</span>
                <span className="font-mono">{item.permissionsRwx}</span>
              </>
            )}
          </div>
        </div>
        
        {item.type === 'directory' && 
         expandedDirs.has(item.path) && 
         item.children && 
         renderCompactView(item.children, level + 1)}
      </div>
    ));
  };

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
    <div className="h-full flex bg-card rounded-xl border border-border overflow-hidden">
      {/* Files List */}
      <div className={`flex flex-col transition-all duration-300 ease-in-out ${
        showFilePanel && (selectedFile || selectedImage) ? 'hidden md:block md:w-[40%] lg:w-[35%]' : 'w-full'
      }`}>
      {/* View Mode Toggle */}
      <div className="py-3 px-3 md:px-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Files</h3>
        <div className="flex gap-1">
          <Button
            variant={viewMode === 'simple' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => changeViewMode('simple')}
            title="Simple view"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'compact' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => changeViewMode('compact')}
            title="Compact view"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === 'detailed' ? 'default' : 'ghost'}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => changeViewMode('detailed')}
            title="Detailed view"
          >
            <TableProperties className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Column Headers for Detailed View */}
      {viewMode === 'detailed' && files.length > 0 && (
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
          <div className={viewMode === 'detailed' ? '' : 'space-y-1'}>
            {viewMode === 'simple' && renderFileTree(files)}
            {viewMode === 'compact' && renderCompactView(files)}
            {viewMode === 'detailed' && renderDetailedView(files)}
          </div>
        )}
      </ScrollArea>
      </div>
      
      {/* File Viewer Panel - Integrated Side Panel */}
      {showFilePanel && (selectedFile || selectedImage) && (
        <div className="flex-1 md:border-l border-border bg-background overflow-hidden transition-all duration-300 ease-in-out">
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
      )}
    </div>
  );
}

export default FileTree;