// server/config/app.js - Express Application Setup
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure multer for file uploads
const upload = multer({
  dest: path.join(os.tmpdir(), 'claude-code-uploads'),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 100 // Max 100 files at once
  }
});

export function createApp() {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ extended: true, limit: '100mb' }));

  return { app, upload };
}
