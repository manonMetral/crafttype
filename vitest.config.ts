import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    testTimeout: 10_000,
    setupFiles: ['src/shared/test/setup.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // Tests et outils de test ; main.ts n'est que l'appel de la CLI, couvert par ci:generate.
      exclude: [
        'src/**/*.test.ts',
        'src/test/**',
        'src/shared/test/**',
        'src/shared/module/infrastructure/primary/main.ts',
      ],
      reporter: ['text'],
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
