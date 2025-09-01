import express from 'express';
import path from 'path';
import { extractProjectDirectory } from '../projects.js';
import { setPreviewBroadcaster, startPreview, stopPreview, getStatus, getLogs } from '../lib/previewManager.js';

const router = express.Router();

// POST /api/projects/:projectName/preview/start
router.post('/projects/:projectName/preview/start', async (req, res) => {
  try {
    const { projectName } = req.params;
    const { port } = req.body || {};
    const repoPath = await extractProjectDirectory(projectName);
    console.log(`[Preview Route] Project: ${projectName}, Path: ${repoPath}`);
    if (!path.isAbsolute(repoPath)) {
      return res.status(400).json({ error: 'Invalid project path' });
    }
    const result = await startPreview(projectName, repoPath, port);
    console.log(`[Preview Route] Result:`, result);
    
    // Check if preview was blocked
    if (result.blocked) {
      console.log(`[Preview Route] Sending blocked response`);
      return res.json({ 
        blocked: true, 
        error: result.error,
        running: false 
      });
    }
    
    console.log(`[Preview Route] Sending running response`);
    res.json({ running: true, port: result.port, url: result.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/projects/:projectName/preview/stop
router.post('/projects/:projectName/preview/stop', async (req, res) => {
  try {
    const { projectName } = req.params;
    await stopPreview(projectName);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/projects/:projectName/preview/status
router.get('/projects/:projectName/preview/status', async (req, res) => {
  try {
    const { projectName } = req.params;
    const st = getStatus(projectName);
    if (!st.running) return res.json({ running: false });
    res.json({ running: true, port: st.port, url: `http://localhost:${st.port}` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/projects/:projectName/preview/logs?lines=200
router.get('/projects/:projectName/preview/logs', async (req, res) => {
  try {
    const { projectName } = req.params;
    const lines = Math.min(parseInt(req.query.lines, 10) || 200, 2000);
    const text = getLogs(projectName, lines);
    res.type('text/plain').send(text);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export function setPreviewBroadcasterFn(fn) {
  setPreviewBroadcaster(fn);
}

export default router;

