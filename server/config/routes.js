// server/config/routes.js - Route Configuration
import express from 'express';
import { promises as fsPromises } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import route modules
import authRoutes from '../routes/auth.js';
import gitRoutes from '../routes/git.js';
import previewRoutes from '../routes/preview.js';
import usageRoutes from '../routes/usage.js';
import systemRoutes from '../routes/system.js';
import filesRoutes from '../routes/files.js';
import claudeHooksRoutes from '../routes/claude-hooks.js';
import claudeStreamRoutes from '../routes/claude-stream.js';
import ttsRoutes from '../routes/tts.js';
import aiRoutes from '../routes/ai.js';
import promptEnhancerRoutes from '../routes/prompt-enhancer.js';
import indexerRoutes from '../routes/indexer.js';
import promptsRoutes from '../routes/prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupRoutes(app) {
  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/git', gitRoutes);
  app.use('/api/preview', previewRoutes);
  app.use('/api/usage', usageRoutes);
  app.use('/api/system', systemRoutes);
  app.use('/api/files', filesRoutes);
  app.use('/api/claude-hooks', claudeHooksRoutes);
  app.use('/api/claude-stream', claudeStreamRoutes);
  app.use('/api/tts', ttsRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/prompt-enhancer', promptEnhancerRoutes);
  app.use('/api/indexer', indexerRoutes);
  app.use('/api/prompts', promptsRoutes);

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  });

  // Serve static files from dist directory
  const distPath = path.join(__dirname, '../../dist');
  app.use(express.static(distPath));

  // Serve index.html for all other routes (SPA routing)
  app.get('*', async (req, res) => {
    try {
      const indexPath = path.join(distPath, 'index.html');
      const exists = await fsPromises.access(indexPath).then(() => true).catch(() => false);
      
      if (exists) {
        res.sendFile(indexPath);
      } else {
        res.status(404).json({ error: 'Application not built. Run npm run build first.' });
      }
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });
}
