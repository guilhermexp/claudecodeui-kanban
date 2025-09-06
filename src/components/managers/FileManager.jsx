import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

// Context
const FileManagerContext = createContext();

// Custom hook
export const useFileManager = () => {
  const context = useContext(FileManagerContext);
  if (!context) {
    throw new Error('useFileManager must be used within a FileManager');
  }
  return context;
};

// Manager component
export const FileManager = ({ children, selectedProject }) => {
  const [editingFile, setEditingFile] = useState(null);
  const [openFiles, setOpenFiles] = useState([]);
  const [unsavedFiles, setUnsavedFiles] = useState(new Set());
  const [forceMdPreview, setForceMdPreview] = useState(false);

  // Actions
  const openFile = useCallback((filePath, options = {}) => {
    const { diffInfo = null, forceMd = false } = options;
    
    // Create file object
    const file = {
      name: filePath.split('/').pop(),
      path: filePath,
      projectName: selectedProject?.name,
      diffInfo,
      isDirty: false,
      forceMdPreview: forceMd,
    };

    setEditingFile(file);
    setForceMdPreview(forceMd || /\.(md|markdown)$/i.test(file.name));
    
    // Add to open files if not already there
    setOpenFiles(prev => {
      if (!prev.some(f => f.path === filePath)) {
        return [...prev, file];
      }
      return prev;
    });
  }, [selectedProject]);

  const closeFile = useCallback((filePath) => {
    // Close editor if this file is being edited
    if (editingFile?.path === filePath) {
      setEditingFile(null);
      setForceMdPreview(false);
    }
    
    // Remove from open files
    setOpenFiles(prev => prev.filter(f => f.path !== filePath));
    
    // Remove from unsaved files
    setUnsavedFiles(prev => {
      const newSet = new Set(prev);
      newSet.delete(filePath);
      return newSet;
    });
  }, [editingFile]);

  const closeEditor = useCallback(() => {
    setEditingFile(null);
    setForceMdPreview(false);
  }, []);

  const saveFile = useCallback(async (filePath) => {
    try {
      // File saving logic would go here
      // For now, just remove from unsaved
      setUnsavedFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
      
      // Update file's dirty state
      setOpenFiles(prev => prev.map(f => 
        f.path === filePath ? { ...f, isDirty: false } : f
      ));
      
      return true;
    } catch (error) {
      console.error('Failed to save file:', error);
      return false;
    }
  }, []);

  const setMdPreview = useCallback((filePath, force) => {
    if (editingFile?.path === filePath) {
      setForceMdPreview(force);
    }
  }, [editingFile]);

  const markFileAsDirty = useCallback((filePath) => {
    setUnsavedFiles(prev => new Set(prev).add(filePath));
    setOpenFiles(prev => prev.map(f => 
      f.path === filePath ? { ...f, isDirty: true } : f
    ));
  }, []);

  // Global handlers setup
  useEffect(() => {
    // Global markdown opener
    const openMarkdown = (absOrRelPath) => {
      try {
        const isAbs = typeof absOrRelPath === 'string' && absOrRelPath.startsWith('/');
        const path = isAbs ? absOrRelPath : ((selectedProject?.path || '') + '/' + String(absOrRelPath || ''));
        openFile(path, { forceMd: true });
      } catch (error) {
        console.error('Failed to open markdown file:', error);
      }
    };

    window.__openMarkdown = openMarkdown;
    
    return () => {
      try { 
        delete window.__openMarkdown; 
      } catch {} 
    };
  }, [selectedProject, openFile]);

  // Context value
  const value = {
    // State
    editingFile,
    openFiles,
    unsavedFiles,
    forceMdPreview,
    
    // Actions
    openFile,
    closeFile,
    closeEditor,
    saveFile,
    setMdPreview,
    markFileAsDirty,
    
    // Computed
    hasUnsavedChanges: unsavedFiles.size > 0,
    isFileOpen: (filePath) => openFiles.some(f => f.path === filePath),
    isFileEditing: (filePath) => editingFile?.path === filePath,
    isFileDirty: (filePath) => unsavedFiles.has(filePath),
  };

  return (
    <FileManagerContext.Provider value={value}>
      {children}
    </FileManagerContext.Provider>
  );
};

export default FileManager;
