import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@magic-flux/types': path.resolve(__dirname, '../types/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
