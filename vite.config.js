import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    coverage: {
      reporter: ['text', 'lcov', 'html'],
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id) return;
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) return 'react';
            if (id.includes('firebase')) return 'firebase';
            if (id.includes('zod')) return 'zod';
            if (id.includes('@heroicons') || id.includes('react-hot-toast') || id.includes('file-saver')) return 'ui';
            return 'vendor';
          }
          // keep firebase imports from src in their own chunk
          if (id.includes('/src/firebase')) return 'firebase';
        },
      },
    },
    chunkSizeWarningLimit: 800,
  },
})
