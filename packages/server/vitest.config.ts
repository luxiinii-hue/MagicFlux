import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@magic-flux/types': path.resolve(__dirname, '../types/src/index.ts'),
      '@magic-flux/engine': path.resolve(__dirname, '../engine/src/index.ts'),
      '@magic-flux/cards': path.resolve(__dirname, '../cards/src/index.ts'),
    },
  },
});
