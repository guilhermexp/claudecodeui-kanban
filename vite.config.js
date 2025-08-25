import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '')
  
  // Detecta se está rodando via ngrok
  const isNgrok = env.VITE_NGROK_DOMAIN || process.env.VITE_NGROK_DOMAIN
  
  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: 5892,
      host: true, // Allow access from network
      hmr: {
        overlay: true,
        // Configuração para trabalhar com ngrok
        protocol: isNgrok ? 'wss' : 'ws',
        host: isNgrok ? isNgrok.replace('https://', '').replace('http://', '') : 'localhost',
        port: isNgrok ? 443 : 5892,
        clientPort: isNgrok ? 443 : 5892
      },
      // Permite requisições do ngrok
      strictPort: true,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'ngrok-skip-browser-warning': 'true'
      },
      // Permite QUALQUER host do ngrok
      allowedHosts: [
        '.ngrok.app',
        '.ngrok-free.app',
        '.ngrok.io',
        'localhost'
      ],
      proxy: {
        // VibeKanban API routes - proxy to Rust backend (MUST BE FIRST!)
        '/api/vibe-kanban': {
          target: 'http://localhost:6734',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/vibe-kanban/, '/api')
        },
        // VibeKanban SSE streams for real-time logs
        '/api/vibe-kanban/projects/.+/execution-processes/.+/normalized-logs/stream': {
          target: 'http://localhost:6734',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/vibe-kanban/, '/api'),
          configure: (proxy, options) => {
            proxy.on('proxyReq', (proxyReq, req, res) => {
              proxyReq.setHeader('Accept', 'text/event-stream');
              proxyReq.setHeader('Cache-Control', 'no-cache');
            });
            proxy.on('proxyRes', (proxyRes, req, res) => {
              proxyRes.headers['content-type'] = 'text/event-stream';
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['connection'] = 'keep-alive';
            });
          }
        },
        // VibeKanban WebSocket for real-time updates
        '/api/vibe-kanban/stream': {
          target: 'ws://localhost:6734',
          ws: true,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/vibe-kanban/, '/api')
        },
        // Claude Code UI API routes (original)
        '/api': {
          target: 'http://localhost:7347',
          changeOrigin: true
        },
        '/ws': {
          target: 'ws://localhost:7347',
          ws: true,
          changeOrigin: true
        },
        // Shell WebSocket
        '/shell': {
          target: 'ws://localhost:7347',
          ws: true,
          changeOrigin: true
        }
      }
    },
    build: {
      outDir: 'dist',
      cssMinify: false, // Disable CSS minification to avoid syntax errors
      target: 'es2020',
      rollupOptions: {
        output: {
          entryFileNames: `assets/[name].[hash].js`,
          chunkFileNames: `assets/[name].[hash].js`,
          assetFileNames: `assets/[name].[hash].[ext]`
        }
      }
    }
  }
})