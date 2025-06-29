import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mocks/**'
      ]
    },
    include: [
      'tests/**/*.test.ts'
    ],
    exclude: [
      'tests/unit/plugins/goat/**' // Skip - complex dependencies
    ],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@elizaos/core': path.resolve(__dirname, './packages/core/src'),
      '@elizaos/plugin-goat': path.resolve(__dirname, './packages/plugin-goat'),
      '@elizaos/plugin-bnb-mcp': path.resolve(__dirname, './packages/plugin-bnb-mcp'),
      '@elizaos/client-twitter': path.resolve(__dirname, './packages/client-twitter'),
    }
  }
});