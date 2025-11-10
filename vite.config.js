import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
    optimizeDeps: {
      // Restrict crawling to the actual app entry to avoid scanning server/database mirrors
      entries: ['src/main.jsx'],
      // Prevent Vite from trying to resolve third-party deps used only inside repo snapshots
      exclude: [
        'immer',
        'zustand',
        'zustand/middleware/immer',
        'auto-zustand-selectors-hook',
        '@google/genai'
      ]
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
        // CORS seguro baseado em ambiente
        'Access-Control-Allow-Origin': isNgrok 
          ? env.VITE_NGROK_DOMAIN 
          : 'http://localhost:5892',
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
        // Claude Code UI API routes
        '/api': {
          target: 'http://localhost:7347',
          changeOrigin: true
        },
        // Unified Claude WebSocket endpoint
        '/claude': {
          target: 'ws://localhost:7347',
          ws: true,
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
