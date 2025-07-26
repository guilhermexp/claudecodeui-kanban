import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 9000,
      proxy: {
        // Claude Code UI API routes (original)
        '^/api/(?!vibe-kanban).*': 'http://localhost:8080',
        '/ws': {
          target: 'ws://localhost:8080',
          ws: true
        },
        // VibeKanban API routes - proxy to Rust backend
        '/api/vibe-kanban': {
          target: 'http://localhost:8081',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/vibe-kanban/, '/api')
        },
        // VibeKanban WebSocket for real-time updates
        '/api/vibe-kanban/stream': {
          target: 'ws://localhost:8081',
          ws: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/vibe-kanban/, '/api')
        }
      }
    },
    build: {
      outDir: 'dist'
    }
  }
})