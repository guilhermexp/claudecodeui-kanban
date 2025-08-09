import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';

// Configuração Vite com HTTPS local
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9000,
    host: '0.0.0.0',
    https: {
      key: fs.readFileSync('./certs/localhost-key.pem'),
      cert: fs.readFileSync('./certs/localhost.pem'),
    },
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true,
        secure: false
      }
    }
  },
  define: {
    'process.env': {}
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});