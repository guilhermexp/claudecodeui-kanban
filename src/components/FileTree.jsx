import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { Folder, FolderOpen, File, FileText, FileCode } from 'lucide-react';
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
    const name = filename.toLowerCase();
    
    // Special files by name
    if (name === 'dockerfile') return <span className="w-4 h-4 flex-shrink-0">🐳</span>;
    if (name === '.dockerignore') return <span className="w-4 h-4 flex-shrink-0">🐳</span>;
    if (name === '.gitignore') return <span className="w-4 h-4 flex-shrink-0">🔸</span>;
    if (name === '.prettierrc' || name === '.prettierignore') return <span className="w-4 h-4 flex-shrink-0">🎨</span>;
    if (name === 'package.json' || name === 'package-lock.json') return <span className="w-4 h-4 flex-shrink-0">📦</span>;
    if (name === 'tsconfig.json' || name === 'tsconfig.buildinfo') return <span className="w-4 h-4 flex-shrink-0">🔷</span>;
    if (name === '.env' || name.startsWith('.env.')) return <span className="w-4 h-4 flex-shrink-0">🔐</span>;
    if (name === 'readme.md' || name === 'readme.txt') return <span className="w-4 h-4 flex-shrink-0">📘</span>;
    
    // Files by extension
    switch(ext) {
      // TypeScript
      case 'ts':
      case 'tsx':
        return <span className="w-4 h-4 text-blue-500 flex-shrink-0 font-bold">TS</span>;
      
      // JavaScript  
      case 'js':
      case 'jsx':
      case 'mjs':
        return <span className="w-4 h-4 text-yellow-500 flex-shrink-0 font-bold">JS</span>;
      
      // Config files
      case 'json':
        return <span className="w-4 h-4 flex-shrink-0">{name.includes('config') ? '⚙️' : '{ }'}</span>;
      case 'yaml':
      case 'yml':
        return <span className="w-4 h-4 flex-shrink-0">📋</span>;
      
      // Documentation
      case 'md':
        return <span className="w-4 h-4 flex-shrink-0">📝</span>;
      
      // SQL
      case 'sql':
        return <span className="w-4 h-4 flex-shrink-0">🗃️</span>;
      
      // Shell scripts
      case 'sh':
      case 'bash':
        return <span className="w-4 h-4 flex-shrink-0">🖥️</span>;
      
      // Images
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
      case 'ico':
        return <span className="w-4 h-4 flex-shrink-0">🖼️</span>;
      
      // Other code files
      case 'py':
        return <span className="w-4 h-4 text-blue-400 flex-shrink-0">🐍</span>;
      case 'go':
        return <span className="w-4 h-4 text-cyan-500 flex-shrink-0">Go</span>;
      case 'rs':
        return <span className="w-4 h-4 text-orange-600 flex-shrink-0">🦀</span>;
      case 'java':
        return <span className="w-4 h-4 text-red-600 flex-shrink-0">☕</span>;
      
      // Default
      default:
        return <File className="w-4 h-4 text-muted-foreground flex-shrink-0" />;
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
    <div className="h-full flex bg-card rounded-xl border border-border overflow-hidden">
      {/* Files List */}
      <div className={`flex flex-col transition-all duration-300 ease-in-out ${
        showFilePanel ? 'hidden md:flex md:w-[40%] lg:w-[35%]' : 'flex-1'
      }`}>
      {/* View Mode Toggle */}
      <div className="py-3 px-3 md:px-4 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">Files</h3>
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
          <div className="space-y-1">
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
  );
}

export default FileTree;