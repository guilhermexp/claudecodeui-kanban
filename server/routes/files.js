import express from 'express';
import path from 'path';
import fs from 'fs';
import { promises as fsPromises } from 'fs';
import { extractProjectDirectory } from '../projects.js';
import { authenticateToken } from '../middleware/auth.js';
import multer from 'multer';
import os from 'os';
import { createLogger } from '../utils/logger.js';

const router = express.Router();
const log = createLogger('FILES');

// Directory and file exclusions to keep the tree compact
const EXCLUDED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  '.cache',
  '.output',
  '.expo',
  '.nuxt',
  '.vercel',
  'dist',
  'build',
  'tmp',
  'temp'
]);
const EXCLUDED_FILES = new Set(['.DS_Store', 'Thumbs.db']);
const MAX_FILE_TREE_ITEMS = 6000;
const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true });

const toPosixPath = (relativePath) => relativePath.split(path.sep).join('/');

const readDirectoryEntries = async (absolutePath) => {
  try {
    return await fsPromises.readdir(absolutePath, { withFileTypes: true });
  } catch (error) {
    log.warn(`Unable to read directory ${absolutePath}: ${error.message}`);
    return [];
  }
};

const walkProjectTree = async (rootDir, relativePath, state) => {
  if (state.total >= MAX_FILE_TREE_ITEMS) {
    return [];
  }

  const absolute = relativePath ? path.join(rootDir, relativePath) : rootDir;
  const entries = await readDirectoryEntries(absolute);

  entries.sort((a, b) => {
    const aIsDir = a.isDirectory() && !a.isSymbolicLink();
    const bIsDir = b.isDirectory() && !b.isSymbolicLink();
    if (aIsDir !== bIsDir) {
      return aIsDir ? -1 : 1;
    }
    return collator.compare(a.name, b.name);
  });

  const nodes = [];

  for (const entry of entries) {
    if (state.total >= MAX_FILE_TREE_ITEMS) {
      break;
    }

    if (!entry || !entry.name) continue;

    const isDirectory = entry.isDirectory() && !entry.isSymbolicLink();
    if (isDirectory && EXCLUDED_DIRECTORIES.has(entry.name)) {
      continue;
    }
    if (!isDirectory && EXCLUDED_FILES.has(entry.name)) {
      continue;
    }

    const nextRelative = relativePath ? path.join(relativePath, entry.name) : entry.name;
    const normalizedPath = toPosixPath(nextRelative);

    const node = {
      name: entry.name,
      path: normalizedPath,
      type: isDirectory ? 'directory' : 'file'
    };

    state.total += 1;
    nodes.push(node);

    if (isDirectory) {
      node.children = await walkProjectTree(rootDir, nextRelative, state);
    }
  }

  return nodes;
};

const buildProjectFileTree = async (projectDir) => {
  const traversalState = { total: 0 };
  return walkProjectTree(projectDir, '', traversalState);
};

// Configure multer for file uploads
const upload = multer({
  dest: path.join(os.tmpdir(), 'claude-code-uploads'),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 100 // Max 100 files at once
  }
});

