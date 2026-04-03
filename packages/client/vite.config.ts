import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@magic-flux/types': path.resolve(__dirname, '../types/src/index.ts'),
    },
  },
});
