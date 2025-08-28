import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    hmr: {
      port: 24678, // Expliziter HMR Port
    },
    watch: {
      usePolling: true, // Für WSL/Windows Kompatibilität
      interval: 1000,
    },
    proxy: {
      '/auth': { 
        target: 'http://127.0.0.1:3000', 
        changeOrigin: true, 
        secure: false,
        ws: true // WebSocket support
      },
      '/puzzles': { 
        target: 'http://127.0.0.1:3000', 
        changeOrigin: true, 
        secure: false,
        ws: true
      },
      '/health': { 
        target: 'http://127.0.0.1:3000', 
        changeOrigin: true, 
        secure: false 
      },
      '/images': { 
        target: 'http://127.0.0.1:3000', 
        changeOrigin: true, 
        secure: false 
      },
      '/leaderboard': { 
        target: 'http://127.0.0.1:3000', 
        changeOrigin: true, 
        secure: false 
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom'], // Explizit pre-bundle
  },
  build: {
    sourcemap: true, // Für besseres Debugging
  }
});