// List directories in a path
router.get('/list-dirs', authenticateToken, async (req, res) => {
  try {
    const { path: dirPath = '/' } = req.query;
    
    // Resolve path (handle ~ for home directory)
    let resolvedPath = dirPath;
    if (dirPath.startsWith('~')) {
      resolvedPath = dirPath.replace('~', os.homedir());
    }
    
    // Ensure absolute path
    if (!path.isAbsolute(resolvedPath)) {
      resolvedPath = path.resolve(resolvedPath);
    }
    
    // Check if path exists and is a directory
    try {
      const stats = await fsPromises.stat(resolvedPath);
      if (!stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is not a directory' });
      }
    } catch (err) {
      return res.status(404).json({ error: 'Directory not found' });
    }
    
    // Read directory contents
    const items = await fsPromises.readdir(resolvedPath, { withFileTypes: true });
    
    // Check if we're in a user's home directory
    const homeDir = os.homedir();
    const isInUserHome = resolvedPath === homeDir || resolvedPath === `/Users/${path.basename(homeDir)}`;
    
    // Filter and map directories
    const directories = await Promise.all(
      items
        .filter(item => item.isDirectory())
        .filter(item => !item.name.startsWith('.')) // Skip hidden folders
        .filter(item => {
          // If we're in user home, only show Documents and Downloads
          if (isInUserHome) {
            return item.name === 'Documents' || item.name === 'Downloads';
          }
          return true; // Show all folders in other directories
        })
        .map(async (item) => {
          const itemPath = path.join(resolvedPath, item.name);
          try {
            const stats = await fsPromises.stat(itemPath);
            return {
              name: item.name,
              path: itemPath,
              type: 'directory',
              size: stats.size,
              modified: stats.mtime
            };
          } catch (err) {
            // Skip items we can't access
            return null;
          }
        })
    );
    
    // Filter out nulls and sort by name
    const validDirs = directories
      .filter(dir => dir !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
    
    res.json({
      path: resolvedPath,
      files: validDirs
    });
    
  } catch (error) {
    log.error(`Error listing directories: ${error.message}`);
    res.status(500).json({ error: 'Failed to list directories' });
  }
});

// Return a project-scoped file tree for the sidebar/preview panel
router.get('/tree/:projectName', authenticateToken, async (req, res) => {
  const { projectName } = req.params;

  try {
    if (!projectName) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const projectDir = await extractProjectDirectory(projectName);
    const tree = await buildProjectFileTree(projectDir);
    res.json(tree);
  } catch (error) {
    log.error(`Error building tree for ${projectName}: ${error.message}`);
    const status = error.code === 'NOT_FOUND' ? 404 : 500;
    res.status(status).json({ error: 'Failed to load project files' });
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
      log.error(`Error extracting project directory: ${error.message}`);
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
    log.info(`Renamed: ${fullOldPath} → ${fullNewPath}`);
    
    res.json({ 
      success: true, 
      message: 'Renamed successfully',
      newPath: fullNewPath
    });
  } catch (error) {
    log.error(`Error renaming: ${error.message}`);
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
      log.error(`Error extracting project directory: ${error.message}`);
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
      log.info(`Deleted folder: ${fullPath}`);
    } else {
      await fsPromises.unlink(fullPath);
      log.info(`Deleted file: ${fullPath}`);
    }
    
    res.json({ 
      success: true, 
      message: 'Deleted successfully'
    });
  } catch (error) {
    log.error(`Error deleting: ${error.message}`);
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
      log.error(`Error extracting project directory: ${error.message}`);
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
      
      log.info(`${operation === 'copy' ? 'Copied' : 'Moved'}: ${fullSourcePath} → ${newTargetPath}`);
      res.json({ success: true, message: `${operation === 'copy' ? 'Copied' : 'Moved'} with new name`, newPath: newTargetPath });
      
    } catch (e) {
      // Target doesn't exist, proceed normally
      if (operation === 'copy') {
        if (sourceStats.isDirectory()) {
          await fsPromises.cp(fullSourcePath, fullTargetPath, { recursive: true });
        } else {
          await fsPromises.copyFile(fullSourcePath, fullTargetPath);
        }
        log.info(`Copied: ${fullSourcePath} → ${fullTargetPath}`);
      } else {
        await fsPromises.rename(fullSourcePath, fullTargetPath);
        log.info(`Moved: ${fullSourcePath} → ${fullTargetPath}`);
      }
      
      res.json({ 
        success: true, 
        message: operation === 'copy' ? 'Copied successfully' : 'Moved successfully',
        newPath: fullTargetPath
      });
    }
  } catch (error) {
    log.error(`Error in paste operation: ${error.message}`);
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
      log.error(`Error extracting project directory: ${error.message}`);
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
    log.info(`Moved: ${fullSourcePath} → ${fullTargetPath}`);
    
    res.json({ 
      success: true, 
      message: 'Moved successfully',
      newPath: fullTargetPath
    });
  } catch (error) {
    log.error(`Error moving: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Create new file or folder
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { projectName, path: filePath, type } = req.body;

    if (!projectName || !filePath || !type) {
      return res.status(400).json({ error: 'Project name, path, and type are required' });
    }

    if (!['file', 'folder'].includes(type)) {
      return res.status(400).json({ error: 'Type must be "file" or "folder"' });
    }

    // Get the actual project directory
    let projectDir;
    try {
      projectDir = await extractProjectDirectory(projectName);
    } catch (error) {
      log.error(`Error extracting project directory: ${error.message}`);
      return res.status(404).json({ error: 'Project not found' });
    }

    // Construct the full path
    const fullPath = path.join(projectDir, filePath);

    // Check if already exists
    try {
      await fsPromises.access(fullPath);
      return res.status(400).json({ error: `${type === 'file' ? 'File' : 'Folder'} already exists` });
    } catch (e) {
      // Good, it doesn't exist
    }

    // Create file or folder
    if (type === 'folder') {
      await fsPromises.mkdir(fullPath, { recursive: true });
      log.info(`Created folder: ${fullPath}`);
    } else {
      // Ensure parent directory exists
      const parentDir = path.dirname(fullPath);
      await fsPromises.mkdir(parentDir, { recursive: true });

      // Create empty file
      await fsPromises.writeFile(fullPath, '', 'utf8');
      log.info(`Created file: ${fullPath}`);
    }

    res.json({
      success: true,
      message: `${type === 'file' ? 'File' : 'Folder'} created successfully`,
      path: fullPath
    });
  } catch (error) {
    log.error(`Error creating: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Read file contents
router.get('/read', authenticateToken, async (req, res) => {
  try {
    const { path: filePath, projectPath } = req.query;

    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }

    // Resolve the full path
    let fullPath;
    if (projectPath) {
      // If projectPath is provided, use it as base
      fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectPath, filePath);
    } else {
      // Otherwise, use filePath as absolute path
      fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(filePath);
    }

    // Check if file exists
    try {
      const stats = await fsPromises.stat(fullPath);
      if (stats.isDirectory()) {
        return res.status(400).json({ error: 'Path is a directory, not a file' });
      }
    } catch (err) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Detect if it's a binary file based on extension
    const ext = path.extname(fullPath).toLowerCase();
    const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg', '.webp',
                              '.pdf', '.zip', '.tar', '.gz', '.exe', '.dll', '.so', '.dylib'];

    if (binaryExtensions.includes(ext)) {
      // For binary files (especially images), send as base64
      const fileBuffer = await fsPromises.readFile(fullPath);
      const base64 = fileBuffer.toString('base64');
      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.ico': 'image/x-icon',
        '.svg': 'image/svg+xml',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf'
      };
      const mimeType = mimeTypes[ext] || 'application/octet-stream';

      res.json({
        content: base64,
        encoding: 'base64',
        mimeType: mimeType,
        path: fullPath
      });
    } else {
      // For text files, read as UTF-8
      const content = await fsPromises.readFile(fullPath, 'utf8');
      res.json({
        content: content,
        encoding: 'utf8',
        path: fullPath
      });
    }
  } catch (error) {
    log.error(`Error reading file: ${error.message}`);
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
      log.error(`Error extracting project directory: ${error.message}`);
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
      log.info(`Uploaded: ${file.originalname} → ${finalPath}`);

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
    log.error(`Error uploading files: ${error.message}`);
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
