import { defineConfig } from 'vitest/config';
import path from 'node:path';

const root = import.meta.dirname;

/**
 * Vitest runs ONLY against `src/domain` — pure TypeScript with no React,
 * React Native or database imports (see spec §7.4). That constraint is what
 * keeps this suite fast and dependency-free; it is enforced by a test in
 * src/domain/__tests__/purity.test.ts.
 */
export default defineConfig({
  test: {
    include: ['src/domain/**/*.test.ts'],
    environment: 'node',
    coverage: {
      include: ['src/domain/**/*.ts'],
      exclude: ['src/domain/**/*.test.ts', 'src/domain/**/index.ts'],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(root, './src'),
      '@domain': path.resolve(root, './src/domain'),
    },
  },
});
