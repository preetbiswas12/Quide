import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: './',              // Ensure Vite starts from project root
  base: './',              // Critical for Electron file:// URLs
  plugins: [react()],
  build: {
    outDir: 'dist',        // Must match Electron's production path
    emptyOutDir: true,
    target: 'esnext',
    rollupOptions: {
      input: path.resolve(__dirname, 'index.html'), // Absolute path to index.html
    },
    assetsInlineLimit: 0,  // Prevents large assets from inlining (avoids base64 issues)
    chunkSizeWarningLimit: 2000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // Simplify imports like @/components
    },
  },
  server: {
    host: 'localhost',
    port: 5180,
    strictPort: true,      // Ensure fixed port (Electron depends on it)
  },
});
