import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/puzzles': { target: 'http://localhost:3000', changeOrigin: true },
      '/health': { target: 'http://localhost:3000', changeOrigin: true },
      '/images': { target: 'http://localhost:3000', changeOrigin: true }
    }
  }
});