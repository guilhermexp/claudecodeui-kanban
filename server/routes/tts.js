import express from 'express';
import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { promises as fs } from 'fs';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/tts/gemini-summarize { text, voiceName }
router.post('/gemini-summarize', authenticateToken, async (req, res) => {
  try {
    const { text, voiceName = 'Zephyr', maxSeconds = 30 } = req.body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'text is required' });
    }
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'GEMINI_API_KEY/GOOGLE_API_KEY not set in environment' });
    }

    // Build a summarization prompt for audio (sempre em português)
    const prompt = `Resuma o texto a seguir em até ${maxSeconds} segundos de fala, em português (pt-BR), com tom natural e claro, focando os pontos essenciais, sem jargões e sem detalhes irrelevantes.\n\nTEXTO:\n${text}`;

    const scriptPath = path.join(process.cwd(), 'scripts', 'tts', 'gemini_tts.py');
    try {
      await fs.access(scriptPath);
    } catch {
      return res.status(500).json({ error: 'Missing gemini_tts.py helper script' });
    }

    const proc = spawn('python3', [scriptPath], {
      env: {
        ...process.env,
        GEMINI_API_KEY: apiKey,
        INPUT_TEXT: prompt,
        VOICE_NAME: String(voiceName || 'Zephyr'),
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString('utf8'); });
    proc.stderr.on('data', (d) => { stderr += d.toString('utf8'); });

    proc.on('error', (err) => {
      return res.status(500).json({ error: 'Failed to start python3 process', details: err.message });
    });

    proc.on('close', async (code) => {
      if (code !== 0) {
        const hint = stderr && /No module named 'google/.test(stderr) ? 'Install dependency: pip install google-genai' : null;
        return res.status(500).json({ error: 'TTS process failed', code, stderr, hint });
      }
      const b64 = (stdout || '').trim();
      if (!b64) {
        return res.status(500).json({ error: 'Empty TTS output' });
      }
      try {
        const buffer = Buffer.from(b64, 'base64');
        const id = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const audioDir = path.join(os.tmpdir(), 'claude-ui-audios');
        await fs.mkdir(audioDir, { recursive: true });
        const audioPath = path.join(audioDir, `${id}.wav`);
        await fs.writeFile(audioPath, buffer);

        if (!global.generatedAudios) global.generatedAudios = new Map();
        global.generatedAudios.set(id, {
          path: audioPath,
          mimetype: 'audio/wav',
          createdAt: new Date(),
          userId: req.user?.id || 'anonymous'
        });

        // auto cleanup after 2 hours
        setTimeout(async () => {
          try {
            const meta = global.generatedAudios.get(id);
            if (meta) {
              await fs.unlink(meta.path).catch(() => {});
              global.generatedAudios.delete(id);
            }
          } catch {}
        }, 2 * 60 * 60 * 1000);

        return res.json({ url: `/api/audios/${id}` });
      } catch (e) {
        return res.status(500).json({ error: 'Failed to write audio', details: e.message });
      }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
