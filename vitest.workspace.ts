import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/types',
  'packages/engine',
  'packages/cards',
  'packages/client',
  'packages/server',
]);
