import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/types',
  'packages/engine',
  'packages/cards',
  // 'packages/client',  // uncomment when scaffolded
  'packages/server',
]);
