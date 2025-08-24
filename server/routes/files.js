import express from 'express';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { extractProjectDirectory } from '../projects.js';
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import os from 'os';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: path.join(os.tmpdir(), 'claude-code-uploads'),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 100 // Max 100 files at once
  }
});

// Rename file or folder
router.post('/rename', authenticateToken, async (req, res) => {
  try {
    const { projectName, oldPath, newName } = req.body;
    
    if (!projectName || !oldPath || !newName) {
      return res.status(400).json({ error: 'Project name, old path, and new name are required' });
    }
    
    // Get the actual project directory
    let projectDir;
    try {
      projectDir = await extractProjectDirectory(projectName);
    } catch (error) {
      console.error('Error extracting project directory:', error);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Construct full paths
    const fullOldPath = path.join(projectDir, oldPath);
    const parentDir = path.dirname(fullOldPath);
    const fullNewPath = path.join(parentDir, newName);
    
    // Check if old path exists
    try {
      await fsPromises.access(fullOldPath);
    } catch (e) {
      return res.status(404).json({ error: 'File or folder not found' });
    }
    
    // Check if new path already exists
    try {
      await fsPromises.access(fullNewPath);
      return res.status(400).json({ error: 'A file or folder with that name already exists' });
    } catch (e) {
      // Good, it doesn't exist
    }
    
    // Rename
    await fsPromises.rename(fullOldPath, fullNewPath);
    console.log('✏️ Renamed:', fullOldPath, '→', fullNewPath);
    
    res.json({ 
      success: true, 
      message: 'Renamed successfully',
      newPath: fullNewPath
    });
  } catch (error) {
    console.error('Error renaming:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete file or folder
router.delete('/delete', authenticateToken, async (req, res) => {
  try {
    const { projectName, path: filePath } = req.body;
    
    if (!projectName || !filePath) {
      return res.status(400).json({ error: 'Project name and path are required' });
    }
    
    // Get the actual project directory
    let projectDir;
    try {
      projectDir = await extractProjectDirectory(projectName);
    } catch (error) {
      console.error('Error extracting project directory:', error);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Construct the full path
    const fullPath = path.join(projectDir, filePath);
    
    // Check if exists
    let stats;
    try {
      stats = await fsPromises.stat(fullPath);
    } catch (e) {
      return res.status(404).json({ error: 'File or folder not found' });
    }
    
    // Delete
    if (stats.isDirectory()) {
      await fsPromises.rm(fullPath, { recursive: true, force: true });
      console.log('🗑️ Deleted folder:', fullPath);
    } else {
      await fsPromises.unlink(fullPath);
      console.log('🗑️ Deleted file:', fullPath);
    }
    
    res.json({ 
      success: true, 
      message: 'Deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting:', error);
    res.status(500).json({ error: error.message });
  }
});

// Copy/Cut and Paste
router.post('/paste', authenticateToken, async (req, res) => {
  try {
    const { projectName, sourcePath, targetPath, operation } = req.body;
    
    if (!projectName || !sourcePath || !operation) {
      return res.status(400).json({ error: 'Project name, source path, and operation are required' });
    }
    
    if (!['copy', 'cut'].includes(operation)) {
      return res.status(400).json({ error: 'Operation must be "copy" or "cut"' });
    }
    
    // Get the actual project directory
    let projectDir;
    try {
      projectDir = await extractProjectDirectory(projectName);
    } catch (error) {
      console.error('Error extracting project directory:', error);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Construct full paths
    const fullSourcePath = path.join(projectDir, sourcePath);
    const sourceFileName = path.basename(fullSourcePath);
    const fullTargetDir = targetPath ? path.join(projectDir, targetPath) : projectDir;
    const fullTargetPath = path.join(fullTargetDir, sourceFileName);
    
    // Check if source exists
    let sourceStats;
    try {
      sourceStats = await fsPromises.stat(fullSourcePath);
    } catch (e) {
      return res.status(404).json({ error: 'Source file or folder not found' });
    }
    
    // Check if target already exists
    try {
      await fsPromises.access(fullTargetPath);
      // If it exists, add a number suffix
      let counter = 1;
      let newTargetPath = fullTargetPath;
      const ext = path.extname(sourceFileName);
      const nameWithoutExt = path.basename(sourceFileName, ext);
      
      while (true) {
        newTargetPath = path.join(fullTargetDir, `${nameWithoutExt}_${counter}${ext}`);
        try {
          await fsPromises.access(newTargetPath);
          counter++;
        } catch {
          // This name is available
          break;
        }
      }
      
      if (operation === 'copy') {
        if (sourceStats.isDirectory()) {
          await fsPromises.cp(fullSourcePath, newTargetPath, { recursive: true });
        } else {
          await fsPromises.copyFile(fullSourcePath, newTargetPath);
        }
      } else {
        await fsPromises.rename(fullSourcePath, newTargetPath);
      }
      
      console.log(`📋 ${operation === 'copy' ? 'Copied' : 'Moved'}:`, fullSourcePath, '→', newTargetPath);
      res.json({ success: true, message: `${operation === 'copy' ? 'Copied' : 'Moved'} with new name`, newPath: newTargetPath });
      
    } catch (e) {
      // Target doesn't exist, proceed normally
      if (operation === 'copy') {
        if (sourceStats.isDirectory()) {
          await fsPromises.cp(fullSourcePath, fullTargetPath, { recursive: true });
        } else {
          await fsPromises.copyFile(fullSourcePath, fullTargetPath);
        }
        console.log('📋 Copied:', fullSourcePath, '→', fullTargetPath);
      } else {
        await fsPromises.rename(fullSourcePath, fullTargetPath);
        console.log('✂️ Moved:', fullSourcePath, '→', fullTargetPath);
      }
      
      res.json({ 
        success: true, 
        message: operation === 'copy' ? 'Copied successfully' : 'Moved successfully',
        newPath: fullTargetPath
      });
    }
  } catch (error) {
    console.error('Error in paste operation:', error);
    res.status(500).json({ error: error.message });
  }
});

// Move file or folder (for drag & drop)
router.post('/move', authenticateToken, async (req, res) => {
  try {
    const { projectName, sourcePath, targetPath } = req.body;
    
    if (!projectName || !sourcePath || !targetPath) {
      return res.status(400).json({ error: 'Project name, source path, and target path are required' });
    }
    
    // Get the actual project directory
    let projectDir;
    try {
      projectDir = await extractProjectDirectory(projectName);
    } catch (error) {
      console.error('Error extracting project directory:', error);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Construct full paths
    const fullSourcePath = path.join(projectDir, sourcePath);
    const sourceFileName = path.basename(fullSourcePath);
    const fullTargetDir = path.join(projectDir, targetPath);
    const fullTargetPath = path.join(fullTargetDir, sourceFileName);
    
    // Check if source exists
    try {
      await fsPromises.access(fullSourcePath);
    } catch (e) {
      return res.status(404).json({ error: 'Source file or folder not found' });
    }
    
    // Check if target directory exists
    try {
      const targetStats = await fsPromises.stat(fullTargetDir);
      if (!targetStats.isDirectory()) {
        return res.status(400).json({ error: 'Target must be a directory' });
      }
    } catch (e) {
      return res.status(404).json({ error: 'Target directory not found' });
    }
    
    // Check if would overwrite
    try {
      await fsPromises.access(fullTargetPath);
      return res.status(400).json({ error: 'A file or folder with that name already exists in the target directory' });
    } catch (e) {
      // Good, it doesn't exist
    }
    
    // Move
    await fsPromises.rename(fullSourcePath, fullTargetPath);
    console.log('🚚 Moved:', fullSourcePath, '→', fullTargetPath);
    
    res.json({ 
      success: true, 
      message: 'Moved successfully',
      newPath: fullTargetPath
    });
  } catch (error) {
    console.error('Error moving:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload files
router.post('/upload', authenticateToken, upload.array('files', 100), async (req, res) => {
  try {
    const { projectName, targetPath } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    // Get the actual project directory
    let projectDir;
    try {
      projectDir = await extractProjectDirectory(projectName);
    } catch (error) {
      console.error('Error extracting project directory:', error);
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Determine target directory
    const fullTargetDir = targetPath 
      ? path.join(projectDir, targetPath)
      : projectDir;
    
    // Ensure target directory exists
    await fsPromises.mkdir(fullTargetDir, { recursive: true });
    
    // Process uploaded files
    const uploadedFiles = [];
    for (const file of req.files) {
      const targetFilePath = path.join(fullTargetDir, file.originalname);
      
      // Check if file already exists
      let finalPath = targetFilePath;
      try {
        await fsPromises.access(targetFilePath);
        // File exists, add number suffix
        let counter = 1;
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        
        while (true) {
          finalPath = path.join(fullTargetDir, `${nameWithoutExt}_${counter}${ext}`);
          try {
            await fsPromises.access(finalPath);
            counter++;
          } catch {
            break;
          }
        }
      } catch {
        // File doesn't exist, use original name
      }
      
      // Move file from temp to target
      await fsPromises.rename(file.path, finalPath);
      console.log('📤 Uploaded:', file.originalname, '→', finalPath);
      
      uploadedFiles.push({
        originalName: file.originalname,
        path: finalPath,
        size: file.size
      });
    }
    
    res.json({ 
      success: true, 
      message: `Uploaded ${uploadedFiles.length} file(s) successfully`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    // Clean up temp files on error
    if (req.files) {
      for (const file of req.files) {
        try {
          await fsPromises.unlink(file.path);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;