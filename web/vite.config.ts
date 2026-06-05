import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const API_TARGET = 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/auth': { target: API_TARGET, changeOrigin: true },
      '/users': { target: API_TARGET, changeOrigin: true },
      '/conversations': { target: API_TARGET, changeOrigin: true },
      '/messages': { target: API_TARGET, changeOrigin: true },
      '/snaps': { target: API_TARGET, changeOrigin: true },
      '/media': { target: API_TARGET, changeOrigin: true },
      '/calls': { target: API_TARGET, changeOrigin: true },
      '/stats': { target: API_TARGET, changeOrigin: true },
      '/uploads': { target: API_TARGET, changeOrigin: true },
      '/ws': { target: API_TARGET, ws: true, changeOrigin: true },
    },
  },
});
