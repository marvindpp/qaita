import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' — чтобы сборка работала из подпапки GitHub Pages (/qaita/)
// debug.html — страница проверки движка без интерфейса (?debug=1&auto=1&rec=1); report.html — кабинет врача
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        debug: resolve(import.meta.dirname, 'debug.html'),
        report: resolve(import.meta.dirname, 'report.html'), // кабинет врача по ссылке
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.js'] },
});
