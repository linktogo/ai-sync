/// <reference types='vitest' />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/board',
  plugins: [vue()],
  build: {
    outDir: './dist',
    emptyOutDir: true,
  },
  test: { environment: 'jsdom', include: ['src/**/*.test.js'] },
});
