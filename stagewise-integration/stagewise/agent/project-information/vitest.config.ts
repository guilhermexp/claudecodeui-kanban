import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Use ESM environment
    environment: 'node',

    // Test file patterns
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['node_modules', 'dist', 'build'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,ts}'],
      exclude: ['src/**/*.{test,spec}.{js,ts}', 'src/**/index.ts'],
    },

    // Global test configuration
    globals: false,
    clearMocks: true,
    restoreMocks: true,
  },

  // Ensure proper ESM handling
  esbuild: {
    target: 'esnext',
    format: 'esm',
  },
});
