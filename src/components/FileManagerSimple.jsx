import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { ScrollArea } from './ui/scroll-area';
import { Button } from './ui/button';
import { 
  Folder, FolderOpen, File, FileText, FileCode, FilePlus, FolderPlus,
  MoreVertical, Trash2, Edit2, Copy, Scissors, Clipboard, Download,
  Upload, RefreshCw, Search, X, ChevronRight, ChevronDown, Eye,
  EyeOff, AlertCircle, CheckCircle, Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { api } from '../utils/api';
import CodeEditor from './CodeEditor';
import ImageViewer from './ImageViewer';
import { formatFileSize, formatRelativeTime } from '../utils/formatters';

// Simple File Manager - Updates only on manual refresh or project change
function FileManagerSimple({ selectedProject }) {
  // State Management
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedDirs, setExpandedDirs] = useState(new Set());
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedImage, setSelectedImage] = useState(null);
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showHiddenFiles, setShowHiddenFiles] = useState(false);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const codeEditorRef = useRef(null);
  const containerRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  // Context Menu State
  const [contextMenu, setContextMenu] = useState(null);
  const [renameItem, setRenameItem] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  
  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState('file');
  const [createName, setCreateName] = useState('');
  const [createPath, setCreatePath] = useState('');
  const [createError, setCreateError] = useState('');
  
  // Refs for caching
  const lastProjectPath = useRef(null);
  const expandedCache = useRef(new Set());

  // Observe container width for responsive tweaks when used in a narrow side panel
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const entry = entries[0];
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const compact = containerWidth > 0 && containerWidth < 360;
  const tight = containerWidth > 0 && containerWidth < 300;
  
  // Fetch files from server
  const fetchFiles = useCallback(async () => {
    if (!selectedProject) return;
    
    // Skip fetching for standalone mode or invalid projects
    if (selectedProject.isStandalone || selectedProject.path === 'STANDALONE_MODE') {
      setFiles([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const response = await api.getFiles(selectedProject.name);
      
      if (!response.ok) {
        throw new Error('Failed to fetch files');
      }
      
      const data = await response.json();
      setFiles(data);
      
      // Preserve expanded state between refreshes
      if (expandedCache.current.size > 0 && lastProjectPath.current === selectedProject.path) {
        setExpandedDirs(expandedCache.current);
      } else {
        // Auto-expand first 3 directories only on first load
        const firstLevelDirs = data
          .filter(item => item.type === 'directory')
          .slice(0, 3)
          .map(item => item.path);
        setExpandedDirs(new Set(firstLevelDirs));
      }
      
      lastProjectPath.current = selectedProject.path;
      
    } catch (error) {
      console.error('Error fetching files:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [selectedProject]);
  
  // Load files when project changes
  useEffect(() => {
    if (selectedProject) {
      // Skip for standalone mode
      if (selectedProject.isStandalone || selectedProject.path === 'STANDALONE_MODE') {
        setFiles([]);
        setLoading(false);
        return;
      }
      
      // Only fetch if project actually changed
      if (lastProjectPath.current !== selectedProject.path) {
        fetchFiles();
      }
    }
  }, [selectedProject, fetchFiles]);
  
  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setContextMenu(null);
        setRenameItem(null);
        setShowCreateModal(false);
      }
    };
    
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);
  
  // Toggle directory expansion
  const toggleDirectory = useCallback((path, e) => {
    if (e) {
      e.stopPropagation();
    }
    setExpandedDirs(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      expandedCache.current = newExpanded;
      return newExpanded;
    });
  }, []);
  
  // Open file or folder
  const handleOpen = useCallback((item) => {
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
  }, [selectedProject, toggleDirectory]);
  
  // Context menu
  const handleContextMenu = useCallback((e, item) => {
    e.preventDefault();
    e.stopPropagation();
    
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      item: item
    });
  }, []);
  
  // Create file/folder
  const handleCreate = async () => {
    if (!createName.trim()) {
      setCreateError('Name cannot be empty');
      return;
    }
    
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
      
      setShowCreateModal(false);
      setCreateName('');
      setCreatePath('');
      
      // Refresh to show new file/folder
      await fetchFiles();
    } catch (error) {
      console.error('Error creating:', error);
      setCreateError('Failed to create');
    }
  };
  
  // Rename file/folder
  const startRename = (item) => {
    setRenameItem(item);
    setRenameValue(item.name);
  };
  
  const handleRename = async () => {
    if (!renameValue.trim() || renameValue === renameItem.name) {
      setRenameItem(null);
      return;
    }
    
    try {
      const response = await fetch('/api/files/rename', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        },
        body: JSON.stringify({
          projectName: selectedProject.name,
          oldPath: renameItem.path,
          newName: renameValue
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to rename');
      }
      
      setRenameItem(null);
      
      // Refresh to show renamed file/folder
      await fetchFiles();
    } catch (error) {
      console.error('Error renaming:', error);
      alert('Failed to rename file/folder');
    }
  };
  
  // Delete files/folders
  const handleDelete = async (item) => {
    const message = `Delete "${item.name}"?`;
    
    if (!confirm(message)) return;
    
    try {
      const response = await fetch('/api/files/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth-token')}`
        },
        body: JSON.stringify({
          projectName: selectedProject.name,
          path: item.path
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to delete ${item.name}`);
      }
      
      // Refresh to remove deleted file/folder
      await fetchFiles();
    } catch (error) {
      console.error('Error deleting:', error);
      alert(error.message);
    }
  };
  
  // Manual refresh
  const handleRefresh = async () => {
    await fetchFiles();
  };
  
  // File type helpers
  const isImageFile = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp'];
    return imageExtensions.includes(ext);
  };
  
  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    const name = filename.toLowerCase();
    
    // Special files by name
    if (name === 'dockerfile') return <span className="text-xs flex-shrink-0">🐳</span>;
    if (name === '.dockerignore') return <span className="text-xs flex-shrink-0">🐳</span>;
    if (name === '.gitignore') return <span className="text-xs flex-shrink-0">🔸</span>;
    if (name === '.env' || name.startsWith('.env.')) return <span className="text-xs flex-shrink-0">🔐</span>;
    if (name === 'package.json') return <span className="text-xs flex-shrink-0">📦</span>;
    if (name === 'readme.md') return <span className="text-xs flex-shrink-0">📘</span>;
    
    // Files by extension
    switch(ext) {
      case 'ts':
      case 'tsx':
        return <span className="text-[10px] text-primary flex-shrink-0 font-bold">TS</span>;
      case 'js':
      case 'jsx':
        return <span className="text-[10px] text-secondary flex-shrink-0 font-bold">JS</span>;
      case 'json':
        return <span className="text-xs flex-shrink-0">{ }</span>;
      case 'md':
        return <span className="text-xs flex-shrink-0">📝</span>;
      case 'css':
      case 'scss':
        return <span className="text-xs flex-shrink-0">🎨</span>;
      case 'html':
        return <span className="text-xs flex-shrink-0">🌐</span>;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
        return <span className="text-xs flex-shrink-0">🖼️</span>;
      default:
        return <File className="w-3 h-3 text-muted-foreground flex-shrink-0" />;
    }
  };
  
  // Search filter
  const filterFiles = useCallback((items) => {
    if (!searchQuery) return items;
    
    const query = searchQuery.toLowerCase();
    
    return items.reduce((filtered, item) => {
      const matchesSearch = item.name.toLowerCase().includes(query);
      
      if (item.type === 'directory' && item.children) {
        const filteredChildren = filterFiles(item.children);
        if (filteredChildren.length > 0) {
          filtered.push({
            ...item,
            children: filteredChildren
          });
        } else if (matchesSearch) {
          filtered.push(item);
        }
      } else if (matchesSearch) {
        filtered.push(item);
      }
      
      return filtered;
    }, []);
  }, [searchQuery]);
  
  // Render file tree
  const renderFileTree = useCallback((items, level = 0) => {
    const filtered = showHiddenFiles 
      ? filterFiles(items)
      : filterFiles(items.filter(item => !item.name.startsWith('.')));
    
    const indentSize = compact ? 8 : 10;
    const indentBase = compact ? 6 : 8;

    return filtered.map((item) => {
      const isExpanded = expandedDirs.has(item.path);
      
      return (
        <div key={item.path} className="select-none">
          <div
            className={cn(
              "w-full flex items-center justify-start px-2 h-auto cursor-pointer rounded-sm hover:bg-accent transition-colors",
              compact ? "py-0.5" : "py-1",
              "touch-manipulation active:bg-accent/80 min-h-[26px] md:min-h-0",
            )}
            style={{ paddingLeft: `${level * indentSize + indentBase}px` }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleOpen(item);
            }}
            onContextMenu={(e) => handleContextMenu(e, item)}
          >
            <div className="flex items-center gap-2 min-w-0 w-full">
              {item.type === 'directory' ? (
                <>
                  <button
                    onClick={(e) => toggleDirectory(item.path, e)}
                    className="p-0.5 hover:bg-accent-foreground/10 rounded"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-3 h-3" />
                    ) : (
                      <ChevronRight className="w-3 h-3" />
                    )}
                  </button>
                  {isExpanded ? (
                    <FolderOpen className="w-3 h-3 text-primary flex-shrink-0" />
                  ) : (
                    <Folder className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  )}
                </>
              ) : (
                <>
                  <span className="w-4" /> {/* Spacer for alignment */}
                  {getFileIcon(item.name)}
                </>
              )}
              
              {renameItem === item ? (
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename();
                    if (e.key === 'Escape') setRenameItem(null);
                  }}
                  onBlur={handleRename}
                  className="flex-1 px-1 py-0 text-xs bg-background border rounded"
                  onClick={(e) => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span className={`truncate text-foreground ${compact ? 'text-[11px] max-w-[120px]' : 'text-xs max-w-[150px]'}`} title={item.name}>
                  {item.name}
                </span>
              )}
            </div>
          </div>
          
          {item.type === 'directory' && isExpanded && item.children && item.children.length > 0 && (
            <div>
              {renderFileTree(item.children, level + 1)}
            </div>
          )}
        </div>
      );
    });
  }, [
    expandedDirs, renameItem, renameValue, showHiddenFiles, searchQuery,
    filterFiles, handleOpen, handleContextMenu, toggleDirectory
  ]);
  
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-card rounded-xl border border-border">
        <div className="text-gray-500 dark:text-gray-400">
          Loading files...
        </div>
      </div>
    );
  }
  
  return (
    <>
    <div ref={containerRef} className="h-full flex bg-card rounded-xl border border-border overflow-hidden">
      {/* Files List */}
      <div className={`flex flex-col transition-all duration-300 ease-in-out ${
        showFilePanel ? 'hidden md:flex md:w-[25%] lg:w-[20%] xl:w-[18%]' : 'flex-1'
      }`}>
        {/* Header */}
        <div className={`${compact ? 'py-2' : 'py-3'} px-3 md:px-4 border-b border-border`}> 
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`text-foreground font-medium ${compact ? 'text-sm' : ''}`}>Files</h3>
              {selectedProject?.path && (
                <div className={`mt-1 flex items-center gap-1 text-muted-foreground/70 ${compact ? 'text-[10px]' : 'text-[11px] sm:text-xs'}`}>
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-5l-2-2H5a2 2 0 00-2 2z" />
                  </svg>
                  <span className={`truncate ${compact ? 'max-w-[120px]' : 'max-w-[160px] sm:max-w-[220px]'}`} title={selectedProject.path}>
                    {selectedProject.path.split('/').pop()}
                  </span>
                </div>
              )}
            </div>
            <div className={`flex items-center ${compact ? 'gap-0.5' : 'gap-1'}`}>
             <button
               onClick={() => setShowHiddenFiles(!showHiddenFiles)}
              className={cn("hover:bg-accent rounded-md transition-colors", compact ? 'p-0.5' : 'p-1', showHiddenFiles && "bg-accent")}
               title={showHiddenFiles ? "Hide hidden files" : "Show hidden files"}
             >
              {showHiddenFiles ? <Eye className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} /> : <EyeOff className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} />}
              </button>
              <button
                onClick={() => {
                  setCreateType('file');
                  setCreateType('file');
                  setShowCreateModal(true);
                  setCreatePath('');
                  setCreateName('');
                  setCreateError('');
                }}
              className={`hover:bg-accent rounded-md transition-colors ${compact ? 'p-0.5' : 'p-1'}`}
                title="New File"
              >
              <FilePlus className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-muted-foreground`} />
              </button>
              <button
                onClick={() => {
                  setCreateType('folder');
                  setShowCreateModal(true);
                  setCreatePath('');
                  setCreateName('');
                  setCreateError('');
                }}
              className={`hover:bg-accent rounded-md transition-colors ${compact ? 'p-0.5' : 'p-1'}`}
                title="New Folder"
              >
              <FolderPlus className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-muted-foreground`} />
              </button>
              <button
                onClick={handleRefresh}
              className={cn(`hover:bg-accent rounded-md transition-colors ${compact ? 'p-0.5' : 'p-1'}`, loading && "animate-spin")}
                title="Refresh"
              >
              <RefreshCw className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-muted-foreground`} />
              </button>
            </div>
          </div>
        </div>
        
        {/* Search Bar */}
        <div className={`${compact ? 'p-1.5' : 'p-2'} border-b border-border`}>
          <div className="relative">
            <Search className={`absolute left-2 top-1/2 -translate-y-1/2 ${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} text-muted-foreground`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search files..."
              className={`w-full ${compact ? 'pl-7 pr-7 py-1 text-[13px]' : 'pl-8 pr-8 py-1 text-sm'} bg-background border rounded focus:outline-none focus:ring-1 focus:ring-primary`}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className={`absolute right-2 top-1/2 -translate-y-1/2 ${compact ? 'p-0.5' : 'p-0.5'} hover:bg-accent rounded`}
              >
                <X className={`${compact ? 'w-3 h-3' : 'w-3 h-3'}`} />
              </button>
            )}
          </div>
        </div>
        
        {/* File Tree */}
        <ScrollArea className={`flex-1 ${compact ? 'p-2' : 'p-4'}`}>
          {selectedProject?.isStandalone || selectedProject?.path === 'STANDALONE_MODE' ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center mx-auto mb-3">
                <Info className="w-6 h-6 text-muted-foreground" />
              </div>
              <h4 className="font-medium text-foreground mb-1">Standalone Mode</h4>
              <p className="text-sm text-muted-foreground">
                No project files in Claude standalone mode
              </p>
            </div>
          ) : files.length === 0 ? (
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
                  title="Back"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {getFileIcon(selectedFile.name)}
                <span className="text-sm font-medium truncate">{selectedFile.name}</span>
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center gap-1">
                {/* Copy button */}
                <button
                  onClick={() => {
                    if (selectedFile && selectedFile.path) {
                      navigator.clipboard.writeText(selectedFile.content || '');
                      // Optional: Show a toast or feedback
                    }
                  }}
                  className="p-1.5 hover:bg-accent rounded transition-colors"
                  title="Copy content"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
                
                {/* Download button */}
                <button
                  onClick={() => {
                    if (selectedFile && selectedFile.content) {
                      const blob = new Blob([selectedFile.content], { type: 'text/plain' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = selectedFile.name;
                      a.click();
                      window.URL.revokeObjectURL(url);
                    }
                  }}
                  className="p-1.5 hover:bg-accent rounded transition-colors"
                  title="Download file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                
                {/* Eye/View button - only for markdown files */}
                {selectedFile.name.toLowerCase().endsWith('.md') && (
                  <button
                    onClick={() => {
                      setShowMarkdownPreview(!showMarkdownPreview);
                    }}
                    className={`p-1.5 rounded transition-colors ${
                      showMarkdownPreview 
                        ? 'bg-accent text-foreground' 
                        : 'hover:bg-accent'
                    }`}
                    title={showMarkdownPreview ? "Show raw markdown" : "Preview markdown"}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </button>
                )}
                
                {/* Save button */}
                <button
                  onClick={() => {
                    // Trigger save in CodeEditor through ref
                    if (codeEditorRef.current && codeEditorRef.current.save) {
                      codeEditorRef.current.save();
                    }
                  }}
                  className="p-1.5 hover:bg-accent rounded transition-colors"
                  title="Save file (Ctrl+S)"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V2" />
                  </svg>
                </button>
                
                {/* Delete button */}
                <button
                  onClick={async () => {
                    if (selectedFile && window.confirm(`Delete ${selectedFile.name}?`)) {
                      try {
                        const response = await fetch('/api/files/delete', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            path: selectedFile.path,
                            projectPath: selectedFile.projectPath 
                          })
                        });
                        
                        if (response.ok) {
                          setSelectedFile(null);
                          setShowFilePanel(false);
                          fetchFiles(); // Refresh the file tree
                        }
                      } catch (error) {
                        console.error('Error deleting file:', error);
                      }
                    }
                  }}
                  className="p-1.5 hover:bg-destructive/20 text-destructive rounded transition-colors"
                  title="Delete file"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                
                {/* Close button */}
                <button
                  onClick={() => {
                    setShowFilePanel(false);
                    setSelectedFile(null);
                  }}
                  className="p-1.5 hover:bg-accent rounded transition-colors hidden md:block"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            {/* Code Editor Inline */}
            <div className="flex-1 overflow-hidden">
              <CodeEditor
                ref={codeEditorRef}
                file={selectedFile}
                onClose={() => {
                  setSelectedFile(null);
                  setShowFilePanel(false);
                }}
                projectPath={selectedFile.projectPath}
                inline={true}
                showMarkdownPreview={showMarkdownPreview}
                onToggleMarkdownPreview={() => setShowMarkdownPreview(!showMarkdownPreview)}
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
                  title="Back"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                {getFileIcon(selectedImage.name)}
                <span className="text-sm font-medium truncate">{selectedImage.name}</span>
              </div>
              
              {/* Action buttons */}
              <div className="flex items-center gap-1">
                {/* Download button */}
                <button
                  onClick={async () => {
                    if (selectedImage && selectedImage.path) {
                      try {
                        // Fetch the image and download it
                        const response = await fetch(`/api/files/read?path=${encodeURIComponent(selectedImage.path)}&projectPath=${encodeURIComponent(selectedImage.projectPath)}`);
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = selectedImage.name;
                        a.click();
                        window.URL.revokeObjectURL(url);
                      } catch (error) {
                        console.error('Error downloading image:', error);
                      }
                    }
                  }}
                  className="p-1.5 hover:bg-accent rounded transition-colors"
                  title="Download image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </button>
                
                {/* Open in new tab button */}
                <button
                  onClick={() => {
                    if (selectedImage && selectedImage.path) {
                      const imageUrl = `/api/files/read?path=${encodeURIComponent(selectedImage.path)}&projectPath=${encodeURIComponent(selectedImage.projectPath)}`;
                      window.open(imageUrl, '_blank');
                    }
                  }}
                  className="p-1.5 hover:bg-accent rounded transition-colors"
                  title="Open in new tab"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>
                
                {/* Delete button */}
                <button
                  onClick={async () => {
                    if (selectedImage && window.confirm(`Delete ${selectedImage.name}?`)) {
                      try {
                        const response = await fetch('/api/files/delete', {
                          method: 'DELETE',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ 
                            path: selectedImage.path,
                            projectPath: selectedImage.projectPath 
                          })
                        });
                        
                        if (response.ok) {
                          setSelectedImage(null);
                          setShowFilePanel(false);
                          fetchFiles(); // Refresh the file tree
                        }
                      } catch (error) {
                        console.error('Error deleting image:', error);
                      }
                    }
                  }}
                  className="p-1.5 hover:bg-destructive/20 text-destructive rounded transition-colors"
                  title="Delete image"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
                
                {/* Close button */}
                <button
                  onClick={() => {
                    setShowFilePanel(false);
                    setSelectedImage(null);
                  }}
                  className="p-1.5 hover:bg-accent rounded transition-colors hidden md:block"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
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
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => {
            handleOpen(contextMenu.item);
            setContextMenu(null);
          }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
        >
          <Eye className="w-4 h-4" />
          Open
        </button>
        
        <div className="h-px bg-border my-1" />
        
        <button
          onClick={() => {
            startRename(contextMenu.item);
            setContextMenu(null);
          }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
        >
          <Edit2 className="w-4 h-4" />
          Rename
        </button>
        
        <button
          onClick={() => {
            handleDelete(contextMenu.item);
            setContextMenu(null);
          }}
          className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2 text-destructive"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </button>
        
        {contextMenu.item.type === 'directory' && (
          <>
            <div className="h-px bg-border my-1" />
            <button
              onClick={() => {
                setCreateType('file');
                setCreatePath(contextMenu.item.path);
                setShowCreateModal(true);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
            >
              <FilePlus className="w-4 h-4" />
              New File
            </button>
            
            <button
              onClick={() => {
                setCreateType('folder');
                setCreatePath(contextMenu.item.path);
                setShowCreateModal(true);
                setContextMenu(null);
              }}
              className="w-full px-3 py-1.5 text-left text-sm hover:bg-accent flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </button>
          </>
        )}
      </div>
    )}
    
    {/* Create Modal */}
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
              <div className="text-sm text-destructive">
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
export default React.memo(FileManagerSimple, (prevProps, nextProps) => {
  // Only re-render if selectedProject actually changed
  return prevProps.selectedProject?.path === nextProps.selectedProject?.path &&
         prevProps.selectedProject?.name === nextProps.selectedProject?.name;
});
