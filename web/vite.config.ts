/// <reference types="vitest/config" />
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // The page is served with a policy that only allows its own files: nothing is inlined as a data: URI.
    assetsInlineLimit: 0,
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}'],
      exclude: ['src/**/*.test.ts', 'src/main.ts', 'src/env.d.ts'],
      reporter: ['text'],
      thresholds: { statements: 90, branches: 90, functions: 90, lines: 90 },
    },
  },
});
