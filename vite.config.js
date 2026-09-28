import { defineConfig } from 'vite';

// base './' — чтобы сборка работала из подпапки GitHub Pages (/qaita/)
export default defineConfig({
  base: './',
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
