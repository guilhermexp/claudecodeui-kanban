import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import os from 'os';
import { authenticateToken } from '../middleware/auth.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('INDEXER');
const router = express.Router();

const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..');
const DB_DIR = path.join(ROOT, 'database', 'repo-indexes');
const SRC_DIR = path.join(ROOT, 'database', 'repo-sources');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }
function readSafe(p) { try { return fs.readFileSync(p, 'utf8'); } catch { return ''; } }

const DEFAULT_EXCLUDES = [
  'node_modules', '.git', 'dist', 'build', '.next', '.turbo', '.cache', 'coverage', '.venv', '.idea', '.vscode'
];
const TEXT_EXT = new Set([
  'js','ts','tsx','jsx','json','md','txt','yml','yaml','css','scss','less','html','vue','svelte','py','rb','go','rs','java','kt','c','h','cpp','hpp','cs','sh','bash','zsh','env','ini','cfg','conf','toml','sql','xml','svg','mdx'
]);

function isProbablyTextFile(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (TEXT_EXT.has(ext)) return true;
  // Fallback: read first 800 bytes and look for nulls
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(800);
    const bytes = fs.readSync(fd, buf, 0, 800, 0);
    fs.closeSync(fd);
    for (let i = 0; i < bytes; i++) {
      const c = buf[i];
      if (c === 0) return false;
    }
    return true;
  } catch { return false; }
}

function walk(dir, options, baseDir = dir) {
  const { excludes } = options;
  const items = [];
  for (const name of fs.readdirSync(dir)) {
    if (excludes.some((e) => name === e)) continue;
    const abs = path.join(dir, name);
    const rel = path.relative(baseDir, abs);
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      items.push(...walk(abs, options, baseDir));
    } else if (stat.isFile()) {
      items.push({ rel, abs, size: stat.size });
    }
  }
  return items;
}

function makeId(input) {
  return crypto.createHash('sha1').update(input + Date.now().toString()).digest('hex').slice(0, 12);
}

function buildBundle(files, maxBytesPerFile = 200_000) {
  let out = '';
  out += `# Repo Index\n`;
  files.forEach((f) => {
    out += `\n===== FILE: ${f.rel} (${f.size} bytes) =====\n`;
    out += (f.content || '') + (f.truncated ? `\n[... truncated]` : '');
    out += `\n`;
  });
  return out;
}

function indexRepo(repoPath, id, options = {}) {
  const { excludes = DEFAULT_EXCLUDES, maxBytesPerFile = 200000 } = options;
  const files = walk(repoPath, { excludes });
  const indexedFiles = [];
  for (const f of files) {
    if (!isProbablyTextFile(f.abs)) continue;
    let content = '';
    let truncated = false;
    try {
      const stat = fs.statSync(f.abs);
      let bytesToRead = Math.min(stat.size, maxBytesPerFile);
      content = fs.readFileSync(f.abs, { encoding: 'utf8', flag: 'r' }).slice(0, bytesToRead);
      truncated = stat.size > maxBytesPerFile;
    } catch {}
    indexedFiles.push({ rel: f.rel, size: f.size, content, truncated });
  }

  const dir = path.join(DB_DIR, id);
  ensureDir(dir);
  const meta = {
    id,
    repoPath,
    createdAt: new Date().toISOString(),
    fileCount: indexedFiles.length,
    totalBytes: indexedFiles.reduce((a, b) => a + (b.size || 0), 0),
    excludes,
    maxBytesPerFile
  };
  const index = { meta, files: indexedFiles };
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index));
  const bundle = buildBundle(indexedFiles, maxBytesPerFile);
  fs.writeFileSync(path.join(dir, 'bundle.txt'), bundle);
  return meta;
}

router.post('/create', authenticateToken, (req, res) => {
  try {
    const { path: repoPath, name, maxBytesPerFile = 200000 } = req.body || {};
    if (!repoPath || !path.isAbsolute(repoPath)) return res.status(400).json({ error: 'Absolute path required' });
    if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) return res.status(404).json({ error: 'Path not found' });

    const excludes = Array.from(new Set([ ...DEFAULT_EXCLUDES, req.body?.excludes ].flat().filter(Boolean)));
    const id = name || makeId(repoPath);
    const meta = indexRepo(repoPath, id, { excludes, maxBytesPerFile });
    return res.json({ success: true, id, meta });
  } catch (e) {
    log.error(`create failed: ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
});

// Create by GitHub URL: clones to temp dir then indexes
router.post('/github', authenticateToken, async (req, res) => {
  try {
    const { url, name, branch = 'main', maxBytesPerFile = 200000 } = req.body || {};
    if (!url || !/^https?:\/\//.test(url)) return res.status(400).json({ error: 'Valid Git URL required' });
    const id = name || makeId(url);
    ensureDir(SRC_DIR);
    const target = path.join(SRC_DIR, id);
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });

    // Shallow clone
    await new Promise((resolve, reject) => {
      const proc = spawn('git', ['clone', '--depth=1', '--branch', branch, url, target], { stdio: 'ignore' });
      proc.on('error', reject);
      proc.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`git clone exited ${code}`)));
    });

    const excludes = Array.from(new Set([ ...DEFAULT_EXCLUDES, req.body?.excludes ].flat().filter(Boolean)));
    const meta = indexRepo(target, id, { excludes, maxBytesPerFile });
    return res.json({ success: true, id, meta });
  } catch (e) {
    log.error(`github create failed: ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
});

router.get('/', authenticateToken, (req, res) => {
  try {
    ensureDir(DB_DIR);
    const ids = fs.readdirSync(DB_DIR).filter((f) => fs.existsSync(path.join(DB_DIR, f, 'index.json')));
    const list = ids.map((id) => {
      try { const j = JSON.parse(readSafe(path.join(DB_DIR, id, 'index.json'))); return j.meta || { id }; } catch { return { id }; }
    });
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id', authenticateToken, (req, res) => {
  try {
    const p = path.join(DB_DIR, req.params.id, 'index.json');
    if (!fs.existsSync(p)) return res.status(404).json({ error: 'Not found' });
    res.set('Cache-Control', 'private, max-age=60');
    res.sendFile(path.resolve(p));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/bundle', authenticateToken, (req, res) => {
  try {
    const p = path.join(DB_DIR, req.params.id, 'bundle.txt');
    if (!fs.existsSync(p)) return res.status(404).send('Not found');
    res.set('Content-Type', 'text/plain; charset=utf-8');
    res.send(readSafe(p));
  } catch (e) { res.status(500).send(e.message); }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const dir = path.join(DB_DIR, req.params.id);
    if (!fs.existsSync(dir)) return res.json({ success: true });
    fs.rmSync(dir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/search', authenticateToken, (req, res) => {
  try {
    const { id, query } = req.body || {};
    if (!id || !query) return res.status(400).json({ error: 'id and query required' });
    const indexPath = path.join(DB_DIR, id, 'index.json');
    if (!fs.existsSync(indexPath)) return res.status(404).json({ error: 'Not found' });
    const index = JSON.parse(readSafe(indexPath));
    const q = String(query).toLowerCase();
    const matches = index.files.filter((f) => (f.content || '').toLowerCase().includes(q)).slice(0, 50);
    res.json({ id, query, results: matches.map((m) => ({ path: m.rel, snippet: snippetAround(m.content, q) })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

function snippetAround(text, q) {
  const idx = text.toLowerCase().indexOf(q);
  if (idx < 0) return (text || '').slice(0, 200);
  const start = Math.max(0, idx - 80);
  const end = Math.min(text.length, idx + 120);
  return text.slice(start, end);
}

export default router;
