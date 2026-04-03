import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@magic-flux/types': path.resolve(__dirname, '../types/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    css: { modules: { classNameStrategy: 'non-scoped' } },
  },
});
