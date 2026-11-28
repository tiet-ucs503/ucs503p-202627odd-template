import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The app's tsconfig keeps `jsx: preserve` for Next; esbuild needs the runtime transform
  // to compile test components. Fast Refresh is not needed, so no React plugin here.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts?(x)', 'src/**/*.test.ts?(x)'],
    restoreMocks: true,
  },
});